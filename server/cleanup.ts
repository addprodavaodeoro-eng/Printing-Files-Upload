import fs from 'fs';
import path from 'path';
import { db, CleanupResult } from './db';
import { UPLOADS_DIR, deleteFileFromDisk } from './storage';

export interface CleanupStatus {
  enabled: boolean;
  autoCleanupDays: number;
  cleanupIntervalHours: number;
  isRunning: boolean;
  nextRunTimestamp: string | null;
  lastCleanupAt: string | null;
  lastCleanupResult: CleanupResult | null;
  cleanupHistory: CleanupResult[];
}

let intervalTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;
let nextRunTimestamp: string | null = null;
let isCleanupRunning = false;

/**
 * Executes a full storage and database scan to delete files older than configured days
 */
export function executeCleanupTask(trigger: 'auto' | 'manual' = 'auto'): CleanupResult {
  if (isCleanupRunning) {
    const settings = db.getSettings();
    return {
      id: `cln_${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      configuredDays: settings.autoCleanupDays,
      deletedRequestsCount: 0,
      deletedFilesCount: 0,
      orphanedFilesCount: 0,
      deletedBytes: 0,
      status: 'skipped',
      message: 'A storage cleanup scan is already in progress.',
      durationMs: 0,
    };
  }

  isCleanupRunning = true;
  const startTime = Date.now();

  try {
    const settings = db.getSettings();
    const days = settings.autoCleanupDays;

    // If auto cleanup is disabled (0 days)
    if (days <= 0) {
      // Still prune expired sessions for hygiene
      db.pruneExpiredSessions();

      const result: CleanupResult = {
        id: `cln_${Date.now()}`,
        timestamp: new Date().toISOString(),
        trigger,
        configuredDays: 0,
        deletedRequestsCount: 0,
        deletedFilesCount: 0,
        orphanedFilesCount: 0,
        deletedBytes: 0,
        status: 'skipped',
        message: 'Automatic cleanup is disabled in settings (retention set to 0 days).',
        durationMs: Date.now() - startTime,
      };

      if (trigger === 'manual') {
        db.recordCleanupResult(result);
      }
      return result;
    }

    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedRequestsCount = 0;
    let deletedFilesCount = 0;
    let orphanedFilesCount = 0;
    let deletedBytes = 0;

    console.log(
      `[Storage Cleanup] Starting ${trigger} scan: retention = ${days} days (cutoff: ${new Date(cutoffMs).toISOString()})`
    );

    // 1. Scan and purge requests older than cutoffMs
    const allRequests = db.getAllRequests();
    for (const req of allRequests) {
      const reqCreatedAt = new Date(req.createdAt).getTime();
      if (reqCreatedAt < cutoffMs) {
        const { success, deletedFiles } = db.deleteRequest(req.id);
        if (success) {
          deletedRequestsCount++;
          for (const file of deletedFiles) {
            deletedFilesCount++;
            deletedBytes += file.fileSize || 0;
            deleteFileFromDisk(file.storedFilename);
          }
        }
      }
    }

    // 2. Scan individual DB files in case of unlinked/orphaned file records
    const allDbFiles = db.getAllFiles();
    for (const file of allDbFiles) {
      const fileCreatedAt = new Date(file.createdAt).getTime();
      if (fileCreatedAt < cutoffMs) {
        db.deleteFileById(file.id);
        deleteFileFromDisk(file.storedFilename);
        deletedFilesCount++;
        deletedBytes += file.fileSize || 0;
      }
    }

    // 3. Scan physical disk in UPLOADS_DIR for unreferenced or stale orphaned files
    const remainingDbFiles = db.getAllFiles();
    const activeFilenames = new Set(remainingDbFiles.map((f) => path.basename(f.storedFilename)));

    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const diskFiles = fs.readdirSync(UPLOADS_DIR);
        for (const diskFile of diskFiles) {
          if (diskFile.startsWith('.')) continue; // ignore hidden files like .gitkeep

          const filePath = path.join(UPLOADS_DIR, diskFile);
          try {
            const stats = fs.statSync(filePath);
            if (stats.isFile() && !activeFilenames.has(diskFile)) {
              // Stale orphan on disk: if older than cutoffMs OR older than 6 hours
              const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
              const orphanThreshold = Math.min(cutoffMs, sixHoursAgo);

              if (stats.mtimeMs < orphanThreshold) {
                fs.unlinkSync(filePath);
                orphanedFilesCount++;
                deletedBytes += stats.size;
              }
            }
          } catch (fileErr) {
            console.warn(`[Storage Cleanup] Could not inspect file ${diskFile}:`, fileErr);
          }
        }
      }
    } catch (dirErr) {
      console.error('[Storage Cleanup] Error scanning uploads directory:', dirErr);
    }

    // 4. Prune expired sessions
    db.pruneExpiredSessions();

    const durationMs = Date.now() - startTime;
    const totalFilesRemoved = deletedFilesCount + orphanedFilesCount;
    const mbFreed = (deletedBytes / (1024 * 1024)).toFixed(2);

    const message =
      totalFilesRemoved > 0
        ? `Cleaned ${totalFilesRemoved} file(s) (${mbFreed} MB) from ${deletedRequestsCount} request(s) older than ${days} day(s).`
        : `Scan complete: No files or requests older than ${days} day(s) found. Storage is clean.`;

    const result: CleanupResult = {
      id: `cln_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      trigger,
      configuredDays: days,
      deletedRequestsCount,
      deletedFilesCount,
      orphanedFilesCount,
      deletedBytes,
      status: 'success',
      message,
      durationMs,
    };

    db.recordCleanupResult(result);

    console.log(`[Storage Cleanup] Completed: ${message} (took ${durationMs}ms)`);
    return result;
  } catch (err: any) {
    console.error('[Storage Cleanup] Error during scan:', err);
    const durationMs = Date.now() - startTime;
    const errorResult: CleanupResult = {
      id: `cln_${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      configuredDays: db.getSettings().autoCleanupDays,
      deletedRequestsCount: 0,
      deletedFilesCount: 0,
      orphanedFilesCount: 0,
      deletedBytes: 0,
      status: 'error',
      message: err?.message || 'Unexpected error occurred during storage cleanup.',
      durationMs,
    };
    db.recordCleanupResult(errorResult);
    return errorResult;
  } finally {
    isCleanupRunning = false;
  }
}

/**
 * Computes and schedules the next periodic cleanup run
 */
function scheduleNextRun(): void {
  const settings = db.getSettings();
  const intervalHours = Math.max(1, settings.cleanupIntervalHours || 1);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  nextRunTimestamp = new Date(Date.now() + intervalMs).toISOString();

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  intervalTimer = setInterval(() => {
    try {
      executeCleanupTask('auto');
    } catch (err) {
      console.error('[Storage Cleanup] Uncaught interval error:', err);
    } finally {
      const nextHours = Math.max(1, db.getSettings().cleanupIntervalHours || 1);
      nextRunTimestamp = new Date(Date.now() + nextHours * 60 * 60 * 1000).toISOString();
    }
  }, intervalMs);

  console.log(
    `[Storage Cleanup] Periodic task scheduled every ${intervalHours}h. Next scan at: ${nextRunTimestamp}`
  );
}

/**
 * Initializes the periodic background cleanup task
 */
export function startPeriodicCleanup(): void {
  // Clear any existing timer
  stopPeriodicCleanup();

  // Setup periodic interval
  scheduleNextRun();

  // Run an initial scan shortly after startup (30 seconds)
  initialTimer = setTimeout(() => {
    try {
      console.log('[Storage Cleanup] Running startup maintenance scan...');
      executeCleanupTask('auto');
    } catch (err) {
      console.error('[Storage Cleanup] Initial startup scan failed:', err);
    }
  }, 30000);
}

/**
 * Stops all background timers
 */
export function stopPeriodicCleanup(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  nextRunTimestamp = null;
}

/**
 * Restarts the background task (e.g. when user changes retention days or interval in Settings)
 */
export function restartPeriodicCleanup(): void {
  stopPeriodicCleanup();
  startPeriodicCleanup();
}

/**
 * Returns current health and configuration of the background cleanup task
 */
export function getCleanupStatus(): CleanupStatus {
  const settings = db.getSettings();
  return {
    enabled: settings.autoCleanupDays > 0,
    autoCleanupDays: settings.autoCleanupDays,
    cleanupIntervalHours: settings.cleanupIntervalHours || 1,
    isRunning: isCleanupRunning,
    nextRunTimestamp,
    lastCleanupAt: settings.lastCleanupAt || null,
    lastCleanupResult: settings.lastCleanupResult || null,
    cleanupHistory: settings.cleanupHistory || [],
  };
}
