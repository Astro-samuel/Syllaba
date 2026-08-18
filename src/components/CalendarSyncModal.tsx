import React, { useState, useEffect } from 'react';
import { Assignment, Course } from '../types';
import { downloadICSFile } from '../utils/calendarExport';
import { getStoredGoogleUser, logoutGoogleUser, UserGoogleProfile } from '../utils/googleCalendarLive';
import { getGoogleAuthUrl, saveGoogleClientId } from '../utils/googleAuth';
import { getGoogleCalendarAuth, getStoredCourses } from '../utils/storage';
import {
  listGoogleCalendars,
  createSyllabaCalendar,
  selectGoogleCalendar,
  syncAssignments,
  disconnectGoogleCalendar,
  GoogleCalendarListEntry,
  SyncResult
} from '../utils/googleCalendarApi';
import {
  X,
  Download,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Plus,
  AlertTriangle
} from 'lucide-react';

interface CalendarSyncModalProps {
  assignments: Assignment[];
  onClose: () => void;
  oauthError?: string | null;
  connectTick?: number;
  onAssignmentsChanged: (assignments: Assignment[]) => void;
  onCoursesChanged: (courses: Course[]) => void;
}

type ConnectionState = 'signed-out' | 'picking-calendar' | 'connected';

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({
  assignments,
  onClose,
  oauthError,
  connectTick,
  onAssignmentsChanged,
  onCoursesChanged
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [googleUser, setGoogleUser] = useState<UserGoogleProfile | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('signed-out');
  const [calendarSummary, setCalendarSummary] = useState<string | null>(null);

  const [calendars, setCalendars] = useState<GoogleCalendarListEntry[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarListError, setCalendarListError] = useState<string | null>(null);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setGoogleUser(getStoredGoogleUser());
    const auth = getGoogleCalendarAuth();
    if (!auth) {
      setConnectionState('signed-out');
      setCalendarSummary(null);
    } else if (!auth.calendarId) {
      setConnectionState('picking-calendar');
      setCalendarSummary(null);
    } else {
      setConnectionState('connected');
      setCalendarSummary(auth.calendarSummary ?? auth.calendarId);
    }
  }, [connectTick]);

  useEffect(() => {
    if (connectionState !== 'picking-calendar') return;
    loadCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  // Shared "session needs reconnecting" reset: used whenever a Google API call
  // reports the token was revoked/invalidated (403 -> "...reconnected" message).
  const resetToSignedOut = () => {
    disconnectGoogleCalendar();
    logoutGoogleUser();
    setGoogleUser(null);
    setConnectionState('signed-out');
    setCalendarSummary(null);
  };

  const loadCalendars = async () => {
    setIsLoadingCalendars(true);
    setCalendarListError(null);
    try {
      const list = await listGoogleCalendars();
      setCalendars(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load calendars.';
      if (message.includes('reconnected')) {
        resetToSignedOut();
        setSyncError(message);
      } else {
        setCalendarListError(message);
      }
    } finally {
      setIsLoadingCalendars(false);
    }
  };

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

  const handlePickCalendar = (id: string, summary: string) => {
    selectGoogleCalendar(id, summary);
    setCalendarSummary(summary);
    setConnectionState('connected');
    setSyncResult(null);
    setSyncError(null);
  };

  const handleCreateCalendar = async () => {
    setIsCreatingCalendar(true);
    setCalendarListError(null);
    try {
      const created = await createSyllabaCalendar();
      selectGoogleCalendar(created.id, created.summary);
      setCalendarSummary(created.summary);
      setConnectionState('connected');
      setSyncResult(null);
      setSyncError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create calendar.';
      if (message.includes('reconnected')) {
        resetToSignedOut();
        setSyncError(message);
      } else {
        setCalendarListError(message);
      }
    } finally {
      setIsCreatingCalendar(false);
    }
  };

  const handleChangeCalendar = () => {
    setConnectionState('picking-calendar');
    setSyncResult(null);
    setSyncError(null);
  };

  const handleDisconnect = () => {
    resetToSignedOut();
    setSyncResult(null);
    setSyncError(null);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const { result, assignments: updatedAssignments } = await syncAssignments(assignments);
      onAssignmentsChanged(updatedAssignments);
      onCoursesChanged(getStoredCourses());
      setSyncResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.';
      if (message.includes('reconnected')) {
        resetToSignedOut();
        setSyncError(message);
      } else {
        setSyncError(message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadICS = () => {
    downloadICSFile(assignments, 'Syllaba_Master_Schedule.ics');
  };

  const handleCopyFeedLink = () => {
    navigator.clipboard.writeText('webcal://syllaba.app/feed/user-demo-calendar.ics');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatDirection = (label: string, dir: SyncResult['pushed']) => {
    const parts = [`${dir.created} created`, `${dir.updated} updated`, `${dir.deleted} removed`];
    if (dir.failed > 0) parts.push(`${dir.failed} failed`);
    return `${label} — ${parts.join(', ')}.`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-3xl bg-white border border-slate-200/80 p-8 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-caplen-navy text-white">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-extrabold text-caplen-navy">Google Calendar Sync</h2>
              <p className="text-xs text-caplen-muted font-medium">
                Sign in with your Google email to sync {assignments.length} assignments directly to your Google Calendar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Google Account Section */}
        <div className="space-y-4">

          {/* Google Account Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-extrabold text-caplen-navy flex items-center gap-2 font-heading">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google Account Sync</span>
              </h4>
              {connectionState !== 'signed-out' && (
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Signed In
                </span>
              )}
            </div>

            {connectionState === 'signed-out' && (
              <div className="space-y-3">
                <p className="text-xs text-caplen-muted font-medium">
                  Sign in with Google to link your real Google Calendar:
                </p>
                {oauthError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                    {oauthError}
                  </div>
                )}
                {syncError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{syncError}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full rounded-xl bg-caplen-navy px-4 py-2.5 text-xs font-extrabold text-white hover:bg-caplen-navyHover transition-all font-heading"
                >
                  Sign In with Google
                </button>
              </div>
            )}

            {connectionState === 'picking-calendar' && (
              <div className="space-y-3">
                {googleUser && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-xs font-extrabold text-caplen-navy capitalize">{googleUser.name}</p>
                    <p className="text-[11px] font-medium text-slate-500">{googleUser.email}</p>
                  </div>
                )}
                <p className="text-xs text-caplen-muted font-medium">
                  Choose which Google Calendar to sync assignments with:
                </p>

                {calendarListError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between gap-2">
                    <span>{calendarListError}</span>
                    <button
                      onClick={loadCalendars}
                      className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-rose-700 border border-rose-300 hover:bg-rose-100 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isLoadingCalendars ? (
                  <div className="flex items-center gap-2 text-xs text-caplen-muted font-medium py-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading your calendars…</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {calendars.map((cal) => (
                      <button
                        key={cal.id}
                        onClick={() => handlePickCalendar(cal.id, cal.summary)}
                        className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-caplen-navy text-left transition-colors"
                      >
                        <span className="text-xs font-bold text-caplen-navy">{cal.summary}</span>
                        {cal.primary && (
                          <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleCreateCalendar}
                  disabled={isCreatingCalendar}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-caplen-navy px-4 py-2.5 text-xs font-extrabold text-white hover:bg-caplen-navyHover transition-all disabled:opacity-50 font-heading"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isCreatingCalendar ? 'Creating…' : "Create new 'Syllaba' calendar"}</span>
                </button>
              </div>
            )}

            {connectionState === 'connected' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    {googleUser && <p className="text-xs font-extrabold text-caplen-navy capitalize">{googleUser.name}</p>}
                    <p className="text-[11px] font-medium text-slate-500">Syncing with: {calendarSummary}</p>
                  </div>
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all disabled:opacity-50 font-heading"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-vibrant-limeAccent ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  <button
                    onClick={handleChangeCalendar}
                    className="text-caplen-navy hover:underline"
                  >
                    Change calendar
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-rose-600 hover:underline"
                  >
                    Disconnect
                  </button>
                </div>

                {syncResult && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {formatDirection('Pushed', syncResult.pushed)} {formatDirection('Pulled', syncResult.pulled)}
                    </span>
                  </div>
                )}

                {syncError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{syncError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Download .ICS */}
          <div className="p-4 rounded-2xl bg-vibrant-lime/30 border border-vibrant-limeBorder">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 font-heading">
                  <Download className="h-4 w-4 text-caplen-navy" />
                  <span>Download .ics Calendar File</span>
                </h4>
                <p className="text-xs text-caplen-navy/80 mt-1 font-medium">
                  Export master schedule for Apple iCal, Outlook, and offline calendars.
                </p>
              </div>
              <button
                onClick={handleDownloadICS}
                className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all shrink-0 font-heading tracking-wide"
              >
                <span>Download .ics</span>
              </button>
            </div>
          </div>

          {/* Subscription Feed Link */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 mb-1 font-heading">
              <ExternalLink className="h-4 w-4 text-caplen-navy" />
              <span>Live Calendar Subscription Feed</span>
            </h4>
            <p className="text-xs text-caplen-muted mb-3 font-medium">
              Copy feed URL into phone/laptop calendar settings for live updates.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value="webcal://syllaba.app/feed/user-demo-calendar.ics"
                className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none"
              />
              <button
                onClick={handleCopyFeedLink}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-caplen-navy border border-slate-200 hover:bg-slate-50 transition-all shrink-0 shadow-xs font-heading"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1 text-[11px] font-bold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>100% Free & Private — Direct Google Sync</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200 transition-colors font-heading"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
