import React, { useState, useEffect } from 'react';
import { X, Printer, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface PrintSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

export const PrintSignModal: React.FC<PrintSignModalProps> = ({
  isOpen,
  onClose,
  url,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 800,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((data) => setQrDataUrl(data))
        .catch((err) => console.error('QR sign error:', err));
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      {/* Container - printable */}
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto print:m-0 print:p-0 print:shadow-none print:border-none print:w-full">
        {/* Top Controls (Hidden during print) */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
          <span className="text-sm font-bold text-slate-700">
            Printable Shop Counter Sign
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              id="btn-trigger-print"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sign Now</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              id="btn-close-print-sign"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sign Content */}
        <div
          id="printable-counter-sign"
          className="border-4 border-slate-900 rounded-3xl p-6 sm:p-8 text-center space-y-6 bg-white print:border-4 print:border-black print:rounded-2xl print:p-8"
        >
          {/* Header */}
          <div className="space-y-1.5">
            <div className="inline-block px-3 py-1 bg-slate-900 text-sky-300 rounded-full text-xs font-bold uppercase tracking-widest print:bg-black print:text-white">
              Self-Service File Upload
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Oyangoren Printing Services
            </h1>
            <p className="text-sm sm:text-base font-bold text-sky-700 print:text-black">
              Scan with your phone to send files for printing
            </p>
          </div>

          {/* QR Code Centerpiece */}
          <div className="flex flex-col items-center justify-center">
            <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block print:shadow-none print:border-black">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Shop QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                />
              ) : (
                <div className="w-56 h-56 bg-slate-100 animate-pulse" />
              )}
            </div>
            <p className="text-xs font-mono font-bold text-slate-600 mt-2 print:text-black">
              {url}
            </p>
          </div>

          {/* 3 Step Instructions */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-dashed border-slate-200 print:border-black">
            <div className="p-2 space-y-0.5">
              <span className="inline-flex w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs items-center justify-center print:bg-black">
                1
              </span>
              <p className="text-xs font-bold text-slate-800 print:text-black">Scan QR</p>
              <p className="text-[10px] text-slate-500 print:text-slate-700">Open phone camera</p>
            </div>
            <div className="p-2 space-y-0.5">
              <span className="inline-flex w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs items-center justify-center print:bg-black">
                2
              </span>
              <p className="text-xs font-bold text-slate-800 print:text-black">Select Files</p>
              <p className="text-[10px] text-slate-500 print:text-slate-700">PDF, Word, Images, etc.</p>
            </div>
            <div className="p-2 space-y-0.5">
              <span className="inline-flex w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs items-center justify-center print:bg-black">
                3
              </span>
              <p className="text-xs font-bold text-slate-800 print:text-black">Upload</p>
              <p className="text-[10px] text-slate-500 print:text-slate-700">Staff receives them!</p>
            </div>
          </div>

          {/* Bottom shop notice */}
          <div className="text-[11px] text-slate-500 print:text-slate-800 pt-2 font-medium">
            Fast • Secure • No Account Required
          </div>
        </div>
      </div>
    </div>
  );
};
