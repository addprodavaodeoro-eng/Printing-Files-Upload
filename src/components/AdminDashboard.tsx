import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  Link as LinkIcon,
  QrCode,
  Settings,
  RefreshCw,
  Search,
  Download,
  Trash2,
  ExternalLink,
  Plus,
  Copy,
  Check,
  Clock,
  Printer,
  FileCheck,
  AlertCircle,
  FileArchive,
  ChevronDown,
  ChevronUp,
  Sliders,
  LogOut,
  User,
  ShieldCheck,
  Volume2,
  VolumeX,
  Eye,
  ArrowUpDown,
  Bell,
  X,
  MessageSquare,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  PrintRequest,
  UploadLink,
  SystemStats,
  SystemSettings,
  CleanupStatus,
  UploadedFileInfo,
  RequestStatus,
} from '../types';
import { formatFileSize, getFileIcon } from './FileDropzone';
import { QRCodeModal } from './QRCodeModal';
import { PrintSignModal } from './PrintSignModal';
import { FilePreviewModal } from './FilePreviewModal';
import { UploadDetailsModal } from './UploadDetailsModal';
import { BulkActionsBar } from './BulkActionsBar';
import { ConfirmDialog } from './ConfirmDialog';
import { CreateLinkModal } from './CreateLinkModal';
import { soundNotifier } from '../utils/audio';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

type TabType = 'requests' | 'links' | 'quick-qr' | 'settings';
type SortOption = 'newest' | 'oldest' | 'customer';

interface NewUploadNotification {
  id: string;
  referenceCode: string;
  customerName?: string | null;
  fileCount: number;
  type: 'quick' | 'remote';
  createdAt: string;
  request: PrintRequest;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null);

  // Sound preference state
  const [soundEnabled, setSoundEnabled] = useState(() => soundNotifier.isEnabled());

  // Real-time notification banner state
  const [latestNotification, setLatestNotification] = useState<NewUploadNotification | null>(null);

  // Filters, Search & Sorting
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'quick' | 'remote'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modals State
  const [selectedDetailsRequest, setSelectedDetailsRequest] = useState<PrintRequest | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFileInfo | null>(null);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // QR Modal State
  const [qrModalData, setQrModalData] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    subtitle?: string;
  }>({
    isOpen: false,
    url: '',
    title: '',
  });

  // Print Sign Modal State
  const [isPrintSignOpen, setIsPrintSignOpen] = useState(false);

  // Settings tab form state
  const [maxSizeInput, setMaxSizeInput] = useState<number>(50);
  const [cleanupDaysInput, setCleanupDaysInput] = useState<number>(14);
  const [isCustomDays, setIsCustomDays] = useState<boolean>(false);
  const [customDaysValue, setCustomDaysValue] = useState<string>('14');
  const [cleanupIntervalInput, setCleanupIntervalInput] = useState<number>(1);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showCleanupHistory, setShowCleanupHistory] = useState(false);

  // Feedback notifications
  const [copiedLinkToken, setCopiedLinkToken] = useState<string | null>(null);
  const [copiedMsgToken, setCopiedMsgToken] = useState<string | null>(null);

  // Authenticated API Fetch Helper
  const authFetch = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch(endpoint, { ...options, headers });
      if (res.status === 401) {
        onLogout();
        throw new Error('Session expired. Please log in again.');
      }
      return res;
    },
    [token, onLogout]
  );

  // Toggle sound setting
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    soundNotifier.setEnabled(nextVal);
    setSoundEnabled(nextVal);
    if (nextVal) {
      soundNotifier.playChime();
    }
  };

  // Load all dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqRes, linksRes, setRes] = await Promise.all([
        authFetch('/api/admin/requests'),
        authFetch('/api/admin/links'),
        authFetch('/api/admin/settings'),
      ]);

      if (reqRes.ok) {
        const reqData: PrintRequest[] = await reqRes.json();
        setRequests(reqData);
      }
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinks(linksData);
      }
      if (setRes.ok) {
        const setData = await setRes.json();
        setSettings(setData.settings);
        setStats(setData.stats);
        if (setData.cleanupStatus) {
          setCleanupStatus(setData.cleanupStatus);
        }
        setMaxSizeInput(setData.settings.maxFileSizeMB);

        const days = setData.settings.autoCleanupDays ?? 14;
        setCleanupDaysInput(days);
        const standardPresets = [0, 1, 3, 7, 14, 30, 60, 90];
        if (!standardPresets.includes(days)) {
          setIsCustomDays(true);
          setCustomDaysValue(String(days));
        } else {
          setIsCustomDays(false);
          setCustomDaysValue(String(days));
        }

        setCleanupIntervalInput(setData.settings.cleanupIntervalHours || 1);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-Time Server-Sent Events (SSE) Listener
  useEffect(() => {
    let sse: EventSource | null = null;
    try {
      sse = new EventSource(`/api/admin/events?token=${encodeURIComponent(token)}`);

      sse.addEventListener('new_upload', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const req: PrintRequest = data.request;

          // 1. Play sound notification chime
          soundNotifier.playChime();

          // 2. Set banner notification
          setLatestNotification({
            id: req.id,
            referenceCode: req.referenceCode,
            customerName: req.customerName,
            fileCount: req.fileCount,
            type: req.type,
            createdAt: req.createdAt,
            request: req,
          });

          // 3. Insert or update in local requests list
          setRequests((prev) => {
            const exists = prev.some((r) => r.id === req.id);
            if (exists) {
              return prev.map((r) => (r.id === req.id ? req : r));
            }
            return [req, ...prev];
          });

          // 4. Update stats badge immediately
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  totalRequests: prev.totalRequests + 1,
                  newRequests: prev.newRequests + 1,
                  totalFiles: prev.totalFiles + req.fileCount,
                  totalStorageBytes: prev.totalStorageBytes + req.totalSize,
                }
              : null
          );
        } catch (e) {
          console.error('Error handling new_upload event:', e);
        }
      });

      sse.onerror = () => {
        // SSE auto-reconnects
      };
    } catch (err) {
      console.error('SSE initialization error:', err);
    }

    return () => {
      if (sse) {
        sse.close();
      }
    };
  }, [token]);

  // Request Status Update
  const handleUpdateStatus = async (
    requestId: string,
    newStatus: RequestStatus
  ) => {
    try {
      const res = await authFetch(`/api/admin/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
        );
        if (selectedDetailsRequest?.id === requestId) {
          setSelectedDetailsRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        loadData();
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Delete Single Request with Dialog
  const handleDeleteRequestPrompt = (requestId: string) => {
    const req = requests.find((r) => r.id === requestId);
    setConfirmDialogData({
      isOpen: true,
      title: 'Delete Upload Request',
      message: `Are you sure you want to delete upload ${req?.referenceCode || ''} and permanently remove its ${req?.fileCount || 0} file(s)? This action cannot be undone.`,
      confirmText: 'Delete Upload',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialogData((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/admin/requests/${requestId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
            if (selectedDetailsRequest?.id === requestId) {
              setSelectedDetailsRequest(null);
            }
            setSelectedRequestIds((prev) => {
              const next = new Set(prev);
              next.delete(requestId);
              return next;
            });
            loadData();
          }
        } catch (err) {
          console.error('Delete request failed:', err);
        }
      },
    });
  };

  // Delete Individual File
  const handleDeleteFile = async (fileId: string, requestId: string) => {
    setConfirmDialogData({
      isOpen: true,
      title: 'Delete File',
      message: 'Are you sure you want to permanently delete this file from disk?',
      confirmText: 'Delete File',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialogData((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/admin/files/${fileId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            setRequests((prev) =>
              prev.map((r) => {
                if (r.id !== requestId) return r;
                const updatedFiles = r.files.filter((f) => f.id !== fileId);
                return {
                  ...r,
                  files: updatedFiles,
                  fileCount: updatedFiles.length,
                  totalSize: updatedFiles.reduce((acc, f) => acc + f.fileSize, 0),
                };
              })
            );
            if (selectedDetailsRequest?.id === requestId) {
              setSelectedDetailsRequest((prev) => {
                if (!prev) return null;
                const updatedFiles = prev.files.filter((f) => f.id !== fileId);
                return {
                  ...prev,
                  files: updatedFiles,
                  fileCount: updatedFiles.length,
                  totalSize: updatedFiles.reduce((acc, f) => acc + f.fileSize, 0),
                };
              });
            }
          }
        } catch (err) {
          console.error('Delete file failed:', err);
        }
      },
    });
  };

  // Download ZIP
  const handleDownloadZip = (requestId: string) => {
    window.open(
      `/api/admin/requests/${requestId}/download-zip?token=${encodeURIComponent(token)}`,
      '_blank'
    );
  };

  // Download Individual File
  const handleDownloadFile = (fileId: string) => {
    window.open(
      `/api/admin/files/${fileId}/download?token=${encodeURIComponent(token)}`,
      '_blank'
    );
  };

  // Bulk Actions
  const handleToggleSelectRequest = (requestId: string) => {
    setSelectedRequestIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedRequestIds.size === filteredRequests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedRequestIds(new Set());
  };

  const handleBulkUpdateStatus = async (status: 'processing' | 'completed') => {
    if (selectedRequestIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedRequestIds);
      const res = await authFetch('/api/admin/requests/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds: ids, status }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (selectedRequestIds.has(r.id) ? { ...r, status } : r))
        );
        setSelectedRequestIds(new Set());
        loadData();
      }
    } catch (err) {
      console.error('Bulk status update failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeletePrompt = () => {
    const count = selectedRequestIds.size;
    if (count === 0) return;

    setConfirmDialogData({
      isOpen: true,
      title: `Delete ${count} Selected Uploads`,
      message: `Are you sure you want to permanently delete ${count} upload requests and all their associated files? This cannot be undone.`,
      confirmText: `Delete ${count} Uploads`,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialogData((prev) => ({ ...prev, isOpen: false }));
        setBulkActionLoading(true);
        try {
          const ids = Array.from(selectedRequestIds);
          const res = await authFetch('/api/admin/requests/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestIds: ids }),
          });

          if (res.ok) {
            setRequests((prev) => prev.filter((r) => !selectedRequestIds.has(r.id)));
            setSelectedRequestIds(new Set());
            loadData();
          }
        } catch (err) {
          console.error('Bulk delete failed:', err);
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  // Toggle Customer Upload Link Active/Inactive
  const handleToggleLinkActive = async (linkId: string, currentActive: boolean) => {
    try {
      const res = await authFetch(`/api/admin/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, active: !currentActive } : l))
        );
      }
    } catch (err) {
      console.error('Toggle link active failed:', err);
    }
  };

  // Delete Customer Upload Link
  const handleDeleteLink = (linkId: string) => {
    setConfirmDialogData({
      isOpen: true,
      title: 'Delete Customer Link',
      message: 'Are you sure you want to delete this customer upload link? Customers with this URL will no longer be able to upload.',
      confirmText: 'Delete Link',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialogData((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/admin/links/${linkId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            setLinks((prev) => prev.filter((l) => l.id !== linkId));
          }
        } catch (err) {
          console.error('Delete link failed:', err);
        }
      },
    });
  };

  // Copy Link URL
  const copyLinkUrl = (tokenStr: string) => {
    const fullUrl = `${window.location.origin}/request/${tokenStr}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkToken(tokenStr);
    setTimeout(() => setCopiedLinkToken(null), 2500);
  };

  // Copy Preformatted Customer Message
  const copyCustomerMessage = (link: UploadLink) => {
    const fullUrl = `${window.location.origin}/request/${link.token}`;
    const msg = `Hello! Please upload your printable files to Oyangoren Printing Services using this link: ${fullUrl} Thank you!`;
    navigator.clipboard.writeText(msg);
    setCopiedMsgToken(link.token);
    setTimeout(() => setCopiedMsgToken(null), 2500);
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaveMsg(null);

    try {
      const finalDays = isCustomDays
        ? Math.max(1, Math.min(365, Number(customDaysValue) || 14))
        : cleanupDaysInput;
      const body: Record<string, unknown> = {
        maxFileSizeMB: maxSizeInput,
        autoCleanupDays: finalDays,
        cleanupIntervalHours: cleanupIntervalInput,
      };
      if (newPasswordInput.trim()) {
        body.newPassword = newPasswordInput.trim();
      }

      const res = await authFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        if (data.cleanupStatus) {
          setCleanupStatus(data.cleanupStatus);
        }
        setNewPasswordInput('');
        setSettingsSaveMsg('Settings & periodic cleanup schedule saved successfully!');
        setTimeout(() => setSettingsSaveMsg(null), 4000);
        loadData();
      } else {
        setSettingsSaveMsg('Failed to update settings.');
      }
    } catch {
      setSettingsSaveMsg('Failed to update settings.');
    }
  };

  // Trigger Manual Cleanup
  const handleRunCleanup = async () => {
    const finalDays = isCustomDays ? Number(customDaysValue) : cleanupDaysInput;
    if (finalDays <= 0) {
      alert('Automatic cleanup is disabled (0 days). Please select a retention period of at least 1 day.');
      return;
    }

    setConfirmDialogData({
      isOpen: true,
      title: 'Execute Immediate Storage Cleanup',
      message: `Scan and permanently delete all uploaded files older than ${finalDays} days right now?`,
      confirmText: 'Run Cleanup Now',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialogData((prev) => ({ ...prev, isOpen: false }));
        setCleaningUp(true);
        setCleanupFeedback(null);

        try {
          const res = await authFetch('/api/admin/cleanup', { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            const result = data.result;
            setCleanupFeedback({
              type: 'success',
              message:
                result.message ||
                `Cleaned ${result.deletedFilesCount + result.orphanedFilesCount} file(s) (${formatFileSize(result.deletedBytes)}).`,
            });
            if (data.cleanupStatus) {
              setCleanupStatus(data.cleanupStatus);
            }
            loadData();
          } else {
            setCleanupFeedback({
              type: 'error',
              message: data.result?.message || data.error || 'Cleanup task encountered an issue.',
            });
          }
        } catch {
          setCleanupFeedback({
            type: 'error',
            message: 'Error executing cleanup request.',
          });
        } finally {
          setCleaningUp(false);
        }
      },
    });
  };

  // Filter & Sort Requests Memo
  const filteredRequests = useMemo(() => {
    const list = requests.filter((req) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'printing') {
          if (req.status !== 'printing' && req.status !== 'processing') return false;
        } else if (req.status !== statusFilter) {
          return false;
        }
      }
      // Type filter
      if (typeFilter !== 'all' && req.type !== typeFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = req.referenceCode.toLowerCase().includes(q);
        const matchesCustomer = req.customerName?.toLowerCase().includes(q);
        const matchesInstructions = req.instructions?.toLowerCase().includes(q);
        const matchesFile = req.files.some((f) =>
          f.originalFilename.toLowerCase().includes(q)
        );
        if (!matchesRef && !matchesCustomer && !matchesInstructions && !matchesFile) {
          return false;
        }
      }
      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'customer') {
        const nameA = a.customerName?.toLowerCase() || 'zz_walkin';
        const nameB = b.customerName?.toLowerCase() || 'zz_walkin';
        return nameA.localeCompare(nameB);
      }
      // 'newest' default
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests, statusFilter, typeFilter, searchQuery, sortBy]);

  const quickUploadUrl = `${window.location.origin}/upload`;

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* TOP ADMIN BAR */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Staff Portal
            </span>
            <span className="text-xs text-slate-400">Authenticated</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Oyangoren Printing Services
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Admin Dashboard & Real-Time Print Queue
          </p>
        </div>

        {/* Quick Stats Pills & Controls */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-left">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              New Uploads
            </span>
            <span className="text-lg font-bold text-sky-400">
              {stats?.newRequests ?? 0}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-left">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Printing
            </span>
            <span className="text-lg font-bold text-amber-400">
              {stats?.processingRequests ?? 0}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-left">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Storage
            </span>
            <span className="text-sm sm:text-base font-bold text-white mt-0.5 block">
              {formatFileSize(stats?.totalStorageBytes || 0)}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            id="btn-toggle-sound-notify"
            title={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
            className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors border cursor-pointer ${
              soundEnabled
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Refresh Data */}
          <button
            onClick={loadData}
            id="btn-admin-refresh"
            title="Refresh dashboard data"
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            id="btn-admin-logout-top"
            title="Log out"
            className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl transition-colors border border-rose-500/20 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* REAL-TIME NEW UPLOAD NOTIFICATION TOAST / BANNER */}
      {latestNotification && (
        <div
          id="toast-realtime-new-upload"
          className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slideDown border border-emerald-500"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  New Upload Received
                </span>
                <span className="text-xs text-emerald-100">Just now</span>
              </div>
              <p className="text-sm font-semibold truncate mt-0.5">
                {latestNotification.customerName
                  ? latestNotification.customerName
                  : 'Walk-in Customer'}{' '}
                sent {latestNotification.fileCount} {latestNotification.fileCount === 1 ? 'file' : 'files'} (
                {latestNotification.type === 'quick' ? 'Quick Upload' : 'Remote Request'}) • Ref:{' '}
                <span className="font-mono font-bold text-emerald-200">
                  {latestNotification.referenceCode}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailsRequest(latestNotification.request);
                setLatestNotification(null);
              }}
              id="btn-toast-view-request"
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-emerald-900 font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              View Request
            </button>
            <button
              type="button"
              onClick={() => setLatestNotification(null)}
              title="Dismiss notification"
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('requests')}
          id="tab-btn-requests"
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Recent Uploads</span>
          {(stats?.newRequests ?? 0) > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[11px] animate-pulse">
              {stats?.newRequests} New
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('links')}
          id="tab-btn-links"
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'links'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Customer Upload Links</span>
          <span className="text-xs opacity-75">({links.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quick-qr')}
          id="tab-btn-quick-qr"
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'quick-qr'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Quick Upload QR</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          id="tab-btn-settings"
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings & Cleanup</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: RECENT UPLOADS & PRINT QUEUE */}
      {/* ==================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Controls Bar: Search, Filters, Sorting, Select All */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by reference code (OY-...), customer, or filename..."
                  id="input-admin-search"
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Status Filters */}
              <div className="flex items-center flex-wrap gap-1.5">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({requests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('new')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'new'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    New ({requests.filter((r) => r.status === 'new').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('reviewing')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'reviewing'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Review ({requests.filter((r) => r.status === 'reviewing').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('printing')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'printing' || statusFilter === 'processing'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Printing ({requests.filter((r) => r.status === 'printing' || r.status === 'processing').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ready_for_pickup')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'ready_for_pickup'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pickup ({requests.filter((r) => r.status === 'ready_for_pickup').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('completed')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'completed'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Done ({requests.filter((r) => r.status === 'completed').length})
                  </button>
                </div>

                {/* Source Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'all' | 'quick' | 'remote')}
                  id="select-type-filter"
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="quick">Walk-in Quick</option>
                  <option value="remote">Remote Link</option>
                </select>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    id="select-sort-by"
                    className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="customer">Customer Name</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Select All Checkbox row */}
            {filteredRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  id="btn-select-all-filtered"
                  className="flex items-center gap-2 font-semibold text-slate-700 hover:text-sky-600 transition-colors cursor-pointer"
                >
                  {selectedRequestIds.size === filteredRequests.length ? (
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select All ({filteredRequests.length})</span>
                </button>

                <span>
                  Showing {filteredRequests.length} of {requests.length} requests
                </span>
              </div>
            )}
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">
                No upload requests found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No requests match your current filters. Try changing or clearing filters.'
                  : 'Files uploaded by walk-in customers or via remote links will appear here immediately.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3" id="admin-requests-list">
              {filteredRequests.map((req) => {
                const isExpanded = expandedRequestId === req.id;
                const isSelected = selectedRequestIds.has(req.id);

                return (
                  <div
                    key={req.id}
                    id={`request-card-${req.id}`}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                      isSelected
                        ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20'
                        : req.status === 'new'
                        ? 'border-sky-300 ring-1 ring-sky-400/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Main Row */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Checkbox + Status Icon + Customer Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Checkbox for bulk actions */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRequest(req.id)}
                          className="mt-1 p-0.5 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer shrink-0"
                          title="Select upload"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-sky-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </button>

                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            req.status === 'new'
                              ? 'bg-sky-100 text-sky-600'
                              : req.status === 'reviewing'
                              ? 'bg-purple-100 text-purple-600'
                              : req.status === 'ready_to_print'
                              ? 'bg-indigo-100 text-indigo-600'
                              : req.status === 'printing' || req.status === 'processing'
                              ? 'bg-amber-100 text-amber-600'
                              : req.status === 'ready_for_pickup'
                              ? 'bg-emerald-100 text-emerald-600'
                              : req.status === 'completed'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-rose-100 text-rose-600'
                          }`}
                        >
                          {req.status === 'completed' ? (
                            <FileCheck className="w-5 h-5" />
                          ) : req.status === 'printing' || req.status === 'processing' ? (
                            <Printer className="w-5 h-5" />
                          ) : req.status === 'reviewing' ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-mono text-base font-extrabold text-slate-900">
                              {req.referenceCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                req.type === 'quick'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {req.type === 'quick' ? 'Walk-in' : 'Remote Link'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(req.createdAt).toLocaleDateString()}{' '}
                              {new Date(req.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            {req.customerName && (
                              <span className="font-semibold text-slate-900 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-sky-600" />
                                {req.customerName}
                              </span>
                            )}
                            <span className="font-medium text-slate-700">
                              {req.fileCount} {req.fileCount === 1 ? 'file' : 'files'} (
                              {formatFileSize(req.totalSize)})
                            </span>
                          </div>

                          {/* Instructions Preview snippet */}
                          {req.instructions && (
                            <p className="mt-1.5 text-xs text-amber-900 bg-amber-50/90 px-2.5 py-1 rounded-lg border border-amber-200 inline-block max-w-full truncate">
                              <strong>Note:</strong> {req.instructions}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Status Switcher & Primary Actions */}
                      <div className="flex items-center flex-wrap gap-2 justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        {/* Status Dropdown */}
                        <select
                          value={req.status}
                          onChange={(e) =>
                            handleUpdateStatus(
                              req.id,
                              e.target.value as RequestStatus
                            )
                          }
                          id={`select-status-${req.id}`}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                            req.status === 'ready_for_pickup' || req.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 focus:ring-emerald-500'
                              : req.status === 'printing' || req.status === 'processing'
                              ? 'bg-amber-50 text-amber-900 border-amber-300 focus:ring-amber-500'
                              : req.status === 'ready_to_print'
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300 focus:ring-indigo-500'
                              : req.status === 'reviewing'
                              ? 'bg-purple-50 text-purple-900 border-purple-300 focus:ring-purple-500'
                              : req.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-900 border-rose-300 focus:ring-rose-500'
                              : 'bg-sky-50 text-sky-900 border-sky-300 focus:ring-sky-500'
                          }`}
                        >
                          <option value="new">● New (In Queue)</option>
                          <option value="reviewing">● Under Review</option>
                          <option value="ready_to_print">● Ready to Print</option>
                          <option value="printing">● Printing</option>
                          <option value="ready_for_pickup">● Ready for Pickup</option>
                          <option value="completed">● Completed</option>
                          <option value="cancelled">● Cancelled</option>
                        </select>

                        {/* Details Modal Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedDetailsRequest(req)}
                          id={`btn-details-${req.id}`}
                          title="View complete upload details"
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Details</span>
                        </button>

                        {/* Download All as ZIP */}
                        <button
                          type="button"
                          onClick={() => handleDownloadZip(req.id)}
                          id={`btn-download-zip-${req.id}`}
                          title="Download all files as a ZIP"
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <FileArchive className="w-3.5 h-3.5 text-sky-400" />
                          <span>ZIP</span>
                        </button>

                        {/* Toggle Files List Drawer */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRequestId(isExpanded ? null : req.id)
                          }
                          id={`btn-expand-files-${req.id}`}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Expand/Collapse Files"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete Single Upload */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRequestPrompt(req.id)}
                          id={`btn-delete-req-${req.id}`}
                          title="Delete this upload and its files"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Files List Drawer */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-t border-slate-100 p-4 space-y-3 animate-fadeIn">
                        {req.instructions && (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-0.5">
                            <span className="font-bold block uppercase tracking-wider text-[10px]">
                              Full Printing Instructions
                            </span>
                            <p className="whitespace-pre-wrap">{req.instructions}</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Files in this Upload ({req.files.length})
                          </span>

                          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                            {req.files.map((file) => {
                              const isPreviewable =
                                file.mimeType === 'application/pdf' ||
                                file.mimeType.startsWith('image/') ||
                                /\.(pdf|png|jpe?g|webp)$/i.test(file.originalFilename);

                              return (
                                <div
                                  key={file.id}
                                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {getFileIcon(file.originalFilename)}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                                        {file.originalFilename}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {formatFileSize(file.fileSize)} • Uploaded{' '}
                                        {new Date(file.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {isPreviewable && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewFile(file)}
                                        id={`btn-preview-file-${file.id}`}
                                        title="Preview file directly in browser"
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Preview</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDownloadFile(file.id)}
                                      id={`btn-download-file-${file.id}`}
                                      title="Download this file"
                                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Download</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFile(file.id, req.id)}
                                      id={`btn-del-file-${file.id}`}
                                      title="Delete this file"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Bulk Actions Toolbar */}
          <BulkActionsBar
            selectedCount={selectedRequestIds.size}
            totalCount={filteredRequests.length}
            isAllSelected={
              filteredRequests.length > 0 &&
              selectedRequestIds.size === filteredRequests.length
            }
            onToggleSelectAll={handleToggleSelectAll}
            onDeselectAll={handleDeselectAll}
            onMarkProcessing={() => handleBulkUpdateStatus('processing')}
            onMarkCompleted={() => handleBulkUpdateStatus('completed')}
            onDeleteSelected={handleBulkDeletePrompt}
            loading={bulkActionLoading}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: CUSTOMER UPLOAD LINKS */}
      {/* ==================================================== */}
      {activeTab === 'links' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Action */}
          <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Remote Customer Upload Links
              </h3>
              <p className="text-xs text-slate-500">
                Generate secure links for remote customers to upload printable documents.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateLinkModal(true)}
              id="btn-open-create-link"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Upload Link</span>
            </button>
          </div>

          {/* Links List */}
          {links.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <LinkIcon className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">
                No customer upload links created yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create a customized link for a customer with optional printing instructions, expiration date, and upload limits.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateLinkModal(true)}
                className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Link</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="admin-links-grid">
              {links.map((link) => {
                const isExpired =
                  link.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
                const isLimitReached =
                  link.uploadLimit !== null && link.uploadCount >= link.uploadLimit;
                const linkUrl = `${window.location.origin}/request/${link.token}`;
                const isCopiedLink = copiedLinkToken === link.token;
                const isCopiedMsg = copiedMsgToken === link.token;

                return (
                  <div
                    key={link.id}
                    id={`link-card-${link.id}`}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
                      !link.active || isExpired || isLimitReached
                        ? 'border-slate-200 opacity-75 bg-slate-50/50'
                        : 'border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {link.customerName ? `For: ${link.customerName}` : 'Customer Link'}
                          </h4>
                          {/* Badges */}
                          {!link.active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                              Disabled
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                              Expired
                            </span>
                          ) : isLimitReached ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                              Limit Reached
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Created {new Date(link.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Toggle Active Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleLinkActive(link.id, link.active)}
                          id={`btn-toggle-link-${link.id}`}
                          title={link.active ? 'Deactivate link' : 'Activate link'}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            link.active
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {link.active ? 'Disable' : 'Enable'}
                        </button>
                        {/* Delete Link Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(link.id)}
                          id={`btn-delete-link-${link.id}`}
                          title="Delete link"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Specs */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Instructions:</span>
                        <span
                          className={`font-semibold ${
                            link.instructionsEnabled ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {link.instructionsEnabled ? 'Enabled (Free text)' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Upload Limit:</span>
                        <span className="font-semibold text-slate-700">
                          {link.uploadLimit !== null
                            ? `${link.uploadCount} / ${link.uploadLimit} used`
                            : `${link.uploadCount} used (Unlimited)`}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">Expiration:</span>
                        <span className="font-semibold text-slate-700">
                          {link.expiresAt
                            ? `${new Date(link.expiresAt).toLocaleDateString()} ${new Date(
                                link.expiresAt
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'No expiration'}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Copy Link, Copy Message & Show QR */}
                    <div className="flex items-center flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyLinkUrl(link.token)}
                        id={`btn-copy-link-${link.id}`}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isCopiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => copyCustomerMessage(link)}
                        id={`btn-copy-msg-${link.id}`}
                        title="Copy preformatted customer message"
                        className="py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-sky-200 cursor-pointer"
                      >
                        {isCopiedMsg ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied Msg!</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Copy Msg</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setQrModalData({
                            isOpen: true,
                            url: linkUrl,
                            title: `Upload QR for ${link.customerName || 'Customer'}`,
                            subtitle: link.instructionsEnabled
                              ? 'Printing instructions enabled'
                              : undefined,
                          })
                        }
                        id={`btn-show-qr-${link.id}`}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                        title="Show QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open customer page in new tab"
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: PERMANENT QUICK UPLOAD QR */}
      {/* ==================================================== */}
      {activeTab === 'quick-qr' && (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6 text-center animate-fadeIn">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full uppercase tracking-wider">
              Walk-in Counter QR
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Scan to Send Files - Oyangoren Printing Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Place this QR code on the printing shop counter or front desk. Customers can scan to immediately upload their printable files without logging in.
            </p>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
            <img
              src={`/api/qr?url=${encodeURIComponent(quickUploadUrl)}`}
              alt="Permanent Quick Upload QR"
              className="w-64 h-64 mx-auto rounded-xl shadow-md bg-white p-2 border border-slate-200"
              id="img-permanent-qr"
            />
            <p className="text-xs font-mono font-bold text-slate-700 mt-3">
              {quickUploadUrl}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsPrintSignOpen(true)}
              id="btn-print-shop-sign-tab"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Shop Counter Sign</span>
            </button>

            <a
              href={`/api/qr?url=${encodeURIComponent(quickUploadUrl)}&format=png`}
              download="Oyangoren_Quick_Upload_QR.png"
              id="btn-download-permanent-png"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR (PNG)</span>
            </a>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(quickUploadUrl);
                alert('Quick Upload URL copied to clipboard!');
              }}
              id="btn-copy-quick-url"
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors cursor-pointer"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: SETTINGS & STORAGE MAINTENANCE */}
      {/* ==================================================== */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
          {/* Storage & Limits Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  System Storage & Upload Limits
                </h3>
              </div>
            </div>

            {/* Storage Metric Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Files Stored
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {stats?.totalFiles || 0} files
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Used Storage
                </span>
                <span className="text-lg font-black text-sky-600 mt-0.5 block">
                  {formatFileSize(stats?.totalStorageBytes || 0)}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cleanup Retention
                </span>
                <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                  {cleanupDaysInput > 0 ? `${cleanupDaysInput} Days` : 'Preserve All'}
                </span>
              </div>
            </div>

            {settingsSaveMsg && (
              <div
                id="settings-save-alert"
                className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 animate-fadeIn"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{settingsSaveMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Max File Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Maximum File Size (MB per file)
                </label>
                <select
                  value={maxSizeInput}
                  onChange={(e) => setMaxSizeInput(Number(e.target.value))}
                  id="select-max-file-size"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value={10}>10 MB per file</option>
                  <option value={25}>25 MB per file</option>
                  <option value={50}>50 MB per file (Default)</option>
                  <option value={100}>100 MB per file</option>
                  <option value={150}>150 MB per file</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Enforced strictly on the server for all customer uploads.
                </p>
              </div>

              {/* Auto-Cleanup Days & Frequency */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">
                      Automatic Storage Retention (Days)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Files and requests older than this threshold are automatically deleted by the background task.
                    </p>
                  </div>
                  {cleanupDaysInput > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Auto-Purge Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Purge Disabled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Retention Window
                    </label>
                    <select
                      value={isCustomDays ? 'custom' : cleanupDaysInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setIsCustomDays(true);
                          setCleanupDaysInput(Number(customDaysValue) || 14);
                        } else {
                          setIsCustomDays(false);
                          const num = Number(val);
                          setCleanupDaysInput(num);
                          setCustomDaysValue(String(num));
                        }
                      }}
                      id="select-auto-cleanup-preset"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value={14}>14 Days (Recommended)</option>
                      <option value={1}>1 Day (High Privacy)</option>
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={30}>30 Days (1 Month)</option>
                      <option value={60}>60 Days (2 Months)</option>
                      <option value={90}>90 Days (Quarterly)</option>
                      <option value="custom">Custom Days...</option>
                      <option value={0}>0 - Disabled (Keep Forever)</option>
                    </select>
                  </div>

                  {isCustomDays ? (
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        Enter Custom Days (1 – 365)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={customDaysValue}
                        onChange={(e) => {
                          setCustomDaysValue(e.target.value);
                          setCleanupDaysInput(Number(e.target.value) || 1);
                        }}
                        placeholder="e.g. 21"
                        id="input-custom-cleanup-days"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        Background Scan Interval
                      </label>
                      <select
                        value={cleanupIntervalInput}
                        onChange={(e) => setCleanupIntervalInput(Number(e.target.value))}
                        id="select-cleanup-interval"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                      >
                        <option value={1}>Every 1 Hour (Recommended)</option>
                        <option value={2}>Every 2 Hours</option>
                        <option value={6}>Every 6 Hours</option>
                        <option value={12}>Every 12 Hours</option>
                        <option value={24}>Every 24 Hours (Daily)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Change Admin Password */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block">
                  Change Administrator Password
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (leave empty to keep current)"
                  id="input-change-password"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  Updating password will securely re-hash with salt and invalidate previous sessions.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="submit"
                  id="btn-save-settings"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
                >
                  Save Configuration
                </button>
                <span className="text-[11px] text-slate-400">
                  Changes take effect immediately on the server
                </span>
              </div>
            </form>
          </div>

          {/* Storage Cleanup Task Status & Manual Run */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Storage Maintenance & Background Task
                  </h3>
                  <p className="text-xs text-slate-500">
                    Continuous server-side background task for storage hygiene and privacy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {cleanupFeedback && (
              <div
                id="cleanup-feedback-banner"
                className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn ${
                  cleanupFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {cleanupFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{cleanupFeedback.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCleanupFeedback(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Status Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Retention Threshold
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {cleanupDaysInput > 0 ? `${cleanupDaysInput} Days` : 'Disabled'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {cleanupDaysInput > 0
                    ? `Purges files before ${new Date(
                        Date.now() - cleanupDaysInput * 86400000
                      ).toLocaleDateString()}`
                    : 'All files preserved'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Next Scheduled Run
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {cleanupStatus?.nextRunTimestamp
                    ? new Date(cleanupStatus.nextRunTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Every ' + (settings?.cleanupIntervalHours || 1) + 'h'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {cleanupStatus?.nextRunTimestamp
                    ? new Date(cleanupStatus.nextRunTimestamp).toLocaleDateString()
                    : 'Periodic background interval'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total File Size
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {formatFileSize(stats?.totalStorageBytes || 0)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {stats?.totalFiles || 0} active files stored
                </span>
              </div>
            </div>

            {/* Last Execution Summary */}
            {settings?.lastCleanupResult ? (
              <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100 flex items-start justify-between text-xs text-sky-900">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span>
                      Last Cleanup Run:{' '}
                      {new Date(settings.lastCleanupResult.timestamp).toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800 uppercase tracking-wider font-bold">
                      {settings.lastCleanupResult.trigger}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {settings.lastCleanupResult.message} (Duration:{' '}
                    {settings.lastCleanupResult.durationMs}ms)
                  </p>
                </div>
              </div>
            ) : null}

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRunCleanup}
                disabled={cleaningUp || cleanupDaysInput <= 0}
                id="btn-run-manual-cleanup"
                className="px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors border border-rose-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {cleaningUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning and purging disk...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Scan & Purge Old Files Now</span>
                  </>
                )}
              </button>

              {settings?.cleanupHistory && settings.cleanupHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCleanupHistory(!showCleanupHistory)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Activity History ({settings.cleanupHistory.length})</span>
                  {showCleanupHistory ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Collapsible Cleanup Activity History Table */}
            {showCleanupHistory && settings?.cleanupHistory && settings.cleanupHistory.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2 animate-fadeIn">
                <h4 className="text-xs font-bold text-slate-700">
                  Recent Cleanup Task History
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Timestamp</th>
                        <th className="p-2.5">Trigger</th>
                        <th className="p-2.5">Retention</th>
                        <th className="p-2.5">Purged</th>
                        <th className="p-2.5">Freed</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {settings.cleanupHistory.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-50/60">
                          <td className="p-2.5 text-slate-700 font-medium whitespace-nowrap">
                            {new Date(run.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                run.trigger === 'auto'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {run.trigger === 'auto' ? 'Periodic' : 'Manual'}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            {run.configuredDays}d
                          </td>
                          <td className="p-2.5 text-slate-700 whitespace-nowrap">
                            {run.deletedFilesCount + (run.orphanedFilesCount || 0)} files (
                            {run.deletedRequestsCount} req)
                          </td>
                          <td className="p-2.5 text-slate-900 font-medium whitespace-nowrap">
                            {formatFileSize(run.deletedBytes)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                run.status === 'success'
                                  ? 'text-emerald-600'
                                  : run.status === 'skipped'
                                  ? 'text-slate-400'
                                  : 'text-rose-600'
                              }`}
                            >
                              {run.status === 'success' && <Check className="w-3 h-3" />}
                              {run.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE UPLOAD LINK MODAL */}
      <CreateLinkModal
        isOpen={showCreateLinkModal}
        onClose={() => setShowCreateLinkModal(false)}
        token={token}
        onLinkCreated={(newLink) => {
          setLinks((prev) => [newLink, ...prev]);
        }}
        onOpenQR={(url, title, subtitle) => {
          setQrModalData({
            isOpen: true,
            url,
            title,
            subtitle,
          });
        }}
      />

      {/* UPLOAD DETAILS MODAL */}
      <UploadDetailsModal
        request={selectedDetailsRequest}
        token={token}
        onClose={() => setSelectedDetailsRequest(null)}
        onUpdateStatus={handleUpdateStatus}
        onDeleteRequest={handleDeleteRequestPrompt}
        onPreviewFile={(file) => setPreviewFile(file)}
      />

      {/* FILE PREVIEW MODAL */}
      <FilePreviewModal
        file={previewFile}
        token={token}
        onClose={() => setPreviewFile(null)}
      />

      {/* CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialogData.isOpen}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        confirmText={confirmDialogData.confirmText}
        isDestructive={confirmDialogData.isDestructive}
        onConfirm={confirmDialogData.onConfirm}
        onCancel={() => setConfirmDialogData((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* QR MODAL */}
      <QRCodeModal
        isOpen={qrModalData.isOpen}
        onClose={() => setQrModalData((prev) => ({ ...prev, isOpen: false }))}
        url={qrModalData.url}
        title={qrModalData.title}
        subtitle={qrModalData.subtitle}
        onOpenPrintSign={() => {
          setQrModalData((prev) => ({ ...prev, isOpen: false }));
          setIsPrintSignOpen(true);
        }}
      />

      {/* PRINT SIGN MODAL */}
      <PrintSignModal
        isOpen={isPrintSignOpen}
        onClose={() => setIsPrintSignOpen(false)}
        url={quickUploadUrl}
      />
    </div>
  );
};
