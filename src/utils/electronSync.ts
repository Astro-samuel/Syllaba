import { Course, Assignment } from '../types';

// Present only inside the Electron desktop app (injected by
// electron/preload.cjs) — undefined on the hosted web build, where this
// sync is a no-op.
declare global {
  interface Window {
    electronAPI?: {
      syncSyllabaData: (payload: { courses: Course[]; assignments: Assignment[] }) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

/**
 * Mirrors courses/assignments to ~/.syllaba/data.json (desktop app only) so
 * the MCP server — a separate process, not part of this app — can read the
 * student's current schedule. Best-effort: a failure here doesn't affect
 * the app, which keeps localStorage as its real source of truth.
 */
export function syncToDiskForMcp(courses: Course[], assignments: Assignment[]): void {
  if (typeof window === 'undefined' || !window.electronAPI) return;
  window.electronAPI.syncSyllabaData({ courses, assignments }).catch((err) => {
    console.error('Failed to sync Syllaba data to disk for MCP', err);
  });
}
