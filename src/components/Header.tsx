import React from 'react';
import { Printer, Globe, Shield, Clock, UploadCloud, Sun, Moon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  currentView: 'quick-upload' | 'remote-upload' | 'status' | 'admin';
  onNavigate: (view: 'quick-upload' | 'status' | 'admin') => void;
  isAdminLoggedIn: boolean;
  onAdminLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  isAdminLoggedIn,
  onAdminLogout,
}) => {
  const { lang, toggleLanguage, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <button
          onClick={() => onNavigate('quick-upload')}
          className="flex items-center gap-3 text-left group focus:outline-none"
          id="btn-brand-home"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Printer className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white group-hover:text-sky-300 transition-colors">
                Oyangoren
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Print
              </span>
            </div>
            <p className="text-xs text-slate-400 font-normal hidden sm:block">
              {t.brandTagline}
            </p>
          </div>
        </button>

        {/* Navigation Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Upload Nav */}
          <button
            onClick={() => onNavigate('quick-upload')}
            id="nav-quick-upload"
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              currentView === 'quick-upload'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden xs:inline">{t.sendFiles}</span>
          </button>

          {/* Track Order Nav */}
          <button
            onClick={() => onNavigate('status')}
            id="nav-track-status"
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              currentView === 'status'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">{t.trackStatus}</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            id="btn-theme-toggle"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/80 transition-colors flex items-center justify-center cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-400" />
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            id="btn-lang-toggle"
            title="Switch Language (English / Tagalog)"
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>{lang === 'en' ? 'EN' : 'FIL'}</span>
          </button>

          {/* Admin Navigation */}
          {isAdminLoggedIn ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onNavigate('admin')}
                id="btn-admin-dash"
                className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                  currentView === 'admin'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              {onAdminLogout && (
                <button
                  onClick={onAdminLogout}
                  id="btn-admin-logout"
                  title="Log out from admin"
                  className="px-2 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Logout
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate('admin')}
              id="btn-admin-login-nav"
              title="Admin Portal"
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
