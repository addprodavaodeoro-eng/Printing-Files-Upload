import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  url: string;
  onOpenPrintSign?: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  url,
  onOpenPrintSign,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((data) => setDataUrl(data))
        .catch((err) => console.error('QR generation failed:', err));
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Oyangoren_QR_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5"
        id="qr-modal-dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="btn-close-qr-modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Canvas / Image Display */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR Code"
              className="w-56 h-56 rounded-xl shadow-sm bg-white p-2 border border-slate-100"
              id="img-qr-preview"
            />
          ) : (
            <div className="w-56 h-56 rounded-xl bg-slate-200 animate-pulse" />
          )}
          <p className="text-[11px] text-slate-400 font-medium mt-3 text-center">
            Scan using any smartphone camera to open link instantly
          </p>
        </div>

        {/* URL Box with 1-click Copy */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Direct Web Link:</span>
            <button
              type="button"
              onClick={handleCopy}
              id="btn-qr-copy-link"
              className="text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 text-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-xs text-slate-700 truncate select-all border border-slate-200">
            {url}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDownload}
            id="btn-download-qr-png"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          {onOpenPrintSign ? (
            <button
              type="button"
              onClick={onOpenPrintSign}
              id="btn-open-print-sign"
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Shop Sign</span>
            </button>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              id="link-open-direct"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Link</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
