/**
 * Universal Date Normalizer & Formatter
 * Prevents "Invalid Date" errors across the application.
 */

/**
 * Safely normalizes any date/timestamp representation into a valid JS Date instance or null.
 * Supports:
 * - JS Date instances
 * - ISO strings & date strings
 * - Epoch timestamps in milliseconds or seconds (number or numeric string)
 * - Firestore Timestamps (with .toDate() method)
 * - Serialized Firestore objects ({ seconds, _seconds, nanoseconds, _nanoseconds })
 * - Legacy timestamp formats
 */
export function normalizeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // 1. JS Date instance
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // 2. Firestore Timestamp object with .toDate() method
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
      }
    } catch {
      // ignore
    }
  }

  // 3. Serialized Firestore Timestamp object { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof seconds === 'number' && !isNaN(seconds)) {
      const ms = seconds * 1000 + Math.floor(nanoseconds / 1000000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }

  // 4. Numeric timestamp (number)
  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    // If timestamp is in seconds (e.g. 10 digits instead of 13 digits)
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // 5. String timestamp or ISO string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'Invalid Date' || trimmed === 'undefined' || trimmed === 'null') {
      return null;
    }

    // Try parsing as numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  return null;
}

/**
 * Formats a staff note date into a clean, readable string e.g.:
 * "Sep 22, 2026 • 6:42 AM"
 * Guaranteed to NEVER return "Invalid Date".
 */
export function formatStaffNoteDate(value: any, fallback = 'Just now'): string {
  const date = normalizeDate(value);
  if (!date) {
    return fallback;
  }

  try {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 hour is 12 AM

    return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
  } catch {
    return fallback;
  }
}

/**
 * Safely formats date & time e.g. "Sep 22, 2026, 6:42 AM"
 */
export function formatSafeDateTime(value: any, fallback = 'Date unavailable'): string {
  const date = normalizeDate(value);
  if (!date) return fallback;

  try {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats date only e.g. "Sep 22, 2026"
 */
export function formatSafeDate(value: any, fallback = 'Date unavailable'): string {
  const date = normalizeDate(value);
  if (!date) return fallback;

  try {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats time only e.g. "6:42 AM"
 */
export function formatSafeTime(value: any, fallback = ''): string {
  const date = normalizeDate(value);
  if (!date) return fallback;

  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return fallback;
  }
}

/**
 * Safely sorts staff notes array newest first (descending by timestamp).
 * Missing or invalid timestamps do not crash sorting.
 */
export function sortStaffNotesNewestFirst<T extends { createdAt?: any }>(notes: T[]): T[] {
  if (!Array.isArray(notes)) return [];
  return [...notes].sort((a, b) => {
    const timeA = normalizeDate(a?.createdAt)?.getTime() ?? 0;
    const timeB = normalizeDate(b?.createdAt)?.getTime() ?? 0;
    return timeB - timeA;
  });
}
