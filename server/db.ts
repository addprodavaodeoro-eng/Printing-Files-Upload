import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileRecord {
  id: string;
  requestId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface PrintOptions {
  paperSize: string;
  colorMode: 'black_and_white' | 'color';
  sides: 'single' | 'double';
  copies: number;
  pageRange?: string;
  binding?: string;
  notes?: string;
}

export interface FilePrintConfig {
  filename: string;
  customized: boolean;
  paperSize?: string;
  colorMode?: 'black_and_white' | 'color';
  sides?: 'single' | 'double';
  copies?: number;
  pageRange?: string;
  notes?: string;
}

export interface StaffNote {
  id: string;
  text: string;
  createdAt: string;
  author?: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  timestamp: string;
  details?: string;
}

export type RequestStatusValue =
  | 'new'
  | 'reviewing'
  | 'ready_to_print'
  | 'printing'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'
  | 'processing';

export interface RequestRecord {
  id: string;
  referenceCode: string;
  submissionId?: string | null;
  token?: string | null;
  linkId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  type: 'quick' | 'remote';
  linkType?: 'files_only' | 'files_instructions' | 'full_request';
  instructionsEnabled?: boolean;
  instructions?: string | null;
  printOptions?: PrintOptions | null;
  fileConfigs?: FilePrintConfig[];
  internalNotes?: StaffNote[];
  activityLogs?: ActivityLogEntry[];
  status: RequestStatusValue;
  createdAt: string;
}

export interface LinkRecord {
  id: string;
  token: string;
  customerName?: string | null;
  linkType: 'files_only' | 'files_instructions' | 'full_request';
  instructionsEnabled: boolean;
  expirationOption: '1h' | '24h' | '3d' | '7d' | 'custom' | 'none';
  expiresAt: string | null;
  uploadLimit: number | null;
  uploadCount: number;
  active: boolean;
  createdAt: string;
}

export interface CleanupResult {
  id: string;
  timestamp: string;
  trigger: 'auto' | 'manual';
  configuredDays: number;
  deletedRequestsCount: number;
  deletedFilesCount: number;
  orphanedFilesCount: number;
  deletedBytes: number;
  status: 'success' | 'skipped' | 'error';
  message?: string;
  durationMs: number;
}

export interface SettingsRecord {
  maxFileSizeMB: number;
  autoCleanupDays: number;
  cleanupIntervalHours: number;
  allowedExtensions: string[];
  paperSizes: string[];
  finishingOptions: string[];
  defaultPaperSize?: string;
  defaultColorMode?: 'black_and_white' | 'color';
  adminPasswordHash: string;
  adminPasswordSalt: string;
  lastCleanupAt?: string | null;
  lastCleanupResult?: CleanupResult | null;
  cleanupHistory?: CleanupResult[];
}

export interface DatabaseSchema {
  requests: RequestRecord[];
  files: FileRecord[];
  links: LinkRecord[];
  sessions: { token: string; createdAt: string; expiresAt: string }[];
  settings: SettingsRecord;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

function getDefaultSettings(): SettingsRecord {
  const initialPassword = process.env.ADMIN_PASSWORD || 'admin';
  const { hash, salt } = hashPassword(initialPassword);
  return {
    maxFileSizeMB: 50,
    autoCleanupDays: 0,
    cleanupIntervalHours: 1,
    allowedExtensions: [
      'pdf',
      'doc',
      'docx',
      'ppt',
      'pptx',
      'xls',
      'xlsx',
      'jpg',
      'jpeg',
      'png',
      'txt',
    ],
    paperSizes: [
      'Short Bond (8.5" x 11")',
      'Long Bond (8.5" x 13")',
      'A4 (8.27" x 11.69")',
      'A3 (11.7" x 16.5")',
    ],
    finishingOptions: [
      'None / Loose Sheets',
      'Stapled (Top Left)',
      'Stapled (Booklet)',
      'Ring Bound (Coil)',
      'Folder / Fastener',
    ],
    defaultPaperSize: 'Short Bond (8.5" x 11")',
    defaultColorMode: 'black_and_white',
    adminPasswordHash: hash,
    adminPasswordSalt: salt,
    lastCleanupAt: null,
    lastCleanupResult: null,
    cleanupHistory: [],
  };
}

function loadDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw) as DatabaseSchema;
      if (!data.requests) data.requests = [];
      if (!data.files) data.files = [];
      if (!data.links) data.links = [];
      if (!data.sessions) data.sessions = [];
      if (!data.settings) {
        data.settings = getDefaultSettings();
      } else {
        if (data.settings.cleanupIntervalHours === undefined) {
          data.settings.cleanupIntervalHours = 1;
        }
        if (!data.settings.cleanupHistory) {
          data.settings.cleanupHistory = [];
        }
        if (!data.settings.paperSizes || !Array.isArray(data.settings.paperSizes)) {
          data.settings.paperSizes = [
            'Short Bond (8.5" x 11")',
            'Long Bond (8.5" x 13")',
            'A4 (8.27" x 11.69")',
            'A3 (11.7" x 16.5")',
          ];
        }
        if (!data.settings.finishingOptions || !Array.isArray(data.settings.finishingOptions)) {
          data.settings.finishingOptions = [
            'None / Loose Sheets',
            'Stapled (Top Left)',
            'Stapled (Booklet)',
            'Ring Bound (Coil)',
            'Folder / Fastener',
          ];
        }
      }

      // Migrations / data consistency checks
      for (const req of data.requests) {
        if (!req.internalNotes) {
          req.internalNotes = [];
        }
        if (!req.activityLogs || !Array.isArray(req.activityLogs)) {
          req.activityLogs = [
            {
              id: 'act_init_' + req.id,
              action: 'Request received and logged in system',
              timestamp: req.createdAt || new Date().toISOString(),
            },
          ];
        }
      }

      for (const link of data.links) {
        if (!link.linkType) {
          link.linkType = link.instructionsEnabled ? 'files_instructions' : 'files_only';
        }
      }

      return data;
    }
  } catch (err) {
    console.error('Error reading db.json, initializing fresh database:', err);
  }

  const initial: DatabaseSchema = {
    requests: [],
    files: [],
    links: [],
    sessions: [],
    settings: getDefaultSettings(),
  };
  saveDB(initial);
  return initial;
}

function saveDB(db: DatabaseSchema) {
  try {
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving db.json:', err);
    throw err;
  }
}

// In-memory reference that stays synchronized
let currentDB = loadDB();

export const db = {
  getRaw(): DatabaseSchema {
    return currentDB;
  },

  reload(): DatabaseSchema {
    currentDB = loadDB();
    return currentDB;
  },

  save() {
    saveDB(currentDB);
  },

  // Requests
  getAllRequests(): (RequestRecord & { files: FileRecord[]; fileCount: number; totalSize: number })[] {
    return currentDB.requests
      .map((req) => {
        const reqFiles = currentDB.files.filter((f) => f.requestId === req.id);
        const totalSize = reqFiles.reduce((acc, f) => acc + f.fileSize, 0);
        return {
          ...req,
          files: reqFiles,
          fileCount: reqFiles.length,
          totalSize,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getRequestById(id: string): (RequestRecord & { files: FileRecord[]; fileCount: number; totalSize: number }) | null {
    const req = currentDB.requests.find((r) => r.id === id);
    if (!req) return null;
    const reqFiles = currentDB.files.filter((f) => f.requestId === req.id);
    const totalSize = reqFiles.reduce((acc, f) => acc + f.fileSize, 0);
    return {
      ...req,
      files: reqFiles,
      fileCount: reqFiles.length,
      totalSize,
    };
  },

  getRequestByReference(refCode: string): (RequestRecord & { files: FileRecord[]; fileCount: number; totalSize: number }) | null {
    const clean = refCode.trim().toUpperCase();
    const req = currentDB.requests.find((r) => r.referenceCode.toUpperCase() === clean);
    if (!req) return null;
    const reqFiles = currentDB.files.filter((f) => f.requestId === req.id);
    const totalSize = reqFiles.reduce((acc, f) => acc + f.fileSize, 0);
    return {
      ...req,
      files: reqFiles,
      fileCount: reqFiles.length,
      totalSize,
    };
  },

  getRequestBySubmissionId(submissionId: string): (RequestRecord & { files: FileRecord[]; fileCount: number; totalSize: number }) | null {
    if (!submissionId) return null;
    const req = currentDB.requests.find((r) => r.submissionId === submissionId);
    if (!req) return null;
    const reqFiles = currentDB.files.filter((f) => f.requestId === req.id);
    const totalSize = reqFiles.reduce((acc, f) => acc + f.fileSize, 0);
    return {
      ...req,
      files: reqFiles,
      fileCount: reqFiles.length,
      totalSize,
    };
  },

  createRequest(params: {
    customerName?: string | null;
    customerPhone?: string | null;
    type: 'quick' | 'remote';
    linkType?: 'files_only' | 'files_instructions' | 'full_request';
    token?: string | null;
    linkId?: string | null;
    submissionId?: string | null;
    instructionsEnabled?: boolean;
    instructions?: string | null;
    printOptions?: PrintOptions | null;
    fileConfigs?: FilePrintConfig[];
  }): RequestRecord {
    // Generate unique human-readable reference code like OY-4821 avoiding any duplicate
    let referenceCode = '';
    let attempts = 0;
    do {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      referenceCode = `OY-${randNum}`;
      attempts++;
    } while (currentDB.requests.some((r) => r.referenceCode === referenceCode) && attempts < 1000);

    const id = `req_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const activityLogs: ActivityLogEntry[] = [
      {
        id: `act_${crypto.randomBytes(4).toString('hex')}`,
        action: 'Request received and placed into queue',
        timestamp: now,
      },
    ];

    const newReq: RequestRecord = {
      id,
      referenceCode,
      submissionId: params.submissionId?.trim() || null,
      customerName: params.customerName?.trim() || null,
      customerPhone: params.customerPhone?.trim() || null,
      type: params.type,
      linkType: params.linkType || (params.type === 'quick' ? undefined : (params.instructionsEnabled ? 'files_instructions' : 'files_only')),
      token: params.token || null,
      linkId: params.linkId || null,
      instructionsEnabled: params.instructionsEnabled ?? false,
      instructions: params.instructions?.trim() || null,
      printOptions: params.printOptions || null,
      fileConfigs: params.fileConfigs || [],
      internalNotes: [],
      activityLogs,
      status: 'new',
      createdAt: now,
    };

    currentDB.requests.push(newReq);
    saveDB(currentDB);
    return newReq;
  },

  updateRequestStatus(
    id: string,
    status: RequestStatusValue,
    actor?: string,
    note?: string
  ): boolean {
    const req = currentDB.requests.find((r) => r.id === id);
    if (!req) return false;

    const oldStatus = req.status;
    req.status = status;

    if (!req.activityLogs) {
      req.activityLogs = [];
    }

    const statusLabels: Record<string, string> = {
      new: 'New Request',
      reviewing: 'Under Review',
      ready_to_print: 'Ready to Print',
      printing: 'Printing',
      ready_for_pickup: 'Ready for Pickup',
      completed: 'Completed',
      cancelled: 'Cancelled',
      processing: 'Processing',
    };

    const actionText = `Status changed to ${statusLabels[status] || status}`;
    let details = actor ? `Updated by ${actor}` : undefined;
    if (note) {
      details = details ? `${details} — ${note}` : note;
    }

    req.activityLogs.push({
      id: `act_${crypto.randomBytes(4).toString('hex')}`,
      action: actionText,
      timestamp: new Date().toISOString(),
      details,
    });

    saveDB(currentDB);
    return true;
  },

  bulkUpdateStatus(ids: string[], status: RequestStatusValue, actor?: string): number {
    let updatedCount = 0;
    const now = new Date().toISOString();
    const statusLabels: Record<string, string> = {
      new: 'New Request',
      reviewing: 'Under Review',
      ready_to_print: 'Ready to Print',
      printing: 'Printing',
      ready_for_pickup: 'Ready for Pickup',
      completed: 'Completed',
      cancelled: 'Cancelled',
      processing: 'Processing',
    };

    for (const id of ids) {
      const req = currentDB.requests.find((r) => r.id === id);
      if (req) {
        req.status = status;
        if (!req.activityLogs) req.activityLogs = [];
        req.activityLogs.push({
          id: `act_${crypto.randomBytes(4).toString('hex')}`,
          action: `Status changed to ${statusLabels[status] || status} (Bulk Action)`,
          timestamp: now,
          details: actor ? `Updated by ${actor}` : undefined,
        });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      saveDB(currentDB);
    }
    return updatedCount;
  },

  addStaffNote(requestId: string, text: string, author?: string): StaffNote | null {
    const req = currentDB.requests.find((r) => r.id === requestId);
    if (!req) return null;

    if (!req.internalNotes) {
      req.internalNotes = [];
    }

    const newNote: StaffNote = {
      id: `note_${crypto.randomBytes(6).toString('hex')}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      author: author || 'Admin',
    };

    req.internalNotes.unshift(newNote);

    if (!req.activityLogs) req.activityLogs = [];
    req.activityLogs.push({
      id: `act_${crypto.randomBytes(4).toString('hex')}`,
      action: 'Staff note added',
      timestamp: new Date().toISOString(),
      details: author ? `Added by ${author}` : undefined,
    });

    saveDB(currentDB);
    return newNote;
  },

  deleteStaffNote(requestId: string, noteId: string): boolean {
    const req = currentDB.requests.find((r) => r.id === requestId);
    if (!req || !req.internalNotes) return false;

    const idx = req.internalNotes.findIndex((n) => n.id === noteId);
    if (idx === -1) return false;

    req.internalNotes.splice(idx, 1);
    saveDB(currentDB);
    return true;
  },

  deleteRequest(id: string): { success: boolean; deletedFiles: FileRecord[] } {
    const reqIndex = currentDB.requests.findIndex((r) => r.id === id);
    if (reqIndex === -1) return { success: false, deletedFiles: [] };

    currentDB.requests.splice(reqIndex, 1);
    const deletedFiles = currentDB.files.filter((f) => f.requestId === id);
    currentDB.files = currentDB.files.filter((f) => f.requestId !== id);

    saveDB(currentDB);
    return { success: true, deletedFiles };
  },

  bulkDeleteRequests(ids: string[]): { deletedRequestsCount: number; deletedFiles: FileRecord[] } {
    const targetSet = new Set(ids);
    const deletedFiles: FileRecord[] = [];
    const remainingRequests: RequestRecord[] = [];
    let deletedCount = 0;

    for (const req of currentDB.requests) {
      if (targetSet.has(req.id)) {
        deletedCount++;
        const filesForReq = currentDB.files.filter((f) => f.requestId === req.id);
        deletedFiles.push(...filesForReq);
      } else {
        remainingRequests.push(req);
      }
    }

    currentDB.requests = remainingRequests;
    currentDB.files = currentDB.files.filter((f) => !targetSet.has(f.requestId));

    if (deletedCount > 0) {
      saveDB(currentDB);
    }

    return { deletedRequestsCount: deletedCount, deletedFiles };
  },

  // Files
  getAllFiles(): FileRecord[] {
    return [...currentDB.files];
  },

  addFiles(files: Omit<FileRecord, 'id' | 'createdAt'>[]): FileRecord[] {
    const created: FileRecord[] = files.map((f) => ({
      ...f,
      id: `file_${crypto.randomBytes(8).toString('hex')}`,
      createdAt: new Date().toISOString(),
    }));

    currentDB.files.push(...created);
    saveDB(currentDB);
    return created;
  },

  getFileById(id: string): FileRecord | null {
    return currentDB.files.find((f) => f.id === id) || null;
  },

  deleteFileById(id: string): FileRecord | null {
    const index = currentDB.files.findIndex((f) => f.id === id);
    if (index === -1) return null;
    const [deleted] = currentDB.files.splice(index, 1);
    saveDB(currentDB);
    return deleted;
  },

  // Links
  getAllLinks(): LinkRecord[] {
    return [...currentDB.links].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getLinkByToken(token: string): LinkRecord | null {
    return currentDB.links.find((l) => l.token === token) || null;
  },

  createLink(params: {
    customerName?: string | null;
    linkType?: 'files_only' | 'files_instructions' | 'full_request';
    instructionsEnabled?: boolean;
    expirationOption: '1h' | '24h' | '3d' | '7d' | 'custom' | 'none';
    customExpiresAt?: string | null;
    uploadLimit?: number | null;
    active?: boolean;
  }): LinkRecord {
    const token = crypto.randomBytes(16).toString('hex');
    const id = `link_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date();

    let expiresAt: string | null = null;
    if (params.expirationOption === '1h') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (params.expirationOption === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (params.expirationOption === '3d') {
      expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (params.expirationOption === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (params.expirationOption === 'custom' && params.customExpiresAt) {
      expiresAt = new Date(params.customExpiresAt).toISOString();
    } else {
      expiresAt = null; // no expiration
    }

    const resolvedLinkType = params.linkType || (params.instructionsEnabled ? 'files_instructions' : 'files_only');
    const instructionsEnabled = resolvedLinkType !== 'files_only';

    const newLink: LinkRecord = {
      id,
      token,
      customerName: params.customerName?.trim() || null,
      linkType: resolvedLinkType,
      instructionsEnabled,
      expirationOption: params.expirationOption,
      expiresAt,
      uploadLimit: params.uploadLimit !== undefined ? params.uploadLimit : null,
      uploadCount: 0,
      active: params.active ?? true,
      createdAt: now.toISOString(),
    };

    currentDB.links.push(newLink);
    saveDB(currentDB);
    return newLink;
  },

  incrementLinkUploadCount(token: string): void {
    const link = currentDB.links.find((l) => l.token === token);
    if (link) {
      link.uploadCount = (link.uploadCount || 0) + 1;
      saveDB(currentDB);
    }
  },

  updateLink(id: string, updates: Partial<LinkRecord>): LinkRecord | null {
    const link = currentDB.links.find((l) => l.id === id);
    if (!link) return null;
    Object.assign(link, updates);
    saveDB(currentDB);
    return link;
  },

  deleteLink(id: string): boolean {
    const idx = currentDB.links.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    currentDB.links.splice(idx, 1);
    saveDB(currentDB);
    return true;
  },

  // Sessions
  createSession(durationHours = 48): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

    // Prune expired sessions
    currentDB.sessions = currentDB.sessions.filter((s) => new Date(s.expiresAt).getTime() > now.getTime());
    currentDB.sessions.push({ token, createdAt: now.toISOString(), expiresAt });
    saveDB(currentDB);
    return token;
  },

  validateSession(token?: string | null): boolean {
    if (!token) return false;
    const session = currentDB.sessions.find((s) => s.token === token);
    if (!session) return false;
    const isValid = new Date(session.expiresAt).getTime() > Date.now();
    if (!isValid) {
      currentDB.sessions = currentDB.sessions.filter((s) => s.token !== token);
      saveDB(currentDB);
    }
    return isValid;
  },

  revokeSession(token: string): void {
    currentDB.sessions = currentDB.sessions.filter((s) => s.token !== token);
    saveDB(currentDB);
  },

  pruneExpiredSessions(): number {
    const now = Date.now();
    const beforeCount = currentDB.sessions.length;
    currentDB.sessions = currentDB.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
    const removed = beforeCount - currentDB.sessions.length;
    if (removed > 0) {
      saveDB(currentDB);
    }
    return removed;
  },

  // Settings
  getSettings(): SettingsRecord {
    return currentDB.settings;
  },

  updateSettings(updates: Partial<SettingsRecord>): SettingsRecord {
    Object.assign(currentDB.settings, updates);
    saveDB(currentDB);
    return currentDB.settings;
  },

  recordCleanupResult(result: CleanupResult): void {
    currentDB.settings.lastCleanupAt = result.timestamp;
    currentDB.settings.lastCleanupResult = result;
    if (!currentDB.settings.cleanupHistory) {
      currentDB.settings.cleanupHistory = [];
    }
    // Prepend and keep latest 15 entries
    currentDB.settings.cleanupHistory = [result, ...currentDB.settings.cleanupHistory.slice(0, 14)];
    saveDB(currentDB);
  },

  updateAdminPassword(newPassword: string): void {
    const { hash, salt } = hashPassword(newPassword);
    currentDB.settings.adminPasswordHash = hash;
    currentDB.settings.adminPasswordSalt = salt;
    // Invalidate all current sessions for security
    currentDB.sessions = [];
    saveDB(currentDB);
  },

  // Stats
  getStats() {
    const totalRequests = currentDB.requests.length;
    const newRequests = currentDB.requests.filter((r) => r.status === 'new').length;
    const reviewingRequests = currentDB.requests.filter((r) => r.status === 'reviewing').length;
    const readyToPrintRequests = currentDB.requests.filter((r) => r.status === 'ready_to_print').length;
    const printingRequests = currentDB.requests.filter((r) => r.status === 'printing').length;
    const readyForPickupRequests = currentDB.requests.filter((r) => r.status === 'ready_for_pickup').length;
    const completedRequests = currentDB.requests.filter((r) => r.status === 'completed').length;
    const cancelledRequests = currentDB.requests.filter((r) => r.status === 'cancelled').length;
    const processingRequests = currentDB.requests.filter((r) => r.status === 'processing').length;
    const activePrintQueue = currentDB.requests.filter(
      (r) => r.status !== 'completed' && r.status !== 'cancelled'
    ).length;

    const totalFiles = currentDB.files.length;
    const totalStorageBytes = currentDB.files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    const activeLinks = currentDB.links.filter((l) => {
      if (!l.active) return false;
      if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return false;
      if (l.uploadLimit !== null && l.uploadCount >= l.uploadLimit) return false;
      return true;
    }).length;

    return {
      totalRequests,
      newRequests,
      reviewingRequests,
      readyToPrintRequests,
      printingRequests,
      readyForPickupRequests,
      completedRequests,
      cancelledRequests,
      processingRequests,
      activePrintQueue,
      totalFiles,
      totalStorageBytes,
      activeLinks,
      lastCleanupAt: currentDB.settings.lastCleanupAt || null,
      lastCleanupResult: currentDB.settings.lastCleanupResult || null,
    };
  },
};
