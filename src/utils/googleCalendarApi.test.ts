import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncAssignments,
  disconnectGoogleCalendar,
  listGoogleCalendars,
  createSyllabaCalendar,
  selectGoogleCalendar
} from './googleCalendarApi';
import { saveGoogleCalendarAuth, getGoogleCalendarAuth, GOOGLE_IMPORT_COURSE_ID } from './storage';
import { buildSignature } from './googleCalendarSync';
import { Assignment } from '../types';

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a_1',
    courseId: 'c_1',
    courseName: 'CS 101',
    title: 'Homework 1',
    dueDate: '2026-09-01',
    dueTime: '23:59',
    type: 'homework',
    weightPercent: 10,
    completed: false,
    color: '#8b5cf6',
    ...overrides
  };
}

function emptyEventsList() {
  return { ok: true, json: async () => ({ items: [] }) };
}

describe('syncAssignments', () => {
  beforeEach(() => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal123',
      calendarSummary: 'School',
      events: {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when not connected', async () => {
    localStorage.clear();
    await expect(syncAssignments([makeAssignment()])).rejects.toThrow('not connected');
  });

  it('throws when no calendar is picked', async () => {
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: null,
      events: {}
    });
    await expect(syncAssignments([makeAssignment()])).rejects.toThrow('Pick a Google Calendar');
  });

  it('pushes a new assignment and records it (pull finds nothing)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEvent1', updated: '2026-08-01T00:00:00.000Z' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, assignments } = await syncAssignments([makeAssignment()]);

    expect(result.pushed).toEqual({ created: 1, updated: 0, deleted: 0, failed: 0 });
    expect(result.pulled).toEqual({ created: 0, updated: 0, deleted: 0, failed: 0 });
    expect(assignments).toEqual([makeAssignment()]);

    const stored = getGoogleCalendarAuth();
    expect(stored!.events.a_1.googleEventId).toBe('gEvent1');
    expect(stored!.events.a_1.signature).toBe(buildSignature(makeAssignment()));
  });

  it('pulls a new remote event into a new assignment under the import course', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'gEventNew',
                updated: '2026-08-10T00:00:00.000Z',
                summary: 'Guest Lecture',
                start: { dateTime: '2026-09-10T09:00:00-04:00' }
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEventOut', updated: '2026-08-01T00:00:00.000Z' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, assignments } = await syncAssignments([]);

    expect(result.pulled.created).toBe(1);
    const imported = assignments.find((a) => a.title === 'Guest Lecture');
    expect(imported).toBeDefined();
    expect(imported!.courseId).toBe('c_google_import');
    expect(imported!.dueDate).toBe('2026-09-10');
    expect(imported!.dueTime).toBe('09:00');
    expect(imported!.weightPercent).toBeNull();

    const stored = getGoogleCalendarAuth();
    expect(stored!.events[imported!.id].googleEventId).toBe('gEventNew');
  });

  it('does nothing on push when signature is unchanged and pull finds no changes', async () => {
    const assignment = makeAssignment();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal123',
      events: { a_1: { googleEventId: 'gEvent1', signature: buildSignature(assignment) } }
    });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      throw new Error('should not push when unchanged');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await syncAssignments([assignment]);

    expect(result.pushed).toEqual({ created: 0, updated: 0, deleted: 0, failed: 0 });
    expect(result.pulled).toEqual({ created: 0, updated: 0, deleted: 0, failed: 0 });
  });

  it('clears auth and throws a reconnect error on 403', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'insufficient scope' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncAssignments([])).rejects.toThrow('reconnected');
    expect(getGoogleCalendarAuth()).toBeNull();
  });

  it('continues past a single failed push event and counts it as failed', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      return Promise.resolve({ ok: false, json: async () => ({ error: { message: 'nope' } }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await syncAssignments([makeAssignment()]);

    expect(result.pushed).toEqual({ created: 0, updated: 0, deleted: 0, failed: 1 });
  });

  it('clears auth and throws a reconnect error on 403 during push', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      return Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'insufficient scope' } })
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncAssignments([makeAssignment()])).rejects.toThrow('reconnected');
    expect(getGoogleCalendarAuth()).toBeNull();
  });

  it('does not false-delete previously imported assignments when the pull fails with a non-403 error', async () => {
    const assignment = makeAssignment({ id: 'a_gcal_gEvent1', dueDate: '2026-09-05' });
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal123',
      calendarSummary: 'School',
      events: {
        a_gcal_gEvent1: {
          googleEventId: 'gEvent1',
          signature: buildSignature(assignment),
          remoteUpdated: '2026-08-01T00:00:00.000Z'
        }
      }
    });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/events?')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'server error' } })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEvent1', updated: '2026-08-01T00:00:00.000Z' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await syncAssignments([assignment]);

    expect(result.pulled.failed).toBe(1);
    const stored = getGoogleCalendarAuth();
    expect(stored!.events.a_gcal_gEvent1).toBeDefined();
  });

  it('pushes an imported assignment without the [courseName] prefix', async () => {
    const assignment = makeAssignment({
      id: 'a_gcal_gEvent1',
      courseId: GOOGLE_IMPORT_COURSE_ID,
      courseName: 'Imported from Google Calendar',
      title: 'Guest Lecture'
    });
    let createdBody: any = null;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      createdBody = JSON.parse(init.body);
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEvent1', updated: '2026-08-01T00:00:00.000Z' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await syncAssignments([assignment]);

    expect(createdBody.summary).toBe('Guest Lecture');
  });

  it('pushes an assignment with no dueTime as an all-day event', async () => {
    const assignment = makeAssignment({ dueTime: null });
    let createdBody: any = null;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/events?')) return Promise.resolve(emptyEventsList());
      createdBody = JSON.parse(init.body);
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEvent1', updated: '2026-08-01T00:00:00.000Z' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await syncAssignments([assignment]);

    expect(createdBody.start).toEqual({ date: assignment.dueDate, dateTime: null, timeZone: null });
    expect(createdBody.end).toEqual({ date: '2026-09-02', dateTime: null, timeZone: null });
  });
});

describe('disconnectGoogleCalendar', () => {
  it('clears stored auth', () => {
    saveGoogleCalendarAuth({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1,
      calendarId: null,
      events: {}
    });
    disconnectGoogleCalendar();
    expect(getGoogleCalendarAuth()).toBeNull();
  });
});

describe('listGoogleCalendars', () => {
  beforeEach(() => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: null,
      events: {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns id/summary/primary for each calendar', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: 'cal1', summary: 'Personal', primary: true },
          { id: 'cal2', summary: 'School' }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const calendars = await listGoogleCalendars();

    expect(calendars).toEqual([
      { id: 'cal1', summary: 'Personal', primary: true },
      { id: 'cal2', summary: 'School', primary: false }
    ]);
  });

  it('returns an empty array when the account has no calendars', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const calendars = await listGoogleCalendars();

    expect(calendars).toEqual([]);
  });

  it('clears auth and rejects with a reconnect message on 403', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'insufficient scope' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listGoogleCalendars()).rejects.toThrow('reconnected');
    expect(getGoogleCalendarAuth()).toBeNull();
  });
});

describe('createSyllabaCalendar', () => {
  beforeEach(() => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: null,
      events: {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a calendar named Syllaba and returns its id/summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'newCal1', summary: 'Syllaba' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createSyllabaCalendar();

    expect(result).toEqual({ id: 'newCal1', summary: 'Syllaba' });
  });

  it('clears auth and rejects with a reconnect message on 403', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'insufficient scope' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createSyllabaCalendar()).rejects.toThrow('reconnected');
    expect(getGoogleCalendarAuth()).toBeNull();
  });
});

describe('selectGoogleCalendar', () => {
  it('saves the picked calendar id and summary', () => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: null,
      events: {}
    });

    selectGoogleCalendar('cal2', 'School');

    const stored = getGoogleCalendarAuth();
    expect(stored!.calendarId).toBe('cal2');
    expect(stored!.calendarSummary).toBe('School');
  });

  it('throws when not connected', () => {
    localStorage.clear();
    expect(() => selectGoogleCalendar('cal2', 'School')).toThrow('not connected');
  });

  it('clears the events map when switching to a different calendar', () => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal1',
      calendarSummary: 'Personal',
      events: { a_1: { googleEventId: 'gEvent1', signature: 'sig' } }
    });

    selectGoogleCalendar('cal2', 'School');

    const stored = getGoogleCalendarAuth();
    expect(stored!.calendarId).toBe('cal2');
    expect(stored!.events).toEqual({});
  });

  it('preserves the events map when re-selecting the same calendar', () => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal1',
      calendarSummary: 'Personal',
      events: { a_1: { googleEventId: 'gEvent1', signature: 'sig' } }
    });

    selectGoogleCalendar('cal1', 'Personal');

    const stored = getGoogleCalendarAuth();
    expect(stored!.events).toEqual({ a_1: { googleEventId: 'gEvent1', signature: 'sig' } });
  });
});
