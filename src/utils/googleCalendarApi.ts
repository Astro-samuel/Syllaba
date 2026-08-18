import { Assignment } from '../types';
import {
  getGoogleCalendarAuth,
  saveGoogleCalendarAuth,
  clearGoogleCalendarAuth,
  getOrCreateGoogleImportCourse,
  GOOGLE_IMPORT_COURSE_ID
} from './storage';
import { computeSyncPlan, buildSignature, computeImportPlan, eventToAssignmentFields, RemoteCalendarEvent } from './googleCalendarSync';
import { refreshAccessToken } from './googleAuth';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleAuthExpiredError extends Error {}

async function assertCalendarResponseOk(res: Response, data: any, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 403) {
    throw new GoogleAuthExpiredError(data.error?.message || 'Google Calendar access needs to be reconnected');
  }
  throw new Error(data.error?.message || fallbackMessage);
}

export interface SyncDirectionResult {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
}

export interface SyncResult {
  pushed: SyncDirectionResult;
  pulled: SyncDirectionResult;
}

function emptyDirectionResult(): SyncDirectionResult {
  return { created: 0, updated: 0, deleted: 0, failed: 0 };
}

function addOneDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toEventBody(assignment: Assignment) {
  const importCoursePrefix = assignment.courseId === GOOGLE_IMPORT_COURSE_ID ? '' : `[${assignment.courseName}] `;
  const description = `${assignment.type.toUpperCase()}${
    assignment.weightPercent != null ? ` — Weight: ${assignment.weightPercent}%` : ''
  }`;

  if (!assignment.dueTime) {
    return {
      summary: `${importCoursePrefix}${assignment.title}`,
      description,
      start: { date: assignment.dueDate, dateTime: null, timeZone: null },
      end: { date: addOneDay(assignment.dueDate), dateTime: null, timeZone: null },
      extendedProperties: { private: { syllabaId: assignment.id } }
    };
  }

  const dateTime = `${assignment.dueDate}T${assignment.dueTime}:00`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: `${importCoursePrefix}${assignment.title}`,
    description,
    start: { dateTime, timeZone, date: null },
    end: { dateTime, timeZone, date: null },
    extendedProperties: { private: { syllabaId: assignment.id } }
  };
}

async function getValidAccessToken(): Promise<{ accessToken: string; calendarId: string | null }> {
  const auth = getGoogleCalendarAuth();
  if (!auth) {
    throw new Error('Google Calendar is not connected');
  }

  if (Date.now() < auth.expiresAt - 60_000) {
    return { accessToken: auth.accessToken, calendarId: auth.calendarId };
  }

  const refreshed = await refreshAccessToken(auth.refreshToken);
  const updated = { ...auth, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt };
  saveGoogleCalendarAuth(updated);
  return { accessToken: updated.accessToken, calendarId: updated.calendarId };
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarListEntry[]> {
  const { accessToken } = await getValidAccessToken();
  const results: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  try {
    do {
      const params = new URLSearchParams();
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      await assertCalendarResponseOk(res, data, 'Failed to list calendars');
      for (const item of data.items || []) {
        results.push({ id: item.id, summary: item.summary, primary: item.primary ?? false });
      }
      pageToken = data.nextPageToken;
      pages += 1;
    } while (pageToken && pages < 2);
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleCalendarAuth();
      throw new Error('Google Calendar access needs to be reconnected');
    }
    throw err;
  }

  return results;
}

export async function createSyllabaCalendar(): Promise<{ id: string; summary: string }> {
  const { accessToken } = await getValidAccessToken();
  try {
    const res = await fetch(`${CALENDAR_BASE}/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Syllaba' })
    });
    const data = await res.json();
    await assertCalendarResponseOk(res, data, 'Failed to create Syllaba calendar');
    return { id: data.id, summary: data.summary };
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleCalendarAuth();
      throw new Error('Google Calendar access needs to be reconnected');
    }
    throw err;
  }
}

export function selectGoogleCalendar(calendarId: string, calendarSummary: string): void {
  const auth = getGoogleCalendarAuth();
  if (!auth) {
    throw new Error('Google Calendar is not connected');
  }
  const events = auth.calendarId === calendarId ? auth.events : {};
  saveGoogleCalendarAuth({ ...auth, calendarId, calendarSummary, events });
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMinIso: string
): Promise<RemoteCalendarEvent[]> {
  const params = new URLSearchParams({ timeMin: timeMinIso, singleEvents: 'true', maxResults: '250' });
  const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403) {
      throw new GoogleAuthExpiredError(data.error?.message || 'Google Calendar access needs to be reconnected');
    }
    throw new Error(data.error?.message || 'Failed to fetch calendar events');
  }
  return (data.items || []).map((item: any) => ({
    id: item.id,
    updated: item.updated,
    summary: item.summary || '(untitled event)',
    start: item.start || {}
  }));
}

export async function syncAssignments(
  assignments: Assignment[]
): Promise<{ result: SyncResult; assignments: Assignment[] }> {
  const { accessToken, calendarId } = await getValidAccessToken();
  if (!calendarId) {
    throw new Error('Pick a Google Calendar before syncing');
  }

  const authBefore = getGoogleCalendarAuth();
  if (!authBefore) {
    throw new Error('Google Calendar is not connected');
  }

  const events = { ...authBefore.events };
  const pulled = emptyDirectionResult();
  const pushed = emptyDirectionResult();
  let workingAssignments = [...assignments];

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // --- Pull ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const windowStartDate = sixMonthsAgo.toISOString().slice(0, 10);

  let remoteEvents: RemoteCalendarEvent[] = [];
  let pullSucceeded = false;
  try {
    remoteEvents = await fetchCalendarEvents(accessToken, calendarId, sixMonthsAgo.toISOString());
    pullSucceeded = true;
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleCalendarAuth();
      throw new Error('Google Calendar access needs to be reconnected');
    }
    pulled.failed += 1;
  }

  if (pullSucceeded) {
    const assignmentsById = Object.fromEntries(workingAssignments.map((a) => [a.id, a]));
    const importCourse = getOrCreateGoogleImportCourse();
    const importPlan = computeImportPlan(remoteEvents, events, assignmentsById, windowStartDate);

    for (const event of importPlan.toCreate) {
      const fields = eventToAssignmentFields(event);
      const newAssignment: Assignment = {
        id: `a_gcal_${event.id}`,
        courseId: importCourse.id,
        courseName: importCourse.name,
        title: fields.title,
        dueDate: fields.dueDate,
        dueTime: fields.dueTime,
        type: 'other',
        weightPercent: null,
        score: null,
        completed: false,
        color: importCourse.color
      };
      workingAssignments.push(newAssignment);
      events[newAssignment.id] = {
        googleEventId: event.id,
        signature: buildSignature(newAssignment),
        remoteUpdated: event.updated
      };
      pulled.created += 1;
    }

    for (const { event, assignmentId } of importPlan.toUpdate) {
      const fields = eventToAssignmentFields(event);
      workingAssignments = workingAssignments.map((a) =>
        a.id === assignmentId ? { ...a, title: fields.title, dueDate: fields.dueDate, dueTime: fields.dueTime } : a
      );
      const updatedAssignment = workingAssignments.find((a) => a.id === assignmentId)!;
      events[assignmentId] = {
        googleEventId: event.id,
        signature: buildSignature(updatedAssignment),
        remoteUpdated: event.updated
      };
      pulled.updated += 1;
    }

    for (const assignmentId of importPlan.toDeleteAssignmentIds) {
      workingAssignments = workingAssignments.filter((a) => a.id !== assignmentId);
      delete events[assignmentId];
      pulled.deleted += 1;
    }
  }

  // --- Push ---
  const pushPlan = computeSyncPlan(workingAssignments, events);

  try {
    for (const assignment of pushPlan.toCreate) {
      try {
        const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events`, {
          method: 'POST',
          headers,
          body: JSON.stringify(toEventBody(assignment))
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403) {
            throw new GoogleAuthExpiredError(data.error?.message || 'Google Calendar access needs to be reconnected');
          }
          throw new Error(data.error?.message || 'Create failed');
        }
        events[assignment.id] = {
          googleEventId: data.id,
          signature: buildSignature(assignment),
          remoteUpdated: data.updated ?? null
        };
        pushed.created += 1;
      } catch (err) {
        if (err instanceof GoogleAuthExpiredError) throw err;
        pushed.failed += 1;
      }
    }

    for (const { assignment, googleEventId } of pushPlan.toUpdate) {
      try {
        const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events/${googleEventId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(toEventBody(assignment))
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403) {
            throw new GoogleAuthExpiredError(data.error?.message || 'Google Calendar access needs to be reconnected');
          }
          throw new Error(data.error?.message || 'Update failed');
        }
        events[assignment.id] = {
          googleEventId,
          signature: buildSignature(assignment),
          remoteUpdated: data.updated ?? events[assignment.id]?.remoteUpdated ?? null
        };
        pushed.updated += 1;
      } catch (err) {
        if (err instanceof GoogleAuthExpiredError) throw err;
        pushed.failed += 1;
      }
    }

    for (const googleEventId of pushPlan.toDelete) {
      try {
        const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events/${googleEventId}`, {
          method: 'DELETE',
          headers
        });
        if (!res.ok && res.status !== 404) {
          const data = await res.json();
          if (res.status === 403) {
            throw new GoogleAuthExpiredError(data.error?.message || 'Google Calendar access needs to be reconnected');
          }
          throw new Error(data.error?.message || 'Delete failed');
        }
        const assignmentId = Object.keys(events).find((id) => events[id].googleEventId === googleEventId);
        if (assignmentId) delete events[assignmentId];
        pushed.deleted += 1;
      } catch (err) {
        if (err instanceof GoogleAuthExpiredError) throw err;
        pushed.failed += 1;
      }
    }
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleCalendarAuth();
      throw new Error('Google Calendar access needs to be reconnected');
    }
    throw err;
  }

  saveGoogleCalendarAuth({ ...authBefore, events });

  return { result: { pushed, pulled }, assignments: workingAssignments };
}

export function disconnectGoogleCalendar(): void {
  clearGoogleCalendarAuth();
}
