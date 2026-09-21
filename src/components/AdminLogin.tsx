import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: (token: string) => void;
  onCancel?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid admin password');
        setLoading(false);
        return;
      }

      localStorage.setItem('oyangoren_admin_token', data.token);
      onSuccess(data.token);
    } catch {
      setError('Connection interrupted. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-md shadow-amber-500/10">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Admin Authentication
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Oyangoren Printing Services staff portal
          </p>
        </div>

        {error && (
          <div
            id="login-error-banner"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-password-input"
              className="text-xs font-bold text-slate-700 block"
            >
              Administrator Password
            </label>
            <div className="relative">
              <input
                type="password"
                id="admin-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoFocus
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[11px] text-slate-400 pt-0.5">
              Default password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">admin</code> (changeable in settings)
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading || !password}
              id="btn-admin-login-submit"
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                id="btn-admin-login-cancel"
                className="w-full py-2.5 px-4 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Back to Customer Upload
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
