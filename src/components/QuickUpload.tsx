import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  Upload,
  Copy,
  Check,
  RefreshCw,
  Clock,
  AlertCircle,
  FileCheck,
  Shield,
} from 'lucide-react';
import { FileItem } from '../types';
import { FileDropzone, formatFileSize } from './FileDropzone';
import { useI18n } from '../i18n';

interface QuickUploadProps {
  maxFileSizeMB?: number;
  onTrackOrder?: (refCode: string) => void;
}

interface UploadSuccessData {
  referenceCode: string;
  fileCount: number;
  customerName?: string | null;
  files: { id: string; name: string; size: number }[];
}

export const QuickUpload: React.FC<QuickUploadProps> = ({
  maxFileSizeMB = 50,
  onTrackOrder,
}) => {
  const { t } = useI18n();
  const [customerName, setCustomerName] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<UploadSuccessData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Idempotency token per upload session to prevent duplicate records
  const currentSubmissionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'sub_' + Math.random().toString(36).substring(2)
  );

  const handleUpload = async () => {
    if (files.length === 0) {
      setServerError(t.noFilesSelected);
      return;
    }

    setServerError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    files.forEach((item) => {
      formData.append('files', item.file);
    });

    if (customerName.trim()) {
      formData.append('customerName', customerName.trim());
    }
    formData.append('submissionId', currentSubmissionIdRef.current);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 95);
          setUploadProgress(percent);
        }
      });

      const uploadPromise = new Promise<UploadSuccessData>((resolve, reject) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch {
                reject(new Error('Invalid response from server'));
              }
            } else {
              try {
                const errData = JSON.parse(xhr.responseText);
                reject(new Error(errData.error || 'Upload interrupted. Please check your internet connection and try again.'));
              } catch {
                reject(new Error('Upload interrupted. Please check your internet connection and try again.'));
              }
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('Upload interrupted. Please check your internet connection and try again.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload interrupted. Please check your internet connection and try again.'));
        };

        xhr.open('POST', '/api/upload/quick');
        xhr.send(formData);
      });

      const res = await uploadPromise;
      setUploadProgress(100);

      // Brief delay for clean state transition
      setTimeout(() => {
        setIsUploading(false);
        setSuccessData(res);
        setFiles([]);
        setCustomerName('');
        // Refresh submission ID for next potential upload
        currentSubmissionIdRef.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'sub_' + Math.random().toString(36).substring(2);
      }, 350);
    } catch (err: unknown) {
      setIsUploading(false);
      // NOTE: Do NOT clear files on failure so customer can retry easily
      setServerError(
        err instanceof Error
          ? err.message
          : 'Upload interrupted. Please check your internet connection and try again.'
      );
    }
  };

  const copyReferenceCode = () => {
    if (successData?.referenceCode) {
      navigator.clipboard.writeText(successData.referenceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const resetUpload = () => {
    setSuccessData(null);
    setFiles([]);
    setCustomerName('');
    setServerError(null);
    setUploadProgress(0);
    currentSubmissionIdRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'sub_' + Math.random().toString(36).substring(2);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-4">
      {/* SUCCESS SCREEN */}
      {successData ? (
        <div
          id="upload-success-container"
          className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xl text-center space-y-6 animate-fadeIn"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Upload Complete
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
              Your files were successfully sent to Oyangoren Printing Services.
            </p>
          </div>

          {/* Prominent Reference Code Box */}
          <div className="p-5 sm:p-6 bg-slate-900 rounded-2xl text-white space-y-3 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Your Reference Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span
                id="text-reference-code"
                className="text-3xl sm:text-4xl font-extrabold tracking-wider text-sky-400 font-mono"
              >
                {successData.referenceCode}
              </span>
              <button
                type="button"
                onClick={copyReferenceCode}
                id="btn-copy-ref-code"
                title="Copy reference code"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please show this code to the staff if needed.
            </p>
          </div>

          {/* Files Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Files Uploaded ({successData.fileCount})</span>
              <span className="text-emerald-600 font-medium">Ready in queue</span>
            </div>
            <ul className="divide-y divide-slate-200/60 text-xs sm:text-sm text-slate-700">
              {successData.files.map((file, i) => (
                <li key={file.id || i} className="py-2 flex items-center justify-between gap-2">
                  <span className="truncate flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <span className="text-slate-400 text-xs flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={copyReferenceCode}
              id="btn-copy-code-action"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Code Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            {onTrackOrder && (
              <button
                type="button"
                onClick={() => onTrackOrder(successData.referenceCode)}
                id="btn-track-status"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Track Status</span>
              </button>
            )}

            <button
              type="button"
              onClick={resetUpload}
              id="btn-upload-another"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Send More Files</span>
            </button>
          </div>
        </div>
      ) : (
        /* UPLOAD FORM */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-1.5 pb-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Oyangoren Printing Services
            </h1>
            <h2 className="text-base sm:text-lg font-bold text-sky-700">
              Send Your Files
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Scan our QR code or upload your documents directly to our printing queue.
            </p>
          </div>

          {/* Customer Name Field (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Name (Optional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g., Juan Dela Cruz (Optional)"
              id="input-customer-name-quick"
              disabled={isUploading}
              maxLength={100}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 transition-colors"
            />
          </div>

          {/* Error Notice with Try Again Action */}
          {serverError && (
            <div
              id="error-server-banner"
              className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">Upload interrupted</p>
                  <p className="text-xs text-rose-700 mt-0.5">{serverError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
                id="btn-retry-upload"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-xs shrink-0 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Dropzone */}
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            maxFileSizeMB={maxFileSizeMB}
            disabled={isUploading}
          />

          {/* Progress Indicator */}
          {isUploading && (
            <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-200 space-y-2 animate-fadeIn" id="upload-progress-box">
              <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>Uploading {uploadProgress}%</span>
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-sky-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-sky-700 text-center font-medium">
                Please keep this page open while files are transmitting...
              </p>
            </div>
          )}

          {/* Large Primary Upload Action */}
          <div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              id="btn-upload-files"
              className={`w-full py-4 px-6 rounded-2xl text-base font-bold shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                files.length === 0 || isUploading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 active:scale-[0.99]'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>
                    {files.length > 0
                      ? `Upload Files (${files.length})`
                      : 'Upload Files'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Privacy Notice */}
          <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5 text-slate-500">
            <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-slate-700">Privacy Notice: </span>
              Your files are used only to process your printing request and are accessible only to authorized Oyangoren Printing Services staff.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
