import React, { useState } from 'react';
import {
  X,
  Plus,
  Copy,
  Check,
  QrCode,
  MessageSquare,
  Clock,
  User,
  HelpCircle,
  FileCheck,
  Printer,
  FileText,
  UploadCloud,
} from 'lucide-react';
import { UploadLink, LinkType } from '../types';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: (link: UploadLink) => void;
  token: string;
  onOpenQR: (url: string, title: string, subtitle?: string) => void;
}

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  isOpen,
  onClose,
  onLinkCreated,
  token,
  onOpenQR,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('full_request');
  const [instructionsEnabled, setInstructionsEnabled] = useState(true);
  const [expirationOption, setExpirationOption] = useState<'1h' | '24h' | '3d' | '7d' | 'custom' | 'none'>('24h');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [uploadLimitOption, setUploadLimitOption] = useState<'1' | '5' | 'unlimited' | 'custom'>('1');
  const [customUploadLimit, setCustomUploadLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state for created link
  const [createdLink, setCreatedLink] = useState<UploadLink | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let uploadLimit: number | null = 1;
      if (uploadLimitOption === 'unlimited') {
        uploadLimit = null;
      } else if (uploadLimitOption === '5') {
        uploadLimit = 5;
      } else if (uploadLimitOption === 'custom') {
        uploadLimit = customUploadLimit ? Number(customUploadLimit) : null;
      }

      const res = await fetch('/api/admin/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: customerName.trim() || null,
          linkType,
          instructionsEnabled: linkType !== 'files_only',
          expirationOption,
          customExpiresAt: expirationOption === 'custom' ? customExpiresAt : null,
          uploadLimit,
          active: true,
        }),
      });

      if (res.ok) {
        const link: UploadLink = await res.json();
        setCreatedLink(link);
        onLinkCreated(link);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to generate customer link');
      }
    } catch {
      setErrorMessage('Network error while generating link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullUrl = (linkToken: string) => {
    return `${window.location.origin}/request/${linkToken}`;
  };

  const getFormattedMessage = (linkToken: string) => {
    const url = getFullUrl(linkToken);
    return `Hello! Please upload your printable files to Oyangoren Printing Services using this link: ${url} Thank you!`;
  };

  const handleCopyLink = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(getFullUrl(createdLink.token));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(getFormattedMessage(createdLink.token));
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleClose = () => {
    setCreatedLink(null);
    setCustomerName('');
    setInstructionsEnabled(true);
    setExpirationOption('24h');
    setCustomExpiresAt('');
    setUploadLimitOption('1');
    setCustomUploadLimit('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
        id="create-link-modal-dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {createdLink ? 'Link Generated Successfully' : 'Create Customer Upload Link'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {createdLink
                ? 'Share this link or message directly with your customer.'
                : 'Configure link settings, expiration, and instructions.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            id="btn-close-create-link"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW 1: CREATED LINK SUCCESS VIEW */}
        {createdLink ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-sm">Upload Link Ready</span>
              </div>
              {createdLink.customerName && (
                <p className="text-xs text-emerald-800">
                  Customer: <strong>{createdLink.customerName}</strong>
                </p>
              )}
            </div>

            {/* Direct URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Direct URL</label>
              <div className="p-3 bg-slate-100 rounded-xl font-mono text-xs text-slate-800 break-all select-all border border-slate-200">
                {getFullUrl(createdLink.token)}
              </div>
            </div>

            {/* Copy Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                id="btn-created-copy-link"
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyMessage}
                id="btn-created-copy-message"
                className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Message Copied!</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>

            {/* Preformatted customer message preview */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <p className="font-bold text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                WhatsApp / SMS Preview:
              </p>
              <p className="italic">{getFormattedMessage(createdLink.token)}</p>
            </div>

            {/* QR & Finish */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onOpenQR(
                    getFullUrl(createdLink.token),
                    `Upload QR for ${createdLink.customerName || 'Customer'}`,
                    createdLink.instructionsEnabled ? 'Printing instructions enabled' : undefined
                  );
                }}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-sky-50 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Show QR Code</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Customer Name */}
            <div className="space-y-1">
              <label htmlFor="input-newlink-customer" className="text-xs font-bold text-slate-700 block">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                id="input-newlink-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Maria Santos / Barangay Hall"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400">
                Shown to the customer when opening the upload page.
              </p>
            </div>

            {/* Link Mode / Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Link Workflow Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLinkType('full_request')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    linkType === 'full_request'
                      ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 text-sky-950 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Printer className={`w-4 h-4 ${linkType === 'full_request' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Print Request</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Structured paper, color, copies & per-file specs.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setLinkType('files_instructions')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    linkType === 'files_instructions'
                      ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 text-sky-950 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className={`w-4 h-4 ${linkType === 'files_instructions' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Files + Notes</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    File uploads plus a freeform instruction box.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setLinkType('files_only')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    linkType === 'files_only'
                      ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 text-sky-950 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <UploadCloud className={`w-4 h-4 ${linkType === 'files_only' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs">Files Only</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Fastest file transfer without configuration.
                  </p>
                </button>
              </div>
            </div>

            {/* Expiration Options */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Link Expiration
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                {(['1h', '24h', '3d', '7d', 'none', 'custom'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setExpirationOption(opt)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      expirationOption === opt
                        ? 'bg-sky-50 text-sky-800 border-sky-400 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt === '1h' && '1 Hour'}
                    {opt === '24h' && '24 Hours (Default)'}
                    {opt === '3d' && '3 Days'}
                    {opt === '7d' && '7 Days'}
                    {opt === 'none' && 'No Expiration'}
                    {opt === 'custom' && 'Custom Date'}
                  </button>
                ))}
              </div>

              {expirationOption === 'custom' && (
                <div className="pt-1.5">
                  <input
                    type="datetime-local"
                    value={customExpiresAt}
                    onChange={(e) => setCustomExpiresAt(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Upload Limits */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Upload Limit
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-medium">
                {(['1', '5', 'unlimited', 'custom'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setUploadLimitOption(opt)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      uploadLimitOption === opt
                        ? 'bg-sky-50 text-sky-800 border-sky-400 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt === '1' && '1 (Single)'}
                    {opt === '5' && '5 Uploads'}
                    {opt === 'unlimited' && 'Unlimited'}
                    {opt === 'custom' && 'Custom...'}
                  </button>
                ))}
              </div>

              {uploadLimitOption === 'custom' && (
                <div className="pt-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customUploadLimit}
                    onChange={(e) => setCustomUploadLimit(e.target.value)}
                    placeholder="Enter maximum submissions allowed"
                    required
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                id="btn-submit-new-link"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Generating...' : 'Create Upload Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
