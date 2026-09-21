import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Download, ArrowLeft, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

interface PrintSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

/**
 * Safe roundRect drawer compatible with all browser versions
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

/**
 * Shared High-Resolution Canvas Renderer for Printable Shop Counter Sign (300 DPI A4: 2480x3508).
 */
export async function renderCounterSignToCanvas(targetUrl: string): Promise<HTMLCanvasElement> {
  console.log('Counter sign render started');

  let width = 2480;
  let height = 3508;
  let canvas: HTMLCanvasElement;

  try {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
  } catch (err) {
    console.warn('High-res canvas allocation failed, falling back to 1240x1754:', err);
    width = 1240;
    height = 1754;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  }

  console.log(`Canvas: ${width} × ${height}`);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const s = width / 2480;

  // 1. Fill background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Outer border frame
  ctx.lineWidth = 24 * s;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(80 * s, 80 * s, width - 160 * s, height - 160 * s);

  // 3. Generate QR code locally as data URL
  const qrData = await QRCode.toDataURL(targetUrl, {
    width: Math.round(1200 * s),
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  console.log('QR generated');

  // Load QR into Image and wait for onload
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('Failed to load generated QR code image onto canvas'));
    qrImg.src = qrData;
  });

  // 4. Header Badge: "SELF-SERVICE FILE UPLOAD"
  ctx.fillStyle = '#0f172a';
  const badgeWidth = 960 * s;
  const badgeHeight = 110 * s;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = 180 * s;
  ctx.beginPath();
  drawRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = `bold ${Math.round(38 * s)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SELF-SERVICE FILE UPLOAD', width / 2, badgeY + badgeHeight / 2);

  // 5. Main Title & Subtitle
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${Math.round(80 * s)}px Arial, sans-serif`;
  ctx.fillText('OYANGOREN PRINTING SERVICES', width / 2, 380 * s);

  ctx.fillStyle = '#0369a1';
  ctx.font = `bold ${Math.round(46 * s)}px Arial, sans-serif`;
  ctx.fillText('SEND YOUR FILES', width / 2, 475 * s);

  // 6. QR Code Centerpiece Box
  const qrBoxSize = 1100 * s;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 570 * s;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 16 * s;
  ctx.beginPath();
  drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 40 * s);
  ctx.fill();
  ctx.stroke();

  // Draw QR Image inside box
  const qrPadding = 60 * s;
  ctx.drawImage(
    qrImg,
    qrBoxX + qrPadding,
    qrBoxY + qrPadding,
    qrBoxSize - qrPadding * 2,
    qrBoxSize - qrPadding * 2
  );
  console.log('QR drawn');

  // SCAN TO UPLOAD label & URL
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${Math.round(52 * s)}px Arial, sans-serif`;
  ctx.fillText('SCAN TO UPLOAD', width / 2, 1780 * s);

  ctx.fillStyle = '#0369a1';
  ctx.font = `bold ${Math.round(32 * s)}px monospace`;
  ctx.fillText(targetUrl, width / 2, 1850 * s);

  // 7. 3-Step Instructions Box
  const stepsY = 1950 * s;
  const stepsWidth = width - 360 * s;
  const stepsX = (width - stepsWidth) / 2;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6 * s;
  ctx.setLineDash([16 * s, 16 * s]);
  ctx.beginPath();
  ctx.moveTo(stepsX, stepsY);
  ctx.lineTo(stepsX + stepsWidth, stepsY);
  ctx.stroke();
  ctx.setLineDash([]); // reset line dash

  const stepColWidth = stepsWidth / 3;
  const stepItems = [
    { num: '1', title: 'Scan', desc: 'Scan QR code using phone camera' },
    { num: '2', title: 'Select', desc: 'Choose documents or images to print' },
    { num: '3', title: 'Upload', desc: 'Tap Upload & send directly to queue' },
  ];

  stepItems.forEach((item, idx) => {
    const colCenterX = stepsX + stepColWidth * idx + stepColWidth / 2;
    const itemY = stepsY + 60 * s;

    // Circle number
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    const circleRadius = 38 * s;
    ctx.arc(colCenterX, itemY + circleRadius, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(36 * s)}px Arial, sans-serif`;
    ctx.fillText(item.num, colCenterX, itemY + circleRadius);

    // Step Title
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(38 * s)}px Arial, sans-serif`;
    ctx.fillText(item.title, colCenterX, itemY + circleRadius * 2 + 35 * s);

    // Step Desc
    ctx.fillStyle = '#475569';
    ctx.font = `${Math.round(26 * s)}px Arial, sans-serif`;
    ctx.fillText(item.desc, colCenterX, itemY + circleRadius * 2 + 80 * s);
  });

  // 8. Bottom Footer Notice
  const footerY = 3280 * s;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(180 * s, footerY);
  ctx.lineTo(width - 180 * s, footerY);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = `bold ${Math.round(28 * s)}px Arial, sans-serif`;
  ctx.fillText('No app needed • Works on mobile data & Wi-Fi', width / 2, footerY + 80 * s);

  console.log('Counter sign render completed');
  return canvas;
}

export const PrintSignModal: React.FC<PrintSignModalProps> = ({
  isOpen,
  onClose,
  url,
}) => {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [downloadingPng, setDownloadingPng] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveUrl = url || (typeof window !== 'undefined' ? `${window.location.origin}/upload` : '');

  const generatePreview = useCallback(async () => {
    if (!effectiveUrl) return;
    setIsRendering(true);
    setErrorMessage(null);

    try {
      const canvas = await renderCounterSignToCanvas(effectiveUrl);
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error('Canvas produced an empty image string.');
      }
      setPreviewDataUrl(dataUrl);
    } catch (err: any) {
      console.error('Counter sign preview generation failed:', err);
      setErrorMessage(err?.message || 'Preview could not be generated.');
    } finally {
      setIsRendering(false);
    }
  }, [effectiveUrl]);

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    } else {
      setPreviewDataUrl(null);
      setErrorMessage(null);
      setIsRendering(false);
    }
  }, [isOpen, generatePreview]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    setDownloadingPng(true);
    try {
      const canvas = await renderCounterSignToCanvas(effectiveUrl);
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          console.error('Counter sign PNG generation failed: Blob is empty', {
            width: canvas.width,
            height: canvas.height,
          });
          setErrorMessage('Download failed: Couldn\'t generate PNG file. Please try again.');
          setDownloadingPng(false);
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'Oyangoren-Printing-Counter-Sign.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        setDownloadingPng(false);
      }, 'image/png');
    } catch (err: any) {
      console.error('Counter sign PNG generation failed:', err);
      setErrorMessage('Download failed: Couldn\'t generate PNG file.');
      setDownloadingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const canvas = await renderCounterSignToCanvas(effectiveUrl);
      const imgData = canvas.toDataURL('image/png', 0.95);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Oyangoren-Printing-Counter-Sign.pdf');
      setDownloadingPdf(false);
    } catch (err: any) {
      console.error('Counter sign PDF generation failed:', err);
      setErrorMessage('Download failed: Couldn\'t generate PDF file.');
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-800 space-y-5 my-auto print:bg-white print:p-0 print:shadow-none print:border-none print:w-full print:m-0 print:max-w-none">
        {/* Top Controls (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 print:hidden">
          <button
            type="button"
            onClick={onClose}
            id="btn-back-print-sign"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-sky-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isRendering || downloadingPng || downloadingPdf}
              id="btn-download-sign-png"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>{downloadingPng ? 'Generating PNG...' : 'Download PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isRendering || downloadingPng || downloadingPdf}
              id="btn-download-sign-pdf"
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isRendering}
              id="btn-trigger-print"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Preview Container - Wrapped in explicit Light Surface */}
        <div className="w-full bg-slate-950/50 p-3 sm:p-6 rounded-2xl border border-slate-800/80 flex items-center justify-center print:bg-white print:p-0 print:border-none">
          {isRendering ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-300">
              <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-200">Generating preview...</p>
            </div>
          ) : errorMessage && !previewDataUrl ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center p-6 bg-slate-900 rounded-2xl border border-rose-900/50">
              <AlertCircle className="w-12 h-12 text-rose-500" />
              <p className="text-base font-bold text-white">Preview could not be generated.</p>
              <p className="text-xs text-slate-400 max-w-md">{errorMessage}</p>
              <button
                type="button"
                onClick={generatePreview}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : previewDataUrl ? (
            <div
              id="printable-counter-sign"
              className="w-full max-w-[800px] bg-white rounded-2xl shadow-2xl p-2 sm:p-4 border border-slate-200 print:max-w-none print:p-0 print:border-none print:shadow-none"
            >
              <img
                src={previewDataUrl}
                alt="Oyangoren Printing Services Counter Sign"
                className="w-full h-auto aspect-[210/297] object-contain rounded-xl print:rounded-none print:w-full print:h-full"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
