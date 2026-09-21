import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  Trash2,
  AlertCircle,
  File,
} from 'lucide-react';
import { FileItem } from '../types';
import { useI18n } from '../i18n';

interface FileDropzoneProps {
  files: FileItem[];
  onFilesChange: (files: FileItem[]) => void;
  maxFileSizeMB?: number;
  disabled?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') {
    return <FileText className="w-6 h-6 text-rose-500 flex-shrink-0" />;
  }
  if (['doc', 'docx'].includes(ext)) {
    return <FileText className="w-6 h-6 text-sky-600 flex-shrink-0" />;
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className="w-6 h-6 text-emerald-600 flex-shrink-0" />;
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return <Presentation className="w-6 h-6 text-amber-600 flex-shrink-0" />;
  }
  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    return <FileImage className="w-6 h-6 text-indigo-500 flex-shrink-0" />;
  }
  return <File className="w-6 h-6 text-slate-500 flex-shrink-0" />;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  files,
  onFilesChange,
  maxFileSizeMB = 50,
  disabled = false,
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const allowedExtensions = [
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
  ];

  const validateAndAddFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setClientError(null);

    const maxBytes = maxFileSizeMB * 1024 * 1024;
    const newItems: FileItem[] = [];
    const errors: string[] = [];

    Array.from(selectedFiles).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // Check duplicate
      const alreadyAdded = files.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (alreadyAdded) {
        return;
      }

      // Check extension
      if (!allowedExtensions.includes(ext)) {
        errors.push(`"${file.name}": Unsupported format (.${ext}).`);
        return;
      }

      // Check size
      if (file.size > maxBytes) {
        errors.push(
          `"${file.name}": Exceeds limit of ${maxFileSizeMB} MB (${formatFileSize(file.size)}).`
        );
        return;
      }

      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || ext,
        progress: 0,
        status: 'pending',
      });
    });

    if (errors.length > 0) {
      setClientError(errors.join(' '));
    }

    if (newItems.length > 0) {
      onFilesChange([...files, ...newItems]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    onFilesChange([]);
    setClientError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full space-y-4">
      {/* Hidden Native Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
        className="hidden"
        id="file-input-element"
        onChange={(e) => {
          validateAndAddFiles(e.target.files);
          // reset input value so re-selecting same file triggers change
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        disabled={disabled}
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) fileInputRef.current?.click();
        }}
        id="dropzone-container"
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-200 ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
            : isDragOver
            ? 'border-sky-500 bg-sky-50/80 scale-[1.01] shadow-lg shadow-sky-500/10'
            : 'border-slate-300 hover:border-sky-400 bg-white hover:bg-sky-50/20 shadow-sm'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
              isDragOver
                ? 'bg-sky-500 text-white scale-110 shadow-md'
                : 'bg-sky-100 text-sky-600'
            }`}
          >
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">
              {isDragOver ? t.dragDropActive : t.sendFilesSub}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              {t.dragDropText}
            </p>
          </div>

          {/* Large Primary Action Button */}
          <div className="pt-2">
            <span
              id="btn-select-files"
              className="inline-flex items-center justify-center px-6 py-3 text-sm sm:text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md hover:shadow-sky-500/25 transition-all"
            >
              {t.selectFiles}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 pt-1 max-w-md mx-auto">
            {t.supportedFormatsNotice} • {t.maxFileSize}: {maxFileSizeMB} MB
          </p>
        </div>
      </div>

      {/* Client Error Banner */}
      {clientError && (
        <div
          id="error-client-banner"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-semibold">Validation warning: </span>
            {clientError}
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-3 pt-2" id="selected-files-list">
          <div className="flex items-center justify-between text-xs sm:text-sm px-1">
            <div className="font-semibold text-slate-700 flex items-center gap-2">
              <span>{files.length} {files.length === 1 ? 'file ready' : 'files ready'}</span>
              <span className="text-slate-400 font-normal">({formatFileSize(totalBytes)})</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={clearAll}
                id="btn-clear-all-files"
                className="text-slate-500 hover:text-rose-600 text-xs font-medium underline transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {files.map((item, idx) => (
              <div
                key={item.id}
                id={`file-row-${idx}`}
                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(item.name)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-900 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {formatFileSize(item.size)}
                    </p>
                  </div>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    id={`btn-remove-file-${idx}`}
                    title={t.remove}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus:outline-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
