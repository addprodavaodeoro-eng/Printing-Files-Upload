import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Send,
  AlertCircle,
  Copy,
  Check,
  Clock,
  User,
  HelpCircle,
  FileCheck,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { FileItem, LinkValidationResult } from '../types';
import { FileDropzone, formatFileSize } from './FileDropzone';
import { useI18n } from '../i18n';
import { PrintRequestForm } from './PrintRequestForm';

interface RemoteUploadProps {
  token: string;
  maxFileSizeMB?: number;
  onTrackOrder?: (refCode: string) => void;
  onBackToHome?: () => void;
}

interface RemoteSuccessData {
  referenceCode: string;
  fileCount: number;
  customerName?: string | null;
  instructions?: string | null;
  files: { id: string; name: string; size: number }[];
}

export const RemoteUpload: React.FC<RemoteUploadProps> = ({
  token,
  maxFileSizeMB = 50,
  onTrackOrder,
  onBackToHome,
}) => {
  const { t } = useI18n();
  const [isValidating, setIsValidating] = useState(true);
  const [linkData, setLinkData] = useState<LinkValidationResult | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [instructions, setInstructions] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<RemoteSuccessData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Idempotency token to protect against accidental retries
  const currentSubmissionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'sub_' + Math.random().toString(36).substring(2)
  );

  // Validate link token on mount
  useEffect(() => {
    let isMounted = true;
    setIsValidating(true);
    setErrorMessage(null);

    fetch(`/api/request/verify/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: LinkValidationResult) => {
        if (isMounted) {
          setLinkData(data);
          setIsValidating(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLinkData({
            valid: false,
            error: 'server_error',
            errorMessage: 'Upload interrupted. Please check your internet connection and try again.',
          });
          setIsValidating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (files.length === 0) {
      setErrorMessage(t.noFilesSelected);
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    files.forEach((item) => {
      formData.append('files', item.file);
    });
    if (linkData?.instructionsEnabled && instructions.trim()) {
      formData.append('instructions', instructions.trim());
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

      const uploadPromise = new Promise<RemoteSuccessData>((resolve, reject) => {
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

        xhr.open('POST', `/api/upload/request/${encodeURIComponent(token)}`);
        xhr.send(formData);
      });

      const res = await uploadPromise;
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setSuccessData(res);
        setFiles([]);
        setInstructions('');
        currentSubmissionIdRef.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'sub_' + Math.random().toString(36).substring(2);
      }, 350);
    } catch (err: unknown) {
      setIsUploading(false);
      // NOTE: Do NOT clear files so user can easily retry
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Upload interrupted. Please check your internet connection and try again.'
      );
    }
  };

  const copyRefCode = () => {
    if (successData?.referenceCode) {
      navigator.clipboard.writeText(successData.referenceCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  // 1. LOADING STATE
  if (isValidating) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-slate-600 font-medium text-sm">
            Verifying upload link...
          </p>
        </div>
      </div>
    );
  }

  // 2. INVALID / EXPIRED / DISABLED LINK SCREEN
  if (!linkData || !linkData.valid) {
    let title = t.linkNotFoundTitle;
    let desc = t.linkNotFoundDesc;

    if (linkData?.error === 'expired') {
      title = t.linkExpiredTitle;
      desc = t.linkExpiredDesc;
    } else if (linkData?.error === 'disabled') {
      title = t.linkDisabledTitle;
      desc = t.linkDisabledDesc;
    } else if (linkData?.error === 'limit_reached') {
      title = t.linkLimitTitle;
      desc = t.linkLimitDesc;
    }

    return (
      <div className="w-full max-w-lg mx-auto py-16 px-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
          </div>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {t.backToHome}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. FULL PRINT REQUEST WORKFLOW
  if (linkData.linkType === 'full_request') {
    return (
      <PrintRequestForm
        token={token}
        linkData={linkData}
        maxFileSizeMB={maxFileSizeMB}
        onTrackOrder={onTrackOrder}
        onBackToHome={onBackToHome}
      />
    );
  }

  // 4. SUCCESS SCREEN (for standard file handoff)
  if (successData) {
    return (
      <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-4">
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

          {/* Reference Code Box */}
          <div className="p-5 sm:p-6 bg-slate-900 rounded-2xl text-white space-y-3 shadow-inner">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Your Reference Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span
                id="text-remote-reference-code"
                className="text-3xl sm:text-4xl font-extrabold tracking-wider text-sky-400 font-mono"
              >
                {successData.referenceCode}
              </span>
              <button
                type="button"
                onClick={copyRefCode}
                id="btn-copy-remote-code"
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
            {successData.customerName && (
              <p className="text-xs text-sky-300 font-semibold">
                Customer: {successData.customerName}
              </p>
            )}
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please show this code to the staff if needed.
            </p>
          </div>

          {/* Printing Instructions Recap */}
          {successData.instructions && (
            <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-left space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                {t.printingInstructions}
              </p>
              <p className="text-xs sm:text-sm text-amber-900 whitespace-pre-wrap font-sans">
                {successData.instructions}
              </p>
            </div>
          )}

          {/* Uploaded Files Recap */}
          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Files Uploaded ({successData.fileCount})</span>
              <span className="text-emerald-600 font-medium">Received by Shop</span>
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

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={copyRefCode}
              id="btn-remote-copy-code"
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
                id="btn-remote-track"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Track Status</span>
              </button>
            )}

            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                id="btn-remote-done"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                {t.backToHome}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. MAIN REMOTE UPLOAD FORM
  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header with Customer info */}
        <div className="text-center space-y-2 pb-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Oyangoren Printing Services
          </h1>
          <h2 className="text-base sm:text-lg font-bold text-sky-700">
            {t.remoteSendFiles}
          </h2>

          {linkData.customerName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs sm:text-sm font-semibold">
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {t.forCustomer}: {linkData.customerName}
              </span>
            </div>
          )}

          {linkData.expiresAt && (
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>
                Link expires: {new Date(linkData.expiresAt).toLocaleDateString()} {new Date(linkData.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Error Banner with Try Again */}
        {errorMessage && (
          <div
            id="remote-error-banner"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900">Upload interrupted</p>
                <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isUploading || files.length === 0}
              id="btn-retry-remote-upload"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-xs shrink-0 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Try Again
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Dropzone */}
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            maxFileSizeMB={maxFileSizeMB}
            disabled={isUploading}
          />

          {/* Printing Instructions: ONLY when enabled by administrator */}
          {linkData.instructionsEnabled && (
            <div className="space-y-2 pt-2" id="printing-instructions-section">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="instructions-textarea"
                  className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <span>{t.printingInstructions}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    (Optional)
                  </span>
                </label>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <HelpCircle className="w-3 h-3" />
                  <span>Free text</span>
                </div>
              </div>

              <textarea
                id="instructions-textarea"
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. 2 copies, Short bond paper, colored, page 1 to 5 only"
                disabled={isUploading}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-300 p-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <p>Include copies, paper size, color preferences, etc.</p>
                <span>{instructions.length}/2000</span>
              </div>
            </div>
          )}

          {/* Progress Box */}
          {isUploading && (
            <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-200 space-y-2 animate-fadeIn">
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

          {/* Submit Action */}
          <div>
            <button
              type="submit"
              disabled={files.length === 0 || isUploading}
              id="btn-submit-remote-request"
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
                  <Send className="w-5 h-5" />
                  <span>
                    {files.length > 0
                      ? `Send Files (${files.length})`
                      : 'Send Files'}
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
        </form>
      </div>
    </div>
  );
};
