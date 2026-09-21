export type RequestStatus =
  | 'new'
  | 'reviewing'
  | 'ready_to_print'
  | 'printing'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'
  | 'processing'; // retained for backward compatibility

export type RequestType = 'quick' | 'remote';

export type LinkType = 'files_only' | 'files_instructions' | 'full_request';

export interface PrintOptions {
  paperSize: string; // e.g. "Short Bond (8.5x11)", "Long Bond (8.5x13)", "A4"
  colorMode: 'black_and_white' | 'color';
  sides: 'single' | 'double';
  copies: number;
  pageRange?: string; // e.g. "All" or "1-5, 8, 10"
  binding?: string; // e.g. "None / Loose", "Stapled", "Ring Bound"
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

export interface UploadedFileInfo {
  id: string;
  requestId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface PrintRequest {
  id: string;
  referenceCode: string; // e.g. "OY-4921"
  token?: string | null;
  linkId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  type: RequestType;
  linkType?: LinkType;
  instructionsEnabled?: boolean;
  instructions?: string | null;
  printOptions?: PrintOptions | null;
  fileConfigs?: FilePrintConfig[];
  internalNotes?: StaffNote[];
  activityLogs?: ActivityLogEntry[];
  status: RequestStatus;
  createdAt: string;
  fileCount: number;
  totalSize: number;
  files: UploadedFileInfo[];
}

export interface UploadLink {
  id: string;
  token: string;
  customerName?: string | null;
  linkType: LinkType;
  instructionsEnabled: boolean;
  expirationOption: '1h' | '24h' | '3d' | '7d' | 'custom' | 'none';
  expiresAt: string | null;
  uploadLimit: number | null; // null = unlimited
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

export interface SystemSettings {
  maxFileSizeMB: number;
  autoCleanupDays: number;
  cleanupIntervalHours?: number;
  allowedExtensions: string[];
  paperSizes: string[];
  finishingOptions: string[];
  defaultPaperSize?: string;
  defaultColorMode?: 'black_and_white' | 'color';
  lastCleanupAt?: string | null;
  lastCleanupResult?: CleanupResult | null;
  cleanupHistory?: CleanupResult[];
}

export interface SystemStats {
  totalRequests: number;
  newRequests: number;
  processingRequests: number;
  completedRequests: number;
  totalFiles: number;
  totalStorageBytes: number;
  activeLinks: number;
  lastCleanupAt?: string | null;
  lastCleanupResult?: CleanupResult | null;
}

export interface LinkValidationResult {
  valid: boolean;
  error?: 'not_found' | 'disabled' | 'expired' | 'limit_reached' | 'server_error';
  errorMessage?: string;
  customerName?: string | null;
  linkType?: LinkType;
  instructionsEnabled?: boolean;
  expiresAt?: string | null;
  uploadLimit?: number | null;
  uploadCount?: number;
  paperSizes?: string[];
  finishingOptions?: string[];
}

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number; // 0 to 100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}
