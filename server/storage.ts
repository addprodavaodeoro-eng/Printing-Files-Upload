import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as archiverModule from 'archiver';
const archiver: any = (archiverModule as any).default || archiverModule;
import { Response } from 'express';
import { db, FileRecord, RequestRecord } from './db';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Map of allowed extensions to MIME types
export const ALLOWED_FORMATS: Record<string, { mimes: string[]; label: string }> = {
  pdf: {
    mimes: ['application/pdf'],
    label: 'PDF Document',
  },
  doc: {
    mimes: ['application/msword'],
    label: 'Word 97-2003 Document',
  },
  docx: {
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
    ],
    label: 'Word Document',
  },
  ppt: {
    mimes: ['application/vnd.ms-powerpoint'],
    label: 'PowerPoint 97-2003',
  },
  pptx: {
    mimes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
    ],
    label: 'PowerPoint Presentation',
  },
  xls: {
    mimes: ['application/vnd.ms-excel'],
    label: 'Excel 97-2003',
  },
  xlsx: {
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ],
    label: 'Excel Spreadsheet',
  },
  jpg: {
    mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    label: 'JPEG Image',
  },
  jpeg: {
    mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    label: 'JPEG Image',
  },
  png: {
    mimes: ['image/png'],
    label: 'PNG Image',
  },
  txt: {
    mimes: ['text/plain'],
    label: 'Text Document',
  },
};

/**
 * Validates file signature (magic numbers) to prevent extension-spoofing attacks
 */
export function validateFileBuffer(buffer: Buffer, ext: string): { valid: boolean; reason?: string } {
  const extension = ext.toLowerCase().replace(/^\./, '');
  const settings = db.getSettings();

  if (!settings.allowedExtensions.includes(extension)) {
    return { valid: false, reason: `File extension .${extension} is not supported.` };
  }

  if (buffer.length === 0) {
    return { valid: false, reason: 'File is empty.' };
  }

  // Check magic bytes
  if (extension === 'pdf') {
    // Starts with %PDF (0x25 0x50 0x44 0x46)
    if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
      return { valid: false, reason: 'Invalid or corrupt PDF file signature.' };
    }
  } else if (extension === 'jpg' || extension === 'jpeg') {
    // Starts with FF D8 FF
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      return { valid: false, reason: 'Invalid or corrupt JPEG image.' };
    }
  } else if (extension === 'png') {
    // Starts with 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length < 8 ||
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      return { valid: false, reason: 'Invalid or corrupt PNG image.' };
    }
  } else if (['docx', 'pptx', 'xlsx'].includes(extension)) {
    // OpenXML files are ZIP archives starting with PK (0x50 0x4B 0x03 0x04 or 0x05 0x06)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return { valid: false, reason: `Invalid or corrupt ${extension.toUpperCase()} document signature.` };
    }
  } else if (['doc', 'ppt', 'xls'].includes(extension)) {
    // OLE Compound File Binary format: D0 CF 11 E0 A1 B1 1A E1
    if (
      buffer.length < 8 ||
      buffer[0] !== 0xd0 ||
      buffer[1] !== 0xcf ||
      buffer[2] !== 0x11 ||
      buffer[3] !== 0xe0
    ) {
      return { valid: false, reason: `Invalid legacy MS Office ${extension.toUpperCase()} file header.` };
    }
  }

  return { valid: true };
}

/**
 * Saves an uploaded file buffer to private disk storage
 */
export function saveFileToStorage(
  originalName: string,
  buffer: Buffer,
  mimeType: string
): { storedFilename: string; fileSize: number } {
  const ext = path.extname(originalName).toLowerCase();
  const safeRandom = crypto.randomBytes(16).toString('hex');
  const storedFilename = `${Date.now()}_${safeRandom}${ext}`;
  const filePath = path.join(UPLOADS_DIR, storedFilename);

  fs.writeFileSync(filePath, buffer);
  return {
    storedFilename,
    fileSize: buffer.length,
  };
}

/**
 * Removes a file safely from disk
 */
export function deleteFileFromDisk(storedFilename: string): boolean {
  try {
    const safePath = path.join(UPLOADS_DIR, path.basename(storedFilename));
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
      return true;
    }
  } catch (err) {
    console.error(`Failed to delete file ${storedFilename}:`, err);
  }
  return false;
}

/**
 * Streams a single file to client with secure Content-Disposition
 */
export function streamFileDownload(file: FileRecord, res: Response): void {
  const safePath = path.join(UPLOADS_DIR, path.basename(file.storedFilename));

  if (!fs.existsSync(safePath)) {
    res.status(404).json({ error: 'File not found on storage server' });
    return;
  }

  // Sanitize original filename for header
  const cleanName = file.originalFilename.replace(/["\r\n\\]/g, '_');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanName)}"`);
  res.setHeader('Content-Length', file.fileSize);

  const fileStream = fs.createReadStream(safePath);
  fileStream.pipe(res);
}

/**
 * Streams a single file for in-browser preview (PDF, PNG, JPG, JPEG)
 */
export function streamFilePreview(file: FileRecord, res: Response): void {
  const safePath = path.join(UPLOADS_DIR, path.basename(file.storedFilename));

  if (!fs.existsSync(safePath)) {
    res.status(404).json({ error: 'File not found on storage server' });
    return;
  }

  const cleanName = file.originalFilename.replace(/["\r\n\\]/g, '_');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(cleanName)}"`
  );
  res.setHeader('Content-Length', file.fileSize);

  const fileStream = fs.createReadStream(safePath);
  fileStream.pipe(res);
}

function createZipArchive(options: any = { zlib: { level: 6 } }) {
  let mod: any = archiverModule;
  if (mod.default) mod = mod.default;
  if (typeof mod === 'function') return mod('zip', options);
  if (typeof mod.create === 'function') return mod.create('zip', options);
  if (mod.ZipArchive) return new mod.ZipArchive(options);
  if (archiverModule && (archiverModule as any).ZipArchive) {
    return new (archiverModule as any).ZipArchive(options);
  }
  throw new Error('Unable to initialize ZIP archive engine.');
}

function sanitizeZipEntryName(rawName: string): string {
  if (!rawName) return 'unnamed-file';
  let name = rawName.replace(/[\/\\]+/g, '_').replace(/\.\./g, '_');
  name = name.replace(/[\x00-\x1F\x7F]/g, '');
  if (!name.trim()) name = 'file';
  return name;
}

/**
 * Bundles all files belonging to a request into a ZIP and streams it
 */
export function streamRequestZip(
  reqRecord: RequestRecord & { files: FileRecord[] },
  res: Response
): void {
  try {
    if (!reqRecord || !Array.isArray(reqRecord.files) || reqRecord.files.length === 0) {
      res.status(400).json({
        error: 'ZIP_GENERATION_FAILED',
        message: 'No files available in this print request.',
      });
      return;
    }

    const fileCheckResults = reqRecord.files.map((file) => {
      const safePath = path.join(UPLOADS_DIR, path.basename(file.storedFilename));
      const exists = fs.existsSync(safePath);
      return { file, safePath, exists };
    });

    const availableFiles = fileCheckResults.filter((item) => item.exists);

    if (availableFiles.length === 0) {
      res.status(404).json({
        error: 'ZIP_GENERATION_FAILED',
        message: 'None of the requested files could be found on the storage server.',
      });
      return;
    }

    let zipName = `${reqRecord.referenceCode}_Files.zip`;
    if (reqRecord.customerName && reqRecord.customerName.trim()) {
      const cleanCustomer = reqRecord.customerName
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanCustomer) {
        zipName = `${reqRecord.referenceCode}_${cleanCustomer}.zip`;
      }
    }

    const cleanHeaderZipName = zipName.replace(/["\r\n\\]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cleanHeaderZipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`
    );

    const archive = createZipArchive({ zlib: { level: 6 } });

    archive.on('error', (err: unknown) => {
      console.error('Archiver error streaming ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'ZIP_STREAM_ERROR',
          message: 'An error occurred while generating the ZIP archive.',
        });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    const usedNames = new Set<string>();

    for (const item of availableFiles) {
      const file = item.file;
      const cleanName = sanitizeZipEntryName(file.originalFilename);
      let entryName = cleanName;
      let counter = 1;

      while (usedNames.has(entryName)) {
        const ext = path.extname(cleanName);
        const base = path.basename(cleanName, ext);
        entryName = `${base} (${counter})${ext}`;
        counter++;
      }

      usedNames.add(entryName);
      archive.file(item.safePath, { name: entryName });
    }

    const missingFiles = fileCheckResults.filter((item) => !item.exists);

    const summaryLines = [
      `OYANGOREN PRINTING SERVICES – PRINT ORDER SUMMARY`,
      `================================================`,
      `Reference Code: ${reqRecord.referenceCode}`,
      `Order Date: ${new Date(reqRecord.createdAt).toLocaleString()}`,
      `Customer: ${reqRecord.customerName || 'Walk-in Customer'}`,
      `Order Type: ${reqRecord.type === 'quick' ? 'Walk-in Quick Upload' : 'Remote Upload Link'}`,
      `Status: ${reqRecord.status.toUpperCase()}`,
      ``,
      `PRINTING INSTRUCTIONS:`,
      reqRecord.instructions || '(No special instructions provided)',
      ``,
      `INCLUDED FILES (${availableFiles.length}):`,
      ...availableFiles.map(
        (item, i) => `${i + 1}. ${item.file.originalFilename} (${(item.file.fileSize / 1024).toFixed(1)} KB)`
      ),
    ];

    if (missingFiles.length > 0) {
      summaryLines.push(
        ``,
        `WARNING - UNRESOLVED/MISSING FILES (${missingFiles.length}):`,
        ...missingFiles.map((item, i) => `${i + 1}. ${item.file.originalFilename} (File not found on server storage)`)
      );
    }

    summaryLines.push(
      ``,
      `================================================`,
      `Oyangoren Printing Services`
    );

    archive.append(summaryLines.join('\n'), {
      name: `PRINT_INSTRUCTIONS_${reqRecord.referenceCode}.txt`,
    });

    archive.finalize();
  } catch (err: any) {
    console.error('Exception in streamRequestZip:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'ZIP_GENERATION_FAILED',
        message: err?.message || 'Failed to initialize ZIP archive stream.',
      });
    }
  }
}

/**
 * Runs automatic cleanup of requests older than given days
 */
export function runAutoCleanup(days: number): { deletedCount: number; deletedBytes: number } {
  if (days <= 0) return { deletedCount: 0, deletedBytes: 0 };

  const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const requests = db.getAllRequests();
  let deletedCount = 0;
  let deletedBytes = 0;

  for (const req of requests) {
    const reqDate = new Date(req.createdAt).getTime();
    if (reqDate < thresholdMs) {
      const { deletedFiles } = db.deleteRequest(req.id);
      for (const file of deletedFiles) {
        deletedBytes += file.fileSize || 0;
        deleteFileFromDisk(file.storedFilename);
      }
      deletedCount++;
    }
  }

  db.updateSettings({ lastCleanupAt: new Date().toISOString() });
  return { deletedCount, deletedBytes };
}
