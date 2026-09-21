import React from 'react';
import { CheckSquare, Square, Printer, FileCheck, Trash2, X, RefreshCw } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onDeselectAll: () => void;
  onMarkProcessing: () => void;
  onMarkCompleted: () => void;
  onDeleteSelected: () => void;
  loading?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  onToggleSelectAll,
  onDeselectAll,
  onMarkProcessing,
  onMarkCompleted,
  onDeleteSelected,
  loading = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      id="bulk-actions-toolbar"
      className="sticky bottom-4 z-40 w-full max-w-4xl mx-auto px-4 animate-slideUp"
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 sm:px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Count & Select All */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSelectAll}
            id="btn-bulk-toggle-all"
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-sky-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedCount} of {totalCount} selected
            </span>
          </button>

          <button
            type="button"
            onClick={onDeselectAll}
            title="Deselect all"
            className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={onMarkProcessing}
            disabled={loading}
            id="btn-bulk-mark-processing"
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Mark Printing</span>
          </button>

          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={loading}
            id="btn-bulk-mark-completed"
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Mark Ready</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={loading}
            id="btn-bulk-delete"
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
