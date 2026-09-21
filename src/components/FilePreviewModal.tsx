import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { UploadedFileInfo } from '../types';
import { formatFileSize } from './FileDropzone';
import { downloadAuthenticatedFile, fetchAuthenticatedBlobUrl } from '../utils/download';

interface FilePreviewModalProps {
  file: UploadedFileInfo | null;
  token: string;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  token,
  onClose,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!file) return null;

  const isPdf = file.mimeType === 'application/pdf' || file.originalFilename.toLowerCase().endsWith('.pdf');
  const isImage = file.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.originalFilename);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    setBlobUrl(null);

    fetchAuthenticatedBlobUrl(`/api/admin/files/${file.id}/preview`, token)
      .then((url) => {
        if (active) {
          setBlobUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(err.message || 'Failed to load preview');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [file.id, token]);

  const handleDownload = () => {
    downloadAuthenticatedFile(`/api/admin/files/${file.id}/download`, token, file.originalFilename);
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        id="file-preview-modal-dialog"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center shrink-0">
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {file.originalFilename}
              </h3>
              <p className="text-xs text-slate-400">
                {formatFileSize(file.fileSize)} • {isPdf ? 'PDF Document' : isImage ? 'Image' : 'File'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {blobUrl && (
              <button
                type="button"
                onClick={handleOpenNewTab}
                title="Open in new tab"
                id="btn-preview-new-tab"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              title="Download original file"
              id="btn-preview-download"
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              id="btn-close-file-preview"
              title="Close preview"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-2 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Loading secure preview...</p>
            </div>
          ) : errorMsg ? (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
              <FileText className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Preview Failed</h4>
              <p className="text-xs text-rose-600 mt-1 mb-4">{errorMsg}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download File Instead
              </button>
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={file.originalFilename}
              className="w-full h-full rounded-2xl bg-white shadow-inner border border-slate-200"
            />
          ) : isImage && blobUrl ? (
            <div className="max-w-full max-h-full flex items-center justify-center p-2">
              <img
                src={blobUrl}
                alt={file.originalFilename}
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-md bg-white border border-slate-200"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Preview Not Available</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                This file format cannot be rendered directly in the browser preview.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download to View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
