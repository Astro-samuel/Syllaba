import React, { useState, useEffect } from 'react';
import { Search, Bell, LogOut, CheckCircle2 } from 'lucide-react';
import { getStoredGoogleUser, logoutGoogleUser, UserGoogleProfile } from '../utils/googleCalendarLive';
import { getGoogleAuthUrl, saveGoogleClientId } from '../utils/googleAuth';
import { disconnectGoogleCalendar } from '../utils/googleCalendarApi';
import { getGoogleCalendarAuth } from '../utils/storage';

interface HeaderBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refreshSignal?: number;
}

export const Navbar: React.FC<HeaderBarProps> = ({
  searchQuery,
  setSearchQuery,
  refreshSignal
}) => {
  const [googleUser, setGoogleUser] = useState<UserGoogleProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const isReallyConnected = getGoogleCalendarAuth() !== null;
    setGoogleUser(isReallyConnected ? getStoredGoogleUser() : null);
  }, [refreshSignal]);

  const handleGoogleSignIn = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    try {
      window.location.href = getGoogleAuthUrl(redirectUri);
    } catch (err) {
      // No Google Client ID configured (no VITE_GOOGLE_CLIENT_ID) — ask for one.
      const clientId = window.prompt(
        `${err instanceof Error ? err.message : 'Missing Google OAuth Client ID.'}\n\nEnter your Google OAuth Client ID:`
      );
      if (!clientId) return;
      saveGoogleClientId(clientId);
      window.location.href = getGoogleAuthUrl(redirectUri);
    }
  };

  const handleLogout = () => {
    disconnectGoogleCalendar();
    logoutGoogleUser();
    setGoogleUser(null);
    setShowDropdown(false);
  };

  return (
    <header className="h-20 px-8 flex items-center justify-between gap-6 relative">
      {/* Top Search Input Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-4 top-3.5 h-4 w-4 text-caplen-navy" />
        <input
          type="text"
          placeholder="Search for a course, assignment, exam..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl bg-white border border-slate-300 pl-11 pr-4 py-2.5 text-xs font-bold text-caplen-navy placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-caplen-navy/20 shadow-sm transition-all"
        />
      </div>

      {/* Right User Controls & Google Sign-In */}
      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          title="Notifications"
          className="relative h-10 w-10 rounded-2xl bg-white hover:bg-slate-100 flex items-center justify-center text-caplen-navy border border-slate-300 shadow-xs transition-all"
        >
          <Bell className="h-4.5 w-4.5 text-caplen-navy" />
        </button>

        {googleUser ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 bg-white border border-slate-300 hover:border-caplen-navy px-3 py-1.5 rounded-2xl shadow-xs transition-all"
            >
              <div className="h-7 w-7 rounded-xl bg-caplen-navy text-white flex items-center justify-center font-heading font-extrabold text-xs">
                {googleUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-xs font-extrabold text-caplen-navy capitalize leading-none">
                  {googleUser.name}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Google Synced
                </span>
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50">
                <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                  <p className="text-xs font-extrabold text-caplen-navy capitalize">{googleUser.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{googleUser.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 text-xs font-bold text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out Google Account</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            className="flex items-center gap-2 rounded-2xl bg-white border border-slate-300 hover:border-caplen-navy px-4 py-2 text-xs font-extrabold text-caplen-navy shadow-xs transition-all font-heading"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        )}
      </div>
    </header>
  );
};
