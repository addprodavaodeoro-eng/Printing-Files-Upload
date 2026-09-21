import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Trash2,
  Clock,
  User,
  QrCode,
  Link as LinkIcon,
  FileArchive,
  Eye,
  Printer,
  Phone,
  Settings2,
  FileText,
  Send,
  History,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { PrintRequest, UploadedFileInfo, RequestStatus, StaffNote } from '../types';
import { formatFileSize, getFileIcon } from './FileDropzone';
import { downloadAuthenticatedFile, printJobTicket } from '../utils/download';
import {
  formatStaffNoteDate,
  formatSafeDateTime,
  formatSafeTime,
  sortStaffNotesNewestFirst,
} from '../utils/date';

interface UploadDetailsModalProps {
  request: PrintRequest | null;
  token: string;
  onClose: () => void;
  onUpdateStatus: (requestId: string, status: RequestStatus) => void;
  onDeleteRequest: (requestId: string) => void;
  onPreviewFile: (file: UploadedFileInfo) => void;
  onRefreshRequest?: () => void;
}

export const UploadDetailsModal: React.FC<UploadDetailsModalProps> = ({
  request,
  token,
  onClose,
  onUpdateStatus,
  onDeleteRequest,
  onPreviewFile,
  onRefreshRequest,
}) => {
  const [copiedRef, setCopiedRef] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [notesList, setNotesList] = useState<StaffNote[]>(() =>
    sortStaffNotesNewestFirst(request?.internalNotes || [])
  );

  useEffect(() => {
    if (request?.internalNotes) {
      setNotesList(sortStaffNotesNewestFirst(request.internalNotes));
    }
  }, [request?.internalNotes]);

  if (!request) return null;

  const copyRef = () => {
    navigator.clipboard.writeText(request.referenceCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleDownloadZip = () => {
    downloadAuthenticatedFile(
      `/api/admin/requests/${request.id}/download-zip`,
      token,
      `Oyangoren_Print_Request_${request.referenceCode}.zip`
    );
  };

  const handleDownloadSingle = (fileId: string, filename: string) => {
    downloadAuthenticatedFile(
      `/api/admin/files/${fileId}/download`,
      token,
      filename || 'downloaded-file'
    );
  };

  const handleOpenTicket = () => {
    printJobTicket(request.id, token);
  };

  const handleAddStaffNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/admin/requests/${request.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: newNoteText.trim(),
          author: 'Staff Operator',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newNote: StaffNote = data.note || data;
        setNotesList((prev) => sortStaffNotesNewestFirst([newNote, ...prev.filter((n) => n.id !== newNote.id)]));
        setNewNoteText('');
        if (onRefreshRequest) onRefreshRequest();
      }
    } catch {
      // ignore
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteStaffNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/admin/requests/${request.id}/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setNotesList((prev) => prev.filter((n) => n.id !== noteId));
        if (onRefreshRequest) onRefreshRequest();
      }
    } catch {
      // ignore
    }
  };

  const formattedDate = formatSafeDateTime(request.createdAt);

  const printOpts = request.printOptions;
  const fileConfigs = request.fileConfigs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        id="upload-details-modal-dialog"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono font-bold text-sm">
              {request.type === 'quick' ? <QrCode className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-sky-400">
                  {request.referenceCode}
                </span>
                <button
                  type="button"
                  onClick={copyRef}
                  title="Copy reference code"
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedRef ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {request.type === 'quick' ? 'Quick Upload (Walk-in)' : 'Remote Print Request'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenTicket}
              id="btn-print-job-ticket-top"
              title="Print Job Ticket"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Job Ticket</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              id="btn-close-upload-details"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Customer Name & Contact
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-900 text-sm">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {request.customerName || 'Walk-in Customer'}
                </span>
              </div>
              {request.customerPhone && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600">
                  <Phone className="w-3 h-3 text-sky-600 shrink-0" />
                  <span className="font-mono">{request.customerPhone}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Received At
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-slate-700 font-medium text-xs sm:text-sm">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Queue Status
              </span>
              <select
                value={request.status}
                onChange={(e) =>
                  onUpdateStatus(request.id, e.target.value as RequestStatus)
                }
                id="select-detail-status"
                className={`mt-1 w-full text-xs font-bold rounded-xl px-2.5 py-2 border transition-colors cursor-pointer ${
                  request.status === 'ready_for_pickup' || request.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : request.status === 'printing'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : request.status === 'ready_to_print'
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                    : request.status === 'reviewing'
                    ? 'bg-purple-50 text-purple-900 border-purple-300'
                    : request.status === 'cancelled'
                    ? 'bg-rose-50 text-rose-900 border-rose-300'
                    : 'bg-sky-50 text-sky-900 border-sky-300'
                }`}
              >
                <option value="new">New (Unreviewed)</option>
                <option value="reviewing">Under Review</option>
                <option value="ready_to_print">Ready to Print</option>
                <option value="printing">Printing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Structured Print Options Box */}
          {printOpts && (
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-900">
                  <Settings2 className="w-4 h-4 text-sky-600" />
                  <span>Printing Specifications</span>
                </div>
                <span className="text-[11px] font-semibold text-sky-700">
                  Global Configuration
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Paper Size</span>
                  <span className="font-bold text-slate-800">{printOpts.paperSize}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Color Mode</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {printOpts.colorMode === 'color' ? 'Full Color' : 'Black & White'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Sides</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {printOpts.sides === 'double' ? 'Double Sided' : 'Single Sided'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Copies</span>
                  <span className="font-bold text-slate-800">{printOpts.copies} copy(ies)</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Page Range</span>
                  <span className="font-bold text-slate-800">{printOpts.pageRange || 'All'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-sky-100 col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Binding / Finishing</span>
                  <span className="font-bold text-slate-800">{printOpts.binding || 'None / Loose Sheets'}</span>
                </div>
              </div>

              {printOpts.notes && (
                <div className="bg-white p-3 rounded-xl border border-sky-100 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Customer Print Notes
                  </span>
                  <p className="text-slate-800 italic mt-0.5">"{printOpts.notes}"</p>
                </div>
              )}
            </div>
          )}

          {/* Simple Printing Instructions (if any and not full printOpts) */}
          {!printOpts && request.instructions && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-1">
              <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider block">
                Printing Instructions
              </span>
              <p className="text-xs sm:text-sm text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">
                {request.instructions}
              </p>
            </div>
          )}

          {/* Files List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Uploaded Files ({request.files?.length || 0}) • Total: {formatFileSize(request.totalSize || 0)}
              </h4>
              <button
                type="button"
                onClick={handleDownloadZip}
                id="btn-detail-download-zip"
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
              >
                <FileArchive className="w-3.5 h-3.5" />
                <span>Download All (ZIP)</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
              {request.files && request.files.length > 0 ? (
                request.files.map((file) => {
                  const isPreviewable =
                    file.mimeType === 'application/pdf' ||
                    file.mimeType.startsWith('image/') ||
                    /\.(pdf|png|jpe?g|webp)$/i.test(file.originalFilename);

                  const customFileCfg = fileConfigs.find(
                    (fc) => fc.filename === file.originalFilename && fc.customized
                  );

                  return (
                    <div
                      key={file.id}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          {getFileIcon(file.originalFilename)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                            {file.originalFilename}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatFileSize(file.fileSize)}</span>
                            {customFileCfg && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                Custom: {customFileCfg.colorMode === 'color' ? 'Color' : 'B&W'}, {customFileCfg.copies || 1} copy
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {isPreviewable && (
                          <button
                            type="button"
                            onClick={() => onPreviewFile(file)}
                            title="Preview file"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(file.id, file.originalFilename)}
                          title="Download file"
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No files associated with this upload request.
                </div>
              )}
            </div>
          </div>

          {/* Internal Staff Notes Section */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Internal Staff Notes ({notesList.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Not visible to customers</span>
            </div>

            {/* Notes list */}
            <div className="space-y-2">
              {notesList.length > 0 ? (
                notesList.map((note) => {
                  const author = note.author && note.author.trim() ? note.author.trim() : 'Staff Operator';
                  const dateStr = formatStaffNoteDate(note.createdAt, 'Just now');
                  return (
                    <div
                      key={note.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="text-slate-800 dark:text-slate-100 font-medium whitespace-pre-wrap">{note.text}</p>
                        <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                          {author} • {dateStr}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaffNote(note.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        title="Delete note"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                  No internal notes added yet.
                </p>
              )}
            </div>

            {/* Add note input */}
            <form onSubmit={handleAddStaffNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add internal operator note..."
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={isAddingNote || !newNoteText.trim()}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          {/* Activity Logs / History */}
          {request.activityLogs && request.activityLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Activity History</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2 text-xs">
                {request.activityLogs.map((log) => (
                  <div key={log.id} className="py-1.5 px-2.5 flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{log.action}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {formatSafeTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                id="btn-detail-delete-prompt"
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-xl hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Upload</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-fadeIn">
                <span className="text-xs font-bold text-rose-700">Delete permanently?</span>
                <button
                  type="button"
                  onClick={() => onDeleteRequest(request.id)}
                  id="btn-detail-delete-confirm"
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenTicket}
              className="px-4 py-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-sky-200"
            >
              <Printer className="w-4 h-4" />
              <span>Print Job Ticket</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadZip}
              id="btn-detail-download-all"
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download All (ZIP)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
