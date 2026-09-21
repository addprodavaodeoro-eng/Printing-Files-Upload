import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { QuickUpload } from './components/QuickUpload';
import { RemoteUpload } from './components/RemoteUpload';
import { OrderStatusTracker } from './components/OrderStatusTracker';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { useI18n } from './i18n';
import { Printer, Shield, CheckCircle, FileText } from 'lucide-react';

type ViewMode = 'quick-upload' | 'remote-upload' | 'status' | 'admin';

export default function App() {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<ViewMode>('quick-upload');
  const [remoteToken, setRemoteToken] = useState<string>('');
  const [trackedCode, setTrackedCode] = useState<string>('');
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('oyangoren_admin_token');
  });

  // URL Routing Sync
  const parseUrl = () => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (path.startsWith('/request/')) {
      const token = path.replace('/request/', '').trim();
      if (token) {
        setRemoteToken(token);
        setCurrentView('remote-upload');
        return;
      }
    }

    if (path.startsWith('/status')) {
      const codeFromUrl = path.replace('/status/', '').replace('/status', '').trim() || searchParams.get('ref') || '';
      if (codeFromUrl) {
        setTrackedCode(codeFromUrl);
      }
      setCurrentView('status');
      return;
    }

    if (path.startsWith('/admin')) {
      setCurrentView('admin');
      return;
    }

    // Default to Quick Upload for "/" or "/upload"
    setCurrentView('quick-upload');
  };

  useEffect(() => {
    parseUrl();

    const handlePopState = () => {
      parseUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: 'quick-upload' | 'status' | 'admin') => {
    setCurrentView(view);
    let targetPath = '/upload';
    if (view === 'status') {
      targetPath = trackedCode ? `/status/${trackedCode}` : '/status';
    } else if (view === 'admin') {
      targetPath = '/admin';
    }
    window.history.pushState({}, '', targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTrackOrder = (refCode: string) => {
    setTrackedCode(refCode);
    setCurrentView('status');
    window.history.pushState({}, '', `/status/${refCode}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('oyangoren_admin_token');
    setAdminToken(null);
    navigateTo('quick-upload');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigate={navigateTo}
        isAdminLoggedIn={!!adminToken}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start">
        {currentView === 'quick-upload' && (
          <QuickUpload onTrackOrder={handleTrackOrder} />
        )}

        {currentView === 'remote-upload' && (
          <RemoteUpload
            token={remoteToken}
            onTrackOrder={handleTrackOrder}
            onBackToHome={() => navigateTo('quick-upload')}
          />
        )}

        {currentView === 'status' && (
          <OrderStatusTracker
            initialCode={trackedCode}
            onBackToUpload={() => navigateTo('quick-upload')}
          />
        )}

        {currentView === 'admin' && (
          adminToken ? (
            <AdminDashboard
              token={adminToken}
              onLogout={handleAdminLogout}
            />
          ) : (
            <AdminLogin
              onSuccess={(token) => setAdminToken(token)}
              onCancel={() => navigateTo('quick-upload')}
            />
          )
        )}
      </main>

      {/* Professional Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-8 px-4 sm:px-6 mt-12 print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Mission */}
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-white text-sm">
                Oyangoren Printing Services
              </span>
            </div>
            <p className="text-slate-400 max-w-sm">
              Reliable, high-speed document printing, copying, and scanning services. Send your files directly via QR or unique link.
            </p>
          </div>

          {/* Quick links & Privacy Assurance */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center md:text-right">
            <div className="space-y-1 text-slate-400">
              <p className="font-semibold text-slate-300">File Security Guarantee</p>
              <p className="text-[11px] text-slate-400">
                Uploaded files are stored privately on secure disk and automatically purged according to retention policy.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo('quick-upload')}
                className="hover:text-white transition-colors"
              >
                Send Files
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => navigateTo('status')}
                className="hover:text-white transition-colors"
              >
                Track Status
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} Oyangoren Printing Services. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
