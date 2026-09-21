import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Printer,
  FileCheck,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  XCircle,
  PackageCheck,
  Eye,
  History,
} from 'lucide-react';
import { useI18n } from '../i18n';

interface OrderStatusTrackerProps {
  initialCode?: string;
  onBackToUpload?: () => void;
}

interface PublicTimelineItem {
  id: string;
  action: string;
  timestamp: string;
}

interface PublicOrderStatusData {
  referenceCode: string;
  status: string;
  statusLabel: string;
  statusDescription: string;
  statusStep: number;
  type: 'quick' | 'remote';
  fileCount: number;
  createdAt: string;
  lastUpdated: string;
  timeline?: PublicTimelineItem[];
}

const STEPS = [
  { step: 1, key: 'received', label: 'Received', icon: Clock },
  { step: 2, key: 'reviewing', label: 'Under Review', icon: Eye },
  { step: 3, key: 'ready_to_print', label: 'Ready to Print', icon: FileCheck },
  { step: 4, key: 'printing', label: 'Printing', icon: Printer },
  { step: 5, key: 'ready_for_pickup', label: 'Ready for Pickup', icon: PackageCheck },
  { step: 6, key: 'completed', label: 'Completed', icon: CheckCircle2 },
];

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  initialCode = '',
  onBackToUpload,
}) => {
  const { t } = useI18n();
  const [refCode, setRefCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<PublicOrderStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (codeToSearch: string) => {
    const clean = codeToSearch.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/status/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('No print request found for this reference code. Please verify the code on your slip or screen.');
        } else {
          setError('Unable to fetch status right now. Please try again.');
        }
        setOrderData(null);
        setLoading(false);
        return;
      }

      const data: PublicOrderStatusData = await res.json();
      setOrderData(data);
      setLoading(false);
    } catch {
      setError('Connection interrupted. Please check network and try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchStatus(initialCode);
    }
  }, [initialCode]);

  // Auto-refresh order status every 10 seconds if active
  useEffect(() => {
    if (!orderData?.referenceCode || orderData.status === 'completed' || orderData.status === 'cancelled') {
      return;
    }

    const interval = setInterval(() => {
      fetch(`/api/status/${encodeURIComponent(orderData.referenceCode)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setOrderData(data);
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [orderData?.referenceCode, orderData?.status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(refCode);
  };

  const isCancelled = orderData?.status === 'cancelled';
  const currentStep = orderData?.statusStep || 1;

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-4 space-y-6">
      {/* Back button */}
      {onBackToUpload && (
        <button
          type="button"
          onClick={onBackToUpload}
          id="btn-back-from-tracker"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-sky-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToHome}</span>
        </button>
      )}

      {/* Search Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 mx-auto flex items-center justify-center font-bold mb-2">
            <Printer className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Track Print Request Status
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Enter your reference code (e.g., OY-1001) to view real-time progress from Oyangoren Printing Services.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="e.g. OY-4821"
              id="input-tracker-code"
              className="w-full rounded-2xl border border-slate-300 pl-4 pr-10 py-3 text-sm font-mono font-bold uppercase tracking-wider text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs"
            />
            {loading && (
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin absolute right-3.5 top-3.5" />
            )}
          </div>
          <button
            type="submit"
            id="btn-search-status"
            disabled={!refCode.trim() || loading}
            className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </form>

        {error && (
          <div
            id="tracker-error-banner"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2.5 max-w-md mx-auto animate-fadeIn font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* TRACKING DETAILS CARD */}
      {orderData && (
        <div
          id="order-details-card"
          className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-md space-y-6 animate-fadeIn"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Oyangoren Reference
              </span>
              <h3 className="text-3xl font-black text-slate-900 font-mono tracking-wide text-sky-700">
                {orderData.referenceCode}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {orderData.fileCount} file(s) attached • {orderData.type === 'quick' ? 'Walk-in Quick Upload' : 'Remote Print Request'}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <span className="text-[11px] text-slate-400 block">Submitted:</span>
              <span className="text-xs font-semibold text-slate-700 block">
                {new Date(orderData.createdAt).toLocaleDateString()} at {new Date(orderData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Updated: {new Date(orderData.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* PROGRESS BAR / STEPPER */}
          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Order Cancelled</p>
                <p className="text-xs text-rose-700">
                  This print request has been cancelled. Please visit the shop counter for assistance.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Printing Progress
                </span>
                <span className="text-xs font-bold text-sky-700">
                  Step {currentStep} of 6
                </span>
              </div>

              {/* Progress Stepper Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {STEPS.map((s) => {
                  const Icon = s.icon;
                  const isCurrent = currentStep === s.step;
                  const isPast = currentStep > s.step;

                  return (
                    <div
                      key={s.step}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        isCurrent
                          ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 shadow-xs'
                          : isPast
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center mb-1 text-xs font-bold ${
                          isCurrent
                            ? 'bg-sky-600 text-white animate-pulse'
                            : isPast
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <p className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-sky-900' : isPast ? 'text-emerald-900' : 'text-slate-600'}`}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Prominent Current Status Banner */}
              <div
                className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
                  currentStep === 6
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : currentStep === 5
                    ? 'bg-teal-50 border-teal-200 text-teal-950'
                    : currentStep === 4
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-sky-50 border-sky-200 text-sky-950'
                }`}
              >
                {currentStep === 6 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : currentStep === 5 ? (
                  <PackageCheck className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5 animate-bounce" />
                ) : currentStep === 4 ? (
                  <Printer className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <Clock className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-black text-sm">{orderData.statusLabel}</p>
                  <p className="text-xs mt-0.5 text-slate-700">
                    {orderData.statusDescription}
                  </p>
                  {currentStep === 5 && (
                    <p className="text-xs font-bold text-teal-800 mt-1">
                      👉 Ready for Pickup: Show reference code <span className="font-mono">{orderData.referenceCode}</span> at the counter.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Activity Timeline (Public Safe) */}
          {orderData.timeline && orderData.timeline.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <History className="w-3.5 h-3.5" />
                <span>Status History</span>
              </div>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/50 p-2 text-xs">
                {orderData.timeline.map((item) => (
                  <div key={item.id} className="py-2 px-3 flex items-center justify-between">
                    <span className="font-medium text-slate-700">{item.action}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Note */}
          <p className="text-[11px] text-center text-slate-400 italic">
            For privacy and security, file contents and personal contact information are not accessible on this public tracking page.
          </p>
        </div>
      )}
    </div>
  );
};
