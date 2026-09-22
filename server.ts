import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import {
  saveFileToStorage,
  deleteFileFromDisk,
  streamFileDownload,
  streamFilePreview,
  streamRequestZip,
  validateFileBuffer,
} from './server/storage';
import {
  startPeriodicCleanup,
  restartPeriodicCleanup,
  executeCleanupTask,
  getCleanupStatus,
} from './server/cleanup';
import { requireAdmin, handleAdminLogin } from './server/auth';

const PORT = 3000;
const app = express();

// SSE connection pool for real-time admin notifications
const adminSseClients = new Set<Response>();

// Public SSE connection pool for real-time customer status tracking
const publicStatusSseClients = new Map<string, Set<Response>>();

export function broadcastAdminEvent(eventName: string, data: unknown): void {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of adminSseClients) {
    try {
      client.write(payload);
    } catch {
      adminSseClients.delete(client);
    }
  }
}

function broadcastPublicStatusUpdate(referenceCode: string) {
  if (!referenceCode) return;
  const code = referenceCode.toUpperCase();
  const clients = publicStatusSseClients.get(code);
  if (!clients || clients.size === 0) return;

  const request = db.getRequestByReference(code);
  if (!request) return;

  const info = STATUS_DESCRIPTIONS[request.status] || {
    label: request.status.replace(/_/g, ' ').toUpperCase(),
    description: 'Your order is in the system queue.',
    step: 1,
  };

  const publicTimeline = (request.activityLogs || []).map((log) => ({
    id: log.id,
    action: log.action,
    timestamp: log.timestamp,
  }));

  const payload = JSON.stringify({
    referenceCode: request.referenceCode,
    status: request.status,
    statusLabel: info.label,
    statusDescription: info.description,
    statusStep: info.step,
    type: request.type,
    fileCount: request.fileCount,
    createdAt: request.createdAt,
    lastUpdated: request.activityLogs && request.activityLogs.length > 0
      ? request.activityLogs[request.activityLogs.length - 1].timestamp
      : request.createdAt,
    quotationStatus: (request as any).quotationStatus || 'Not Required',
    paymentStatus: (request as any).paymentStatus || 'Cash on Pickup',
    timeline: publicTimeline,
  });

  const sseMessage = `event: status_update\ndata: ${payload}\n\n`;
  for (const client of clients) {
    try {
      client.write(sseMessage);
    } catch {
      clients.delete(client);
    }
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Multer with memory storage so we can validate magic bytes
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // Generous memory buffer limit per file, validated strictly against db settings below
    fileSize: 150 * 1024 * 1024,
    files: 25,
  },
});

// Initialize background periodic storage cleanup task
startPeriodicCleanup();

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Oyangoren Printing Services File Upload System' });
});

// System Info
app.get('/api/info', (req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    name: 'Oyangoren Printing Services',
    maxFileSizeMB: settings.maxFileSizeMB,
    allowedExtensions: settings.allowedExtensions,
  });
});

// QR Code Generator (Returns DataURL or direct PNG)
app.get('/api/qr', async (req: Request, res: Response) => {
  try {
    const targetUrl = req.query.url as string;
    const format = req.query.format as string;

    if (!targetUrl) {
      res.status(400).json({ error: 'Missing target URL parameter' });
      return;
    }

    if (format === 'png') {
      res.setHeader('Content-Type', 'image/png');
      await QRCode.toFileStream(res, targetUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      return;
    }

    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    res.json({ dataUrl });
  } catch (err) {
    console.error('QR code generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Verify Remote Upload Link Token
app.get('/api/request/verify/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const link = db.getLinkByToken(token);

  if (!link) {
    res.json({
      valid: false,
      error: 'not_found',
      errorMessage: 'Upload link not found or invalid.',
    });
    return;
  }

  if (!link.active) {
    res.json({
      valid: false,
      error: 'disabled',
      errorMessage: 'This upload link is currently deactivated by the administrator.',
    });
    return;
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    res.json({
      valid: false,
      error: 'expired',
      errorMessage: 'This upload link has expired. Please request a new link from Oyangoren Printing Services.',
    });
    return;
  }

  if (link.uploadLimit !== null && link.uploadCount >= link.uploadLimit) {
    res.json({
      valid: false,
      error: 'limit_reached',
      errorMessage: 'This link has already reached its maximum allowed number of uploads.',
    });
    return;
  }

  const settings = db.getSettings();
  const resolvedLinkType = link.linkType || (link.instructionsEnabled ? 'files_instructions' : 'files_only');

  res.json({
    valid: true,
    customerName: link.customerName,
    linkType: resolvedLinkType,
    instructionsEnabled: link.instructionsEnabled,
    expiresAt: link.expiresAt,
    uploadLimit: link.uploadLimit,
    uploadCount: link.uploadCount,
    paperSizes: settings.paperSizes || [
      'Short Bond (8.5" x 11")',
      'Long Bond (8.5" x 13")',
      'A4 (8.27" x 11.69")',
      'A3 (11.7" x 16.5")',
    ],
    finishingOptions: settings.finishingOptions || [
      'None / Loose Sheets',
      'Stapled (Top Left)',
      'Stapled (Booklet)',
      'Ring Bound (Coil)',
      'Folder / Fastener',
    ],
    defaultPaperSize: settings.defaultPaperSize || 'Short Bond (8.5" x 11")',
    defaultColorMode: settings.defaultColorMode || 'black_and_white',
  });
});

// Helper for human-readable status details
const STATUS_DESCRIPTIONS: Record<string, { label: string; description: string; step: number }> = {
  new: {
    label: 'New Request',
    description: 'Your print order has been received and is waiting in the shop queue.',
    step: 1,
  },
  reviewing: {
    label: 'Under Review',
    description: 'A technician is checking your files, page count, and print specifications.',
    step: 2,
  },
  ready_to_print: {
    label: 'Ready to Print',
    description: 'Files are verified and queued for the printing machine.',
    step: 3,
  },
  printing: {
    label: 'Printing in Progress',
    description: 'Your document is actively printing or undergoing cutting and finishing.',
    step: 4,
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    description: 'Your order is completed and waiting at the counter for pickup.',
    step: 5,
  },
  completed: {
    label: 'Completed',
    description: 'This print order has been fulfilled and picked up. Thank you!',
    step: 6,
  },
  cancelled: {
    label: 'Order Cancelled',
    description: 'This print order has been cancelled by the shop operator.',
    step: 0,
  },
  processing: {
    label: 'Printing in Progress',
    description: 'Your print order is actively being handled by shop staff.',
    step: 4,
  },
};

// Public Track Status by Reference Code (e.g. OY-1234)
// STRICT SECURITY: Strictly limited public response (no file download access, no customer identity, no phone, no internal notes)
function handlePublicStatusLookup(req: Request, res: Response) {
  const refCode = req.params.refCode ? req.params.refCode.trim() : '';
  if (!refCode) {
    res.status(400).json({ error: 'Please enter a valid reference number.' });
    return;
  }

  const request = db.getRequestByReference(refCode);

  if (!request) {
    res.status(404).json({ error: 'No print order found matching this reference code. Please double-check your code.' });
    return;
  }

  const info = STATUS_DESCRIPTIONS[request.status] || {
    label: request.status.replace(/_/g, ' ').toUpperCase(),
    description: 'Your order is in the system queue.',
    step: 1,
  };

  // Build sanitized, public-safe timeline
  const publicTimeline = (request.activityLogs || []).map((log) => ({
    id: log.id,
    action: log.action,
    timestamp: log.timestamp,
  }));

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    referenceCode: request.referenceCode,
    status: request.status,
    statusLabel: info.label,
    statusDescription: info.description,
    statusStep: info.step,
    type: request.type,
    fileCount: request.fileCount,
    createdAt: request.createdAt,
    lastUpdated: request.activityLogs && request.activityLogs.length > 0
      ? request.activityLogs[request.activityLogs.length - 1].timestamp
      : request.createdAt,
    quotationStatus: (request as any).quotationStatus || 'Not Required',
    paymentStatus: (request as any).paymentStatus || 'Cash on Pickup',
    timeline: publicTimeline,
  });
}

app.get('/api/status/:refCode', handlePublicStatusLookup);
app.get('/api/upload/status/:refCode', handlePublicStatusLookup);

// Public SSE status stream
app.get('/api/status/:refCode/stream', (req: Request, res: Response) => {
  const refCode = req.params.refCode ? req.params.refCode.trim().toUpperCase() : '';
  if (!refCode) {
    res.status(400).json({ error: 'Invalid reference code' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!publicStatusSseClients.has(refCode)) {
    publicStatusSseClients.set(refCode, new Set());
  }
  const clients = publicStatusSseClients.get(refCode)!;
  clients.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, referenceCode: refCode })}\n\n`);

  req.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) {
      publicStatusSseClients.delete(refCode);
    }
  });
});

// Quick Upload (Walk-in Customers)
app.post(
  '/api/upload/quick',
  upload.array('files', 20),
  (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Please select at least one file to upload.' });
        return;
      }

      const settings = db.getSettings();
      const maxBytes = settings.maxFileSizeMB * 1024 * 1024;

      // Validate all files first
      for (const file of files) {
        if (file.size > maxBytes) {
          res.status(400).json({
            error: `File "${file.originalname}" exceeds the maximum allowed size of ${settings.maxFileSizeMB} MB.`,
          });
          return;
        }

        const ext = path.extname(file.originalname);
        const validation = validateFileBuffer(file.buffer, ext);
        if (!validation.valid) {
          res.status(400).json({
            error: `File "${file.originalname}" is invalid: ${validation.reason}`,
          });
          return;
        }
      }

      // Idempotency check: prevent duplicate requests on network retries
      const submissionId = req.body.submissionId ? String(req.body.submissionId).trim() : null;
      if (submissionId) {
        const existing = db.getRequestBySubmissionId(submissionId);
        if (existing) {
          res.json({
            success: true,
            requestId: existing.id,
            referenceCode: existing.referenceCode,
            fileCount: existing.fileCount,
            customerName: existing.customerName,
            files: existing.files.map((f) => ({
              id: f.id,
              name: f.originalFilename,
              size: f.fileSize,
            })),
          });
          return;
        }
      }

      const customerName = req.body.customerName ? String(req.body.customerName).trim().slice(0, 100) : null;

      // Create Request
      const newRequest = db.createRequest({
        type: 'quick',
        submissionId,
        customerName,
        instructionsEnabled: false,
        instructions: null,
      });

      // Save files to private disk storage
      const savedFilesData: {
        requestId: string;
        originalFilename: string;
        storedFilename: string;
        mimeType: string;
        fileSize: number;
      }[] = [];

      for (const file of files) {
        const { storedFilename, fileSize } = saveFileToStorage(
          file.originalname,
          file.buffer,
          file.mimetype
        );
        savedFilesData.push({
          requestId: newRequest.id,
          originalFilename: file.originalname,
          storedFilename,
          mimeType: file.mimetype,
          fileSize,
        });
      }

      const createdFiles = db.addFiles(savedFilesData);

      // Real-time notification to admin dashboard
      const completeReq = db.getRequestById(newRequest.id);
      broadcastAdminEvent('new_upload', { request: completeReq });

      res.json({
        success: true,
        requestId: newRequest.id,
        referenceCode: newRequest.referenceCode,
        fileCount: createdFiles.length,
        customerName: newRequest.customerName,
        files: createdFiles.map((f) => ({
          id: f.id,
          name: f.originalFilename,
          size: f.fileSize,
        })),
      });
    } catch (err) {
      console.error('Quick upload error:', err);
      res.status(500).json({ error: 'Internal server error processing file upload.' });
    }
  }
);

// Remote Customer Upload via unique token
app.post(
  '/api/upload/request/:token',
  upload.array('files', 20),
  (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const link = db.getLinkByToken(token);

      if (!link) {
        res.status(404).json({ error: 'Upload link not found or invalid.' });
        return;
      }

      if (!link.active) {
        res.status(403).json({ error: 'This upload link has been disabled.' });
        return;
      }

      if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
        res.status(403).json({ error: 'This upload link has expired.' });
        return;
      }

      if (link.uploadLimit !== null && link.uploadCount >= link.uploadLimit) {
        res.status(403).json({ error: 'This upload link has reached its maximum upload limit.' });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Please select at least one file to upload.' });
        return;
      }

      const settings = db.getSettings();
      const maxBytes = settings.maxFileSizeMB * 1024 * 1024;

      // Validate all files
      for (const file of files) {
        if (file.size > maxBytes) {
          res.status(400).json({
            error: `File "${file.originalname}" exceeds the maximum allowed size of ${settings.maxFileSizeMB} MB.`,
          });
          return;
        }

        const ext = path.extname(file.originalname);
        const validation = validateFileBuffer(file.buffer, ext);
        if (!validation.valid) {
          res.status(400).json({
            error: `File "${file.originalname}" is invalid: ${validation.reason}`,
          });
          return;
        }
      }

      // Idempotency check: prevent duplicate requests on network retries
      const submissionId = req.body.submissionId ? String(req.body.submissionId).trim() : null;
      if (submissionId) {
        const existing = db.getRequestBySubmissionId(submissionId);
        if (existing) {
          res.json({
            success: true,
            requestId: existing.id,
            referenceCode: existing.referenceCode,
            fileCount: existing.fileCount,
            customerName: existing.customerName,
            instructions: existing.instructions,
            files: existing.files.map((f) => ({
              id: f.id,
              name: f.originalFilename,
              size: f.fileSize,
            })),
          });
          return;
        }
      }

      // Parse customer name & contact
      const customerName = req.body.customerName
        ? String(req.body.customerName).trim().slice(0, 100)
        : (link.customerName || null);
      const customerPhone = req.body.customerPhone
        ? String(req.body.customerPhone).trim().slice(0, 50)
        : null;

      // Printing instructions: only store if link allows instructions or is full request
      let instructionsText: string | null = null;
      if ((link.instructionsEnabled || link.linkType === 'full_request') && req.body.instructions) {
        instructionsText = String(req.body.instructions).trim().slice(0, 2000);
      }

      // Parse full print options if link type is full_request
      let printOptions: any = null;
      let fileConfigs: any[] = [];

      if (link.linkType === 'full_request' || req.body.printOptions) {
        try {
          if (typeof req.body.printOptions === 'string') {
            printOptions = JSON.parse(req.body.printOptions);
          } else if (typeof req.body.printOptions === 'object' && req.body.printOptions !== null) {
            printOptions = req.body.printOptions;
          }
        } catch (e) {
          console.warn('Failed to parse printOptions JSON:', e);
        }

        try {
          if (typeof req.body.fileConfigs === 'string') {
            fileConfigs = JSON.parse(req.body.fileConfigs);
          } else if (Array.isArray(req.body.fileConfigs)) {
            fileConfigs = req.body.fileConfigs;
          }
        } catch (e) {
          console.warn('Failed to parse fileConfigs JSON:', e);
        }
      }

      // Create Request
      const newRequest = db.createRequest({
        type: 'remote',
        linkType: link.linkType || (link.instructionsEnabled ? 'files_instructions' : 'files_only'),
        token: link.token,
        linkId: link.id,
        submissionId,
        customerName,
        customerPhone,
        instructionsEnabled: link.instructionsEnabled,
        instructions: instructionsText,
        printOptions: printOptions || null,
        fileConfigs: Array.isArray(fileConfigs) ? fileConfigs : [],
      });

      // Save files to storage
      const savedFilesData: {
        requestId: string;
        originalFilename: string;
        storedFilename: string;
        mimeType: string;
        fileSize: number;
      }[] = [];

      for (const file of files) {
        const { storedFilename, fileSize } = saveFileToStorage(
          file.originalname,
          file.buffer,
          file.mimetype
        );
        savedFilesData.push({
          requestId: newRequest.id,
          originalFilename: file.originalname,
          storedFilename,
          mimeType: file.mimetype,
          fileSize,
        });
      }

      const createdFiles = db.addFiles(savedFilesData);

      // Increment link usage count
      db.incrementLinkUploadCount(token);

      // Real-time notification to admin dashboard
      const completeReq = db.getRequestById(newRequest.id);
      broadcastAdminEvent('new_upload', { request: completeReq });

      res.json({
        success: true,
        requestId: newRequest.id,
        referenceCode: newRequest.referenceCode,
        fileCount: createdFiles.length,
        customerName: newRequest.customerName,
        customerPhone: newRequest.customerPhone,
        linkType: newRequest.linkType,
        instructions: instructionsText,
        printOptions: newRequest.printOptions,
        fileConfigs: newRequest.fileConfigs,
        files: createdFiles.map((f) => ({
          id: f.id,
          name: f.originalFilename,
          size: f.fileSize,
        })),
      });
    } catch (err) {
      console.error('Remote upload error:', err);
      res.status(500).json({ error: 'Internal server error processing file upload.' });
    }
  }
);

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const result = handleAdminLogin(password);

  if (!result.success) {
    res.status(401).json({ error: result.error || 'Invalid credentials' });
    return;
  }

  res.json({ success: true, token: result.token });
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    db.revokeSession(token);
  }
  res.json({ success: true });
});

app.get('/api/admin/me', requireAdmin, (req: Request, res: Response) => {
  res.json({ authenticated: true });
});

// SSE Events stream for real-time admin updates
app.get('/api/admin/events', (req: Request, res: Response) => {
  let token = req.query.token as string | undefined;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token || !db.validateSession(token)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session token' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

  adminSseClients.add(res);

  // Heartbeat ping every 25 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      adminSseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminSseClients.delete(res);
  });
});

// ==========================================
// ADMIN REQUEST MANAGEMENT
// ==========================================

// Get all requests
app.get('/api/admin/requests', requireAdmin, (req: Request, res: Response) => {
  const requests = db.getAllRequests();
  res.json(requests);
});

const VALID_REQUEST_STATUSES = [
  'new',
  'reviewing',
  'ready_to_print',
  'printing',
  'ready_for_pickup',
  'completed',
  'cancelled',
  'processing',
];

// Bulk update status
app.post('/api/admin/requests/bulk-status', requireAdmin, (req: Request, res: Response) => {
  const { requestIds, status, actor } = req.body;
  if (!Array.isArray(requestIds) || !VALID_REQUEST_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid bulk status request data' });
    return;
  }

  const updatedCount = db.bulkUpdateStatus(requestIds, status, actor || 'Staff');

  for (const id of requestIds) {
    const reqObj = db.getRequestById(id);
    if (reqObj) {
      broadcastPublicStatusUpdate(reqObj.referenceCode);
    }
  }

  broadcastAdminEvent('bulk_status_changed', {
    requestIds,
    status,
    updatedCount,
  });
  broadcastAdminEvent('stats', db.getStats());

  res.json({ success: true, updatedCount });
});

// Bulk delete requests
app.post('/api/admin/requests/bulk-delete', requireAdmin, (req: Request, res: Response) => {
  const { requestIds } = req.body;
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    res.status(400).json({ error: 'Please select at least one request to delete' });
    return;
  }

  const { deletedRequestsCount, deletedFiles } = db.bulkDeleteRequests(requestIds);
  for (const file of deletedFiles) {
    deleteFileFromDisk(file.storedFilename);
  }

  broadcastAdminEvent('stats', db.getStats());

  res.json({ success: true, deletedRequestsCount, deletedFilesCount: deletedFiles.length });
});

// Get single request
app.get('/api/admin/requests/:id', requireAdmin, (req: Request, res: Response) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }
  res.json(request);
});

// Update request status (with status history & notes)
app.patch('/api/admin/requests/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { status, actor, note } = req.body;
  if (!VALID_REQUEST_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status value' });
    return;
  }

  const updated = db.updateRequestStatus(req.params.id, status, actor || 'Staff', note);
  if (!updated) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const updatedReq = db.getRequestById(req.params.id);

  if (updatedReq) {
    broadcastPublicStatusUpdate(updatedReq.referenceCode);
  }

  broadcastAdminEvent('status_changed', {
    id: req.params.id,
    status,
    actor: actor || 'Staff',
    note: note || null,
    activityLogs: updatedReq?.activityLogs || [],
  });
  broadcastAdminEvent('stats', db.getStats());

  res.json({ success: true, status, request: updatedReq });
});

// Add internal staff note
app.post('/api/admin/requests/:id/notes', requireAdmin, (req: Request, res: Response) => {
  const { text, author } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Note text cannot be empty' });
    return;
  }

  const newNote = db.addStaffNote(req.params.id, text, author || 'Staff');
  if (!newNote) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const updatedReq = db.getRequestById(req.params.id);
  broadcastAdminEvent('note_added', {
    requestId: req.params.id,
    note: newNote,
    internalNotes: updatedReq?.internalNotes || [],
  });

  res.status(201).json({ success: true, note: newNote });
});

// Delete internal staff note
app.delete('/api/admin/requests/:id/notes/:noteId', requireAdmin, (req: Request, res: Response) => {
  const deleted = db.deleteStaffNote(req.params.id, req.params.noteId);
  if (!deleted) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  const updatedReq = db.getRequestById(req.params.id);
  broadcastAdminEvent('note_deleted', {
    requestId: req.params.id,
    noteId: req.params.noteId,
    internalNotes: updatedReq?.internalNotes || [],
  });

  res.json({ success: true });
});

// Printable Job Ticket
app.get('/api/admin/requests/:id/ticket', requireAdmin, (req: Request, res: Response) => {
  const request = db.getRequestById(req.params.id);
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  res.json({
    shopName: 'Oyangoren Printing Services',
    referenceCode: request.referenceCode,
    date: request.createdAt,
    status: request.status,
    type: request.type,
    linkType: request.linkType || (request.instructionsEnabled ? 'files_instructions' : 'files_only'),
    customerName: request.customerName || 'Walk-in Customer',
    customerPhone: request.customerPhone || 'None',
    printOptions: request.printOptions || null,
    fileConfigs: request.fileConfigs || [],
    instructions: request.instructions || null,
    internalNotes: request.internalNotes || [],
    activityLogs: request.activityLogs || [],
    fileCount: request.fileCount,
    totalSize: request.totalSize,
    files: request.files.map((f) => ({
      id: f.id,
      name: f.originalFilename,
      size: f.fileSize,
      mimeType: f.mimeType,
    })),
  });
});

// Delete request and all its files
app.delete('/api/admin/requests/:id', requireAdmin, (req: Request, res: Response) => {
  const { success, deletedFiles } = db.deleteRequest(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  // Remove files from disk
  for (const file of deletedFiles) {
    deleteFileFromDisk(file.storedFilename);
  }

  res.json({ success: true, deletedFilesCount: deletedFiles.length });
});

// Download all files in a request as a ZIP
app.get('/api/admin/requests/:id/download-zip', requireAdmin, (req: Request, res: Response) => {
  try {
    const request = db.getRequestById(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    streamRequestZip(request, res);
  } catch (err: any) {
    console.error('Download ZIP route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream ZIP archive: ' + (err?.message || 'Server error') });
    }
  }
});

// Download individual file
app.get('/api/admin/files/:id/download', requireAdmin, (req: Request, res: Response) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File record not found' });
    return;
  }

  streamFileDownload(file, res);
});

// Preview individual file (PDF, PNG, JPG, JPEG)
app.get('/api/admin/files/:id/preview', requireAdmin, (req: Request, res: Response) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File record not found' });
    return;
  }

  streamFilePreview(file, res);
});

// Delete individual file
app.delete('/api/admin/files/:id', requireAdmin, (req: Request, res: Response) => {
  const file = db.deleteFileById(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  deleteFileFromDisk(file.storedFilename);
  res.json({ success: true });
});

// ==========================================
// ADMIN REMOTE LINKS MANAGEMENT
// ==========================================

// Get all remote upload links
app.get('/api/admin/links', requireAdmin, (req: Request, res: Response) => {
  const links = db.getAllLinks();
  res.json(links);
});

// Create new remote upload link
app.post('/api/admin/links', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      customerName,
      linkType,
      instructionsEnabled,
      expirationOption,
      customExpiresAt,
      uploadLimit,
      active,
    } = req.body;

    const resolvedLinkType = linkType || (instructionsEnabled ? 'files_instructions' : 'files_only');

    const newLink = db.createLink({
      customerName,
      linkType: resolvedLinkType,
      instructionsEnabled: resolvedLinkType !== 'files_only',
      expirationOption: expirationOption || '24h',
      customExpiresAt,
      uploadLimit: uploadLimit ? Number(uploadLimit) : null,
      active: active !== undefined ? Boolean(active) : true,
    });

    res.status(201).json(newLink);
  } catch (err) {
    console.error('Error creating link:', err);
    res.status(500).json({ error: 'Failed to create upload link' });
  }
});

// Update remote link (toggle active/disabled, expiration, limit)
app.patch('/api/admin/links/:id', requireAdmin, (req: Request, res: Response) => {
  const updated = db.updateLink(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  res.json(updated);
});

// Delete remote link
app.delete('/api/admin/links/:id', requireAdmin, (req: Request, res: Response) => {
  const deleted = db.deleteLink(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }
  res.json({ success: true });
});

// ==========================================
// ADMIN SETTINGS & STATS
// ==========================================

app.get('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const settings = db.getSettings();
  const stats = db.getStats();
  const cleanupStatus = getCleanupStatus();

  res.json({
    settings: {
      maxFileSizeMB: settings.maxFileSizeMB,
      autoCleanupDays: settings.autoCleanupDays,
      cleanupIntervalHours: settings.cleanupIntervalHours,
      allowedExtensions: settings.allowedExtensions,
      paperSizes: settings.paperSizes || [],
      finishingOptions: settings.finishingOptions || [],
      defaultPaperSize: settings.defaultPaperSize || 'Short Bond (8.5" x 11")',
      defaultColorMode: settings.defaultColorMode || 'black_and_white',
      soundEnabled: settings.soundEnabled ?? true,
      soundVolume: settings.soundVolume ?? 80,
      selectedSoundType: settings.selectedSoundType || 'default',
      customSoundFilename: settings.customSoundFilename || null,
      hasCustomSound: !!settings.customSoundStoredFilename,
      lastCleanupAt: settings.lastCleanupAt,
      lastCleanupResult: settings.lastCleanupResult,
      cleanupHistory: settings.cleanupHistory || [],
    },
    cleanupStatus,
    stats,
  });
});

app.post('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const {
      maxFileSizeMB,
      autoCleanupDays,
      cleanupIntervalHours,
      paperSizes,
      finishingOptions,
      defaultPaperSize,
      defaultColorMode,
      soundEnabled,
      soundVolume,
      selectedSoundType,
      newPassword,
    } = req.body;
    const updates: Record<string, any> = {};
    let scheduleNeedsRestart = false;

    if (maxFileSizeMB !== undefined) {
      const parsed = Number(maxFileSizeMB);
      if (parsed >= 5 && parsed <= 200) {
        updates.maxFileSizeMB = parsed;
      }
    }

    if (autoCleanupDays !== undefined) {
      const parsed = Number(autoCleanupDays);
      if (parsed >= 0 && parsed <= 365) {
        updates.autoCleanupDays = parsed;
        scheduleNeedsRestart = true;
      }
    }

    if (cleanupIntervalHours !== undefined) {
      const parsedInterval = Number(cleanupIntervalHours);
      if ([1, 2, 4, 6, 12, 24].includes(parsedInterval) || (parsedInterval >= 1 && parsedInterval <= 72)) {
        updates.cleanupIntervalHours = parsedInterval;
        scheduleNeedsRestart = true;
      }
    }

    if (Array.isArray(paperSizes) && paperSizes.length > 0) {
      updates.paperSizes = paperSizes.map((s) => String(s).trim()).filter(Boolean);
    }

    if (Array.isArray(finishingOptions)) {
      updates.finishingOptions = finishingOptions.map((f) => String(f).trim()).filter(Boolean);
    }

    if (defaultPaperSize && typeof defaultPaperSize === 'string') {
      updates.defaultPaperSize = defaultPaperSize.trim();
    }

    if (defaultColorMode === 'black_and_white' || defaultColorMode === 'color') {
      updates.defaultColorMode = defaultColorMode;
    }

    if (soundEnabled !== undefined) {
      updates.soundEnabled = Boolean(soundEnabled);
    }

    if (soundVolume !== undefined) {
      const vol = Number(soundVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 100) {
        updates.soundVolume = vol;
      }
    }

    if (selectedSoundType === 'default' || selectedSoundType === 'custom') {
      updates.selectedSoundType = selectedSoundType;
    }

    if (Object.keys(updates).length > 0) {
      db.updateSettings(updates);
    }

    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 4) {
      db.updateAdminPassword(newPassword);
    }

    if (scheduleNeedsRestart) {
      restartPeriodicCleanup();
    }

    const current = db.getSettings();
    const cleanupStatus = getCleanupStatus();

    res.json({
      success: true,
      settings: {
        maxFileSizeMB: current.maxFileSizeMB,
        autoCleanupDays: current.autoCleanupDays,
        cleanupIntervalHours: current.cleanupIntervalHours,
        allowedExtensions: current.allowedExtensions,
        paperSizes: current.paperSizes || [],
        finishingOptions: current.finishingOptions || [],
        defaultPaperSize: current.defaultPaperSize || 'Short Bond (8.5" x 11")',
        defaultColorMode: current.defaultColorMode || 'black_and_white',
        soundEnabled: current.soundEnabled ?? true,
        soundVolume: current.soundVolume ?? 80,
        selectedSoundType: current.selectedSoundType || 'default',
        customSoundFilename: current.customSoundFilename || null,
        hasCustomSound: !!current.customSoundStoredFilename,
        lastCleanupAt: current.lastCleanupAt,
        lastCleanupResult: current.lastCleanupResult,
        cleanupHistory: current.cleanupHistory || [],
      },
      cleanupStatus,
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Custom Sound Asset Directory
const SOUNDS_DIR = path.resolve(process.cwd(), 'data', 'admin-assets', 'notification-sounds');
if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

// Upload Custom Notification Sound
app.post(
  '/api/admin/settings/notification-sound',
  requireAdmin,
  upload.single('soundFile'),
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided.' });
      }

      // 1. Validate file size (max 5 MB)
      const MAX_SOUND_BYTES = 5 * 1024 * 1024;
      if (req.file.size > MAX_SOUND_BYTES) {
        return res.status(400).json({ error: 'Sound file is too large. Maximum size is 5 MB.' });
      }

      // 2. Validate file extension and MIME type
      const originalName = req.file.originalname || 'custom-sound.mp3';
      const ext = path.extname(originalName).toLowerCase().replace('.', '');
      const validExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
      const validMimePrefixes = ['audio/'];

      const isExtValid = validExtensions.includes(ext);
      const isMimeValid = validMimePrefixes.some((p) => (req.file?.mimetype || '').startsWith(p));

      if (!isExtValid && !isMimeValid) {
        return res.status(400).json({
          error: 'Unsupported audio format. Please upload an MP3, WAV, or OGG file.',
        });
      }

      // 3. Clean up previous custom sound if present
      const settings = db.getSettings();
      if (settings.customSoundStoredFilename) {
        const oldPath = path.join(SOUNDS_DIR, settings.customSoundStoredFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      // 4. Save new sound file securely
      const storedFilename = `sound_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext || 'mp3'}`;
      const destinationPath = path.join(SOUNDS_DIR, storedFilename);
      fs.writeFileSync(destinationPath, req.file.buffer);

      // 5. Update settings in DB
      const updated = db.updateSettings({
        soundEnabled: true,
        selectedSoundType: 'custom',
        customSoundFilename: originalName,
        customSoundStoredFilename: storedFilename,
      });

      res.json({
        success: true,
        message: 'Custom notification sound uploaded successfully.',
        settings: {
          soundEnabled: updated.soundEnabled ?? true,
          soundVolume: updated.soundVolume ?? 80,
          selectedSoundType: 'custom',
          customSoundFilename: originalName,
          hasCustomSound: true,
        },
      });
    } catch (err) {
      console.error('Error uploading custom notification sound:', err);
      res.status(500).json({ error: 'Failed to save custom notification sound.' });
    }
  }
);

// Serve Custom Notification Sound File
app.get('/api/admin/settings/notification-sound/file', (req: Request, res: Response) => {
  try {
    const settings = db.getSettings();
    if (!settings.customSoundStoredFilename) {
      return res.status(404).json({ error: 'No custom notification sound configured.' });
    }

    const soundPath = path.join(SOUNDS_DIR, settings.customSoundStoredFilename);
    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: 'Custom notification sound file not found.' });
    }

    const ext = path.extname(settings.customSoundStoredFilename).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.m4a') contentType = 'audio/mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(soundPath);
  } catch (err) {
    console.error('Error serving notification sound:', err);
    res.status(500).json({ error: 'Failed to serve notification sound file.' });
  }
});

// Remove Custom Notification Sound (Restore Default)
app.delete('/api/admin/settings/notification-sound', requireAdmin, (req: Request, res: Response) => {
  try {
    const settings = db.getSettings();
    if (settings.customSoundStoredFilename) {
      const oldPath = path.join(SOUNDS_DIR, settings.customSoundStoredFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
    }

    const updated = db.updateSettings({
      selectedSoundType: 'default',
      customSoundFilename: null,
      customSoundStoredFilename: null,
    });

    res.json({
      success: true,
      message: 'Restored default notification sound.',
      settings: {
        soundEnabled: updated.soundEnabled ?? true,
        soundVolume: updated.soundVolume ?? 80,
        selectedSoundType: 'default',
        customSoundFilename: null,
        hasCustomSound: false,
      },
    });
  } catch (err) {
    console.error('Error removing custom notification sound:', err);
    res.status(500).json({ error: 'Failed to remove custom notification sound.' });
  }
});

// Periodic Cleanup Status Endpoint
app.get('/api/admin/cleanup/status', requireAdmin, (req: Request, res: Response) => {
  const status = getCleanupStatus();
  res.json(status);
});

// Manual cleanup execution
app.post('/api/admin/cleanup', requireAdmin, (req: Request, res: Response) => {
  try {
    const result = executeCleanupTask('manual');
    const stats = db.getStats();
    const cleanupStatus = getCleanupStatus();

    res.json({
      success: result.status !== 'error',
      result,
      stats,
      cleanupStatus,
    });
  } catch (err) {
    console.error('Manual cleanup error:', err);
    res.status(500).json({ error: 'Failed to execute storage cleanup' });
  }
});

// ==========================================
// VITE SPA MIDDLEWARE / STATIC ASSETS
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Oyangoren Printing Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
