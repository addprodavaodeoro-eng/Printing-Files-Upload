import React, { useState, useRef } from 'react';
import {
  Printer,
  Copy,
  Check,
  CheckCircle2,
  FileCheck,
  Layers,
  Settings2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Phone,
  User,
  Scissors,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { FileItem, LinkValidationResult, PrintOptions, FilePrintConfig } from '../types';
import { FileDropzone, formatFileSize } from './FileDropzone';

interface PrintRequestFormProps {
  token: string;
  linkData: LinkValidationResult;
  maxFileSizeMB?: number;
  onTrackOrder?: (refCode: string) => void;
  onBackToHome?: () => void;
}

interface RequestSuccessResult {
  referenceCode: string;
  requestId: string;
  fileCount: number;
  customerName?: string | null;
  customerPhone?: string | null;
  linkType?: string;
  printOptions?: PrintOptions | null;
  fileConfigs?: FilePrintConfig[];
  instructions?: string | null;
}

export const PrintRequestForm: React.FC<PrintRequestFormProps> = ({
  token,
  linkData,
  maxFileSizeMB = 50,
  onTrackOrder,
  onBackToHome,
}) => {
  // Step state: 1 = Files & Details, 2 = Print Specs, 3 = Review & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Customer Details
  const [customerName, setCustomerName] = useState(linkData.customerName || '');
  const [customerPhone, setCustomerPhone] = useState('');

  // Files
  const [files, setFiles] = useState<FileItem[]>([]);

  // System available options (loaded or defaults)
  const paperSizes = linkData.paperSizes && linkData.paperSizes.length > 0
    ? linkData.paperSizes
    : [
        'Short Bond (8.5" x 11")',
        'Long Bond (8.5" x 13")',
        'A4 (8.27" x 11.69")',
        'A3 (11.7" x 16.5")',
      ];

  const finishingOptions = linkData.finishingOptions && linkData.finishingOptions.length > 0
    ? linkData.finishingOptions
    : [
        'None / Loose Sheets',
        'Stapled (Top Left)',
        'Stapled (Booklet)',
        'Ring Bound (Coil)',
        'Folder / Fastener',
      ];

  // Global Print Specifications
  const [globalOptions, setGlobalOptions] = useState<PrintOptions>({
    paperSize: paperSizes[0],
    colorMode: 'black_and_white',
    sides: 'single',
    copies: 1,
    pageRange: 'All',
    binding: 'None / Loose Sheets',
    notes: '',
  });

  // Per-file customization
  const [enablePerFileCustomization, setEnablePerFileCustomization] = useState(false);
  const [perFileConfigs, setPerFileConfigs] = useState<Record<string, FilePrintConfig>>({});
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);

  // Submission & Progress
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<RequestSuccessResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Idempotency token
  const submissionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'req_' + Math.random().toString(36).substring(2)
  );

  const handleUpdateFileConfig = (filename: string, updates: Partial<FilePrintConfig>) => {
    setPerFileConfigs((prev) => {
      const current = prev[filename] || {
        filename,
        customized: true,
        paperSize: globalOptions.paperSize,
        colorMode: globalOptions.colorMode,
        sides: globalOptions.sides,
        copies: globalOptions.copies,
        pageRange: globalOptions.pageRange,
        notes: '',
      };
      return {
        ...prev,
        [filename]: {
          ...current,
          ...updates,
          customized: true,
        },
      };
    });
  };

  const handleToggleFileCustomized = (filename: string, enable: boolean) => {
    setPerFileConfigs((prev) => {
      if (!enable) {
        const next = { ...prev };
        delete next[filename];
        return next;
      }
      return {
        ...prev,
        [filename]: {
          filename,
          customized: true,
          paperSize: globalOptions.paperSize,
          colorMode: globalOptions.colorMode,
          sides: globalOptions.sides,
          copies: globalOptions.copies,
          pageRange: globalOptions.pageRange,
          notes: '',
        },
      };
    });
  };

  const handleNextToSpecs = () => {
    if (files.length === 0) {
      setErrorMessage('Please add at least one document or image to print.');
      return;
    }
    setErrorMessage(null);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextToReview = () => {
    if (globalOptions.copies < 1) {
      setErrorMessage('Number of copies must be at least 1.');
      return;
    }
    setErrorMessage(null);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setErrorMessage('No files attached.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setErrorMessage(null);

    const formData = new FormData();
    files.forEach((item) => {
      formData.append('files', item.file);
    });

    if (customerName.trim()) {
      formData.append('customerName', customerName.trim());
    }
    if (customerPhone.trim()) {
      formData.append('customerPhone', customerPhone.trim());
    }

    // Pass global print options
    formData.append('printOptions', JSON.stringify(globalOptions));

    // Pass additional instructions if any
    if (globalOptions.notes?.trim()) {
      formData.append('instructions', globalOptions.notes.trim());
    }

    // Pass per-file configs if any customized
    const customizedList = Object.values(perFileConfigs).filter((c) => c.customized);
    if (enablePerFileCustomization && customizedList.length > 0) {
      formData.append('fileConfigs', JSON.stringify(customizedList));
    }

    formData.append('submissionId', submissionIdRef.current);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 95);
          setUploadProgress(percent);
        }
      });

      const uploadPromise = new Promise<RequestSuccessResult>((resolve, reject) => {
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
                reject(new Error(errData.error || 'Failed to submit print request.'));
              } catch {
                reject(new Error('Failed to submit print request.'));
              }
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload. Please check connection.'));
        xhr.ontimeout = () => reject(new Error('Request timed out. Please try again.'));

        xhr.open('POST', `/api/upload/request/${encodeURIComponent(token)}`);
        xhr.send(formData);
      });

      const result = await uploadPromise;
      setUploadProgress(100);

      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessResult(result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 400);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error sending print request.');
    }
  };

  const handleCopyCode = () => {
    if (!successResult) return;
    navigator.clipboard.writeText(successResult.referenceCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // SUCCESS CONFIRMATION VIEW
  if (successResult) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-fadeIn space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              Print Request Submitted
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Order Received by Shop!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Our printing technicians are reviewing your files and specifications.
            </p>
          </div>

          {/* Reference Code Card */}
          <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-3 shadow-md max-w-md mx-auto">
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Your Reference Code
            </p>
            <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-white select-all py-1">
              {successResult.referenceCode}
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleCopyCode}
                id="btn-copy-success-code"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Reference Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Reference Code</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              Show this reference code at the counter when claiming your prints.
            </p>
          </div>

          {/* Summary Breakdown */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left text-xs space-y-2 max-w-md mx-auto">
            <p className="font-bold text-slate-700 text-xs uppercase tracking-wide">
              Print Summary
            </p>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Paper Size:</span>
                <strong className="text-slate-800">{globalOptions.paperSize}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Color Mode:</span>
                <strong className="text-slate-800 capitalize">
                  {globalOptions.colorMode === 'color' ? 'Full Color' : 'Black & White'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Sides:</span>
                <strong className="text-slate-800 capitalize">
                  {globalOptions.sides === 'double' ? 'Double Sided' : 'Single Sided'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Copies:</span>
                <strong className="text-slate-800">{globalOptions.copies} copy(ies)</strong>
              </div>
              {globalOptions.binding && globalOptions.binding !== 'None / Loose Sheets' && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">Finishing:</span>
                  <strong className="text-slate-800">{globalOptions.binding}</strong>
                </div>
              )}
              <div className="col-span-2 pt-1 border-t border-slate-200 flex justify-between">
                <span className="text-slate-500">Total Files:</span>
                <strong className="text-slate-800">{successResult.fileCount} file(s)</strong>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onTrackOrder && (
              <button
                type="button"
                onClick={() => onTrackOrder(successResult.referenceCode)}
                id="btn-track-success-order"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Track Order Status</span>
              </button>
            )}

            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Done / Return Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-10 px-4 space-y-6">
      {/* Stepper Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Remote Print Request
              </h2>
              <p className="text-xs text-slate-500">
                Oyangoren Printing Services • Step {currentStep} of 3
              </p>
            </div>
          </div>

          {/* Mini step chips */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                currentStep >= 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              1
            </span>
            <div className="w-4 h-0.5 bg-slate-200" />
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                currentStep >= 2 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </span>
            <div className="w-4 h-0.5 bg-slate-200" />
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                currentStep === 3 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          id="print-request-error"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 1: CUSTOMER DETAILS & FILES UPLOAD */}
      {/* ==================================================== */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Customer Details Box */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Customer Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="input-customer-name"
                  className="text-xs font-bold text-slate-700 block"
                >
                  Your Name
                </label>
                <input
                  type="text"
                  id="input-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="input-customer-phone"
                  className="text-xs font-bold text-slate-700 block"
                >
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  id="input-customer-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0917-123-4567"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  Used by staff to notify you once printing is finished.
                </p>
              </div>
            </div>
          </div>

          {/* Files Dropzone */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Select Documents to Print
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {files.length} {files.length === 1 ? 'file' : 'files'} attached
              </span>
            </div>

            <FileDropzone
              files={files}
              onFilesChange={setFiles}
              maxFileSizeMB={maxFileSizeMB}
            />
          </div>

          {/* Navigation to Step 2 */}
          <div className="flex items-center justify-between pt-2">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleNextToSpecs}
                disabled={files.length === 0}
                id="btn-step1-next"
                className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Continue to Print Specs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 2: PRINT SPECIFICATIONS & CUSTOMIZATION */}
      {/* ==================================================== */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Print Specs Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Default Print Specifications
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Applies to all uploaded documents
              </span>
            </div>

            {/* Paper Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Paper Size</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paperSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGlobalOptions((prev) => ({ ...prev, paperSize: size }))}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                      globalOptions.paperSize === size
                        ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Color Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGlobalOptions((prev) => ({ ...prev, colorMode: 'black_and_white' }))}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    globalOptions.colorMode === 'black_and_white'
                      ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-900" />
                    <span>Black & White (Monochrome)</span>
                  </div>
                  {globalOptions.colorMode === 'black_and_white' && <Check className="w-4 h-4 text-sky-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setGlobalOptions((prev) => ({ ...prev, colorMode: 'color' }))}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    globalOptions.colorMode === 'color'
                      ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-sky-500" />
                    <span>Full Color</span>
                  </div>
                  {globalOptions.colorMode === 'color' && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              </div>
            </div>

            {/* Sides & Copies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Single or Double Sided */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Printing Sides</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalOptions((prev) => ({ ...prev, sides: 'single' }))}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      globalOptions.sides === 'single'
                        ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Single Sided (1 side)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalOptions((prev) => ({ ...prev, sides: 'double' }))}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      globalOptions.sides === 'double'
                        ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Back to Back (Double)
                  </button>
                </div>
              </div>

              {/* Number of Copies */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Number of Copies</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGlobalOptions((prev) => ({ ...prev, copies: Math.max(1, prev.copies - 1) }))
                    }
                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 flex items-center justify-center cursor-pointer shadow-xs"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={globalOptions.copies}
                    onChange={(e) =>
                      setGlobalOptions((prev) => ({
                        ...prev,
                        copies: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-20 text-center font-bold rounded-xl border border-slate-300 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGlobalOptions((prev) => ({ ...prev, copies: prev.copies + 1 }))
                    }
                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 flex items-center justify-center cursor-pointer shadow-xs"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 pl-1">
                    {globalOptions.copies === 1 ? 'set' : 'sets'}
                  </span>
                </div>
              </div>
            </div>

            {/* Page Range & Binding */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Page Range
                </label>
                <input
                  type="text"
                  value={globalOptions.pageRange || 'All'}
                  onChange={(e) =>
                    setGlobalOptions((prev) => ({ ...prev, pageRange: e.target.value }))
                  }
                  placeholder="e.g. All or 1-5, 8, 10"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  Enter "All" or comma-separated pages like "1-3, 5".
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Finishing / Binding
                </label>
                <select
                  value={globalOptions.binding || 'None / Loose Sheets'}
                  onChange={(e) =>
                    setGlobalOptions((prev) => ({ ...prev, binding: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {finishingOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Additional Instructions / Notes for Staff
              </label>
              <textarea
                rows={2}
                value={globalOptions.notes || ''}
                onChange={(e) =>
                  setGlobalOptions((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="e.g. Please staple top left corner, glossy paper if available, etc."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* PER-FILE CUSTOMIZATION TOGGLE */}
          {files.length > 1 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Configure Individual Files Differently?
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Use this if one document needs Color and another needs B&W, or different paper sizes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnablePerFileCustomization(!enablePerFileCustomization)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    enablePerFileCustomization ? 'bg-sky-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>

              {/* Per file config accordion */}
              {enablePerFileCustomization && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {files.map((f, idx) => {
                    const cfg = perFileConfigs[f.name];
                    const isCustom = !!cfg?.customized;
                    const isExpanded = expandedFileIndex === idx;

                    return (
                      <div
                        key={f.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <FileCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {f.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({formatFileSize(f.size)})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isCustom}
                                onChange={(e) => handleToggleFileCustomized(f.name, e.target.checked)}
                                className="rounded text-sky-600 focus:ring-sky-500"
                              />
                              <span className="text-[11px] font-semibold">Custom</span>
                            </label>

                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => setExpandedFileIndex(isExpanded ? null : idx)}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Per-file editor expanded */}
                        {isCustom && isExpanded && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 text-xs animate-fadeIn">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block">
                                  Color
                                </label>
                                <select
                                  value={cfg.colorMode || globalOptions.colorMode}
                                  onChange={(e) =>
                                    handleUpdateFileConfig(f.name, {
                                      colorMode: e.target.value as any,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                                >
                                  <option value="black_and_white">Black & White</option>
                                  <option value="color">Full Color</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block">
                                  Sides
                                </label>
                                <select
                                  value={cfg.sides || globalOptions.sides}
                                  onChange={(e) =>
                                    handleUpdateFileConfig(f.name, {
                                      sides: e.target.value as any,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                                >
                                  <option value="single">Single Sided</option>
                                  <option value="double">Double Sided</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block">
                                  Copies
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={cfg.copies || globalOptions.copies}
                                  onChange={(e) =>
                                    handleUpdateFileConfig(f.name, {
                                      copies: Math.max(1, parseInt(e.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block">
                                  Page Range
                                </label>
                                <input
                                  type="text"
                                  value={cfg.pageRange || globalOptions.pageRange || 'All'}
                                  onChange={(e) =>
                                    handleUpdateFileConfig(f.name, {
                                      pageRange: e.target.value,
                                    })
                                  }
                                  placeholder="All or 1-3"
                                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Files</span>
            </button>

            <button
              type="button"
              onClick={handleNextToReview}
              id="btn-step2-next"
              className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Review Order Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 3: REVIEW & FINAL SUBMISSION */}
      {/* ==================================================== */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                Ready to Send
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Review Your Print Order
              </h3>
              <p className="text-xs text-slate-500">
                Please verify your details and printing specifications before submitting.
              </p>
            </div>

            {/* Customer info preview */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Customer Name:</span>
                <strong className="text-slate-900">{customerName || 'Anonymous / Counter'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Number:</span>
                <strong className="text-slate-900">{customerPhone || 'None specified'}</strong>
              </div>
            </div>

            {/* Print specs review */}
            <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-200 text-xs space-y-2">
              <p className="font-bold text-sky-900 uppercase tracking-wide text-[11px]">
                Global Printing Specifications
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-500 block text-[10px]">Paper Size</span>
                  <span className="font-bold text-slate-900">{globalOptions.paperSize}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Color Mode</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {globalOptions.colorMode === 'color' ? 'Full Color' : 'B&W'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Sides</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {globalOptions.sides === 'double' ? 'Double Sided' : 'Single Sided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Copies</span>
                  <span className="font-bold text-slate-900">{globalOptions.copies} set(s)</span>
                </div>
              </div>

              {globalOptions.binding && globalOptions.binding !== 'None / Loose Sheets' && (
                <div className="pt-2 border-t border-sky-100 flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-sky-600" />
                  <span className="text-slate-600">Finishing:</span>
                  <strong className="text-slate-900">{globalOptions.binding}</strong>
                </div>
              )}

              {globalOptions.notes && (
                <div className="pt-2 border-t border-sky-100 text-slate-700">
                  <span className="text-slate-500 block text-[10px]">Special Instructions:</span>
                  <p className="italic text-slate-800">"{globalOptions.notes}"</p>
                </div>
              )}
            </div>

            {/* Files Attached List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Attached Files ({files.length})</span>
                <span className="text-slate-400">
                  Total: {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {files.map((f, i) => {
                  const cfg = perFileConfigs[f.name];
                  const hasCustom = enablePerFileCustomization && cfg?.customized;

                  return (
                    <div
                      key={f.id}
                      className="p-3 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{f.name}</span>
                        {hasCustom && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Custom specs
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 flex-shrink-0">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload Progress bar */}
            {isSubmitting && (
              <div className="space-y-1.5 p-4 rounded-2xl bg-sky-50 border border-sky-200 animate-fadeIn">
                <div className="flex justify-between text-xs font-bold text-sky-900">
                  <span>Uploading files to Oyangoren Printing...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-sky-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Edit Specs</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || files.length === 0}
                onClick={handleSubmit}
                id="btn-submit-print-order"
                className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin text-lg">⏳</span>
                    <span>Sending Order ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirm & Send Print Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
