# Google Calendar Two-Way Sync + Calendar Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick any of their real Google calendars (not just an app-created "Syllaba" one) and sync two-way: assignments push out as events, and events in the picked calendar pull in as assignments.

**Architecture:** Extends the existing one-way push integration (`src/utils/googleAuth.ts`, `src/utils/googleCalendarSync.ts`, `src/utils/googleCalendarApi.ts`, `src/components/CalendarSyncModal.tsx`) rather than replacing it. OAuth scope broadens to full calendar access. A new calendar-list/create/select layer lets the user pick a target calendar. `syncAssignments` gains a pull phase (fetch remote events, diff against last-known state, create/update/delete local assignments) that runs before the existing push phase, so same-tick conflicts resolve as "local wins" with no conflict UI. One unified `events` map (already existing) tracks both directions via `googleEventId`.

**Tech Stack:** Same as the existing integration — React + TypeScript + Vite, Vitest + jsdom, native `fetch` against Google's Calendar API v3, Netlify Function for the OAuth token exchange (unchanged by this plan).

## Global Constraints

- OAuth scope becomes `https://www.googleapis.com/auth/calendar` (full read/write) — the app can now read/write whichever calendar the user picks, not just app-created ones. This is an approved, deliberate reversal of the prior narrower-scope constraint.
- Sync stays manual-only (the "Sync now" button) — no background polling, no auto-trigger.
- Pull-then-push ordering inside one sync call: same-tick conflicts resolve as "local wins," no conflict-resolution UI.
- One calendar synced at a time — no multi-calendar sync in this pass.
- Imported events become real Syllaba assignments (editable, completable), assigned to an auto-created pseudo-course `"Imported from Google Calendar"` (id `c_google_import`), ungraded by default (`weightPercent: null`, `score: null`).
- A `403` from any Calendar API call clears stored auth and surfaces "Google Calendar access needs to be reconnected" — never a silent failure.
- Pull only fetches events from the last 6 months forward (`timeMin`) — do not treat an event absent from that window as deleted; only delete a locally-imported assignment when its own `dueDate` falls inside the fetched window and it's confirmed missing from the fetch.

---

### Task 1: Data model + pseudo-course for imports

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/storage.ts`
- Test: `src/utils/storage.googleImportCourse.test.ts`

**Interfaces:**
- Produces (used by Task 4, Task 5):
  ```ts
  // src/types/index.ts additions
  export interface SyncedEventRecord {
    googleEventId: string;
    signature: string;
    remoteUpdated?: string | null; // last-seen Google 'updated' RFC3339 timestamp; undefined/null = never pulled
  }
  export interface GoogleCalendarAuth {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    calendarId: string | null;
    calendarSummary?: string | null; // display name of the picked calendar
    events: Record<string, SyncedEventRecord>;
  }
  // src/utils/storage.ts addition
  function getOrCreateGoogleImportCourse(): Course;
  ```
  Both new fields are optional so every existing `GoogleCalendarAuth`/`SyncedEventRecord` object literal already in the codebase (tests, `googleCalendarApi.ts`) keeps compiling unchanged — this task touches no existing test files.

- [ ] **Step 1: Add the two optional fields to `src/types/index.ts`**

Find the existing `SyncedEventRecord` and `GoogleCalendarAuth` interfaces (near the end of the file) and replace them with:

```ts
export interface SyncedEventRecord {
  googleEventId: string;
  signature: string;
  remoteUpdated?: string | null; // last-seen Google 'updated' RFC3339 timestamp; undefined/null = never pulled
}

export interface GoogleCalendarAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  calendarId: string | null;
  calendarSummary?: string | null; // display name of the picked calendar
  events: Record<string, SyncedEventRecord>; // assignmentId -> record
}
```

- [ ] **Step 2: Write the failing test for the pseudo-course**

```ts
// src/utils/storage.googleImportCourse.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateGoogleImportCourse, getStoredCourses } from './storage';

describe('getOrCreateGoogleImportCourse', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates the pseudo-course on first call', () => {
    const course = getOrCreateGoogleImportCourse();
    expect(course.id).toBe('c_google_import');
    expect(course.name).toBe('Imported from Google Calendar');
    expect(course.code).toBe('GCAL');
  });

  it('persists the course so it appears in getStoredCourses', () => {
    getOrCreateGoogleImportCourse();
    const courses = getStoredCourses();
    expect(courses.some((c) => c.id === 'c_google_import')).toBe(true);
  });

  it('does not duplicate the course on a second call', () => {
    const first = getOrCreateGoogleImportCourse();
    const second = getOrCreateGoogleImportCourse();
    expect(second).toEqual(first);
    const courses = getStoredCourses();
    expect(courses.filter((c) => c.id === 'c_google_import')).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/utils/storage.googleImportCourse.test.ts`
Expected: FAIL — `getOrCreateGoogleImportCourse is not a function`.

- [ ] **Step 4: Implement `getOrCreateGoogleImportCourse` in `src/utils/storage.ts`**

Add near the other constants at the top of the file (after `GOOGLE_CALENDAR_KEY`):

```ts
const GOOGLE_IMPORT_COURSE_ID = 'c_google_import';
```

Append this function at the end of the file:

```ts

export function getOrCreateGoogleImportCourse(): Course {
  const courses = getStoredCourses();
  const existing = courses.find((c) => c.id === GOOGLE_IMPORT_COURSE_ID);
  if (existing) return existing;

  const importCourse: Course = {
    id: GOOGLE_IMPORT_COURSE_ID,
    name: 'Imported from Google Calendar',
    code: 'GCAL',
    color: '#4285F4',
    createdAt: new Date().toISOString()
  };
  saveCourses([...courses, importCourse]);
  return importCourse;
}
```

Note `getStoredCourses()` (already in this file, unchanged) seeds a default CS 101 course when `localStorage` is empty — calling it here is safe and matches the existing pattern used throughout `storage.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/utils/storage.googleImportCourse.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 6: Run the full suite once**

Run: `npm test`
Expected: PASS — no regressions (the two new optional type fields don't break any existing object literal).

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/utils/storage.ts src/utils/storage.googleImportCourse.test.ts
git commit -m "feat: add optional pull-sync fields and Google-import pseudo-course"
```

---

### Task 2: Broaden OAuth scope

**Files:**
- Modify: `src/utils/googleAuth.ts`
- Modify: `src/utils/googleAuth.test.ts`

**Interfaces:**
- No signature changes — `getGoogleAuthUrl`, `getGoogleClientId`, `saveGoogleClientId`, `exchangeCodeForTokens`, `refreshAccessToken` are unchanged. Only the `SCOPE` constant's value changes.

- [ ] **Step 1: Change the scope constant**

In `src/utils/googleAuth.ts`, find:

```ts
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
```

Replace with:

```ts
const SCOPE = 'https://www.googleapis.com/auth/calendar';
```

- [ ] **Step 2: Update the existing test assertion**

In `src/utils/googleAuth.test.ts`, find the assertion (inside the `getGoogleAuthUrl` describe block):

```ts
expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.app.created');
```

Replace with:

```ts
expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar');
```

- [ ] **Step 3: Run the focused test**

Run: `npm test -- src/utils/googleAuth.test.ts`
Expected: PASS — all tests in this file passing with the new scope value.

- [ ] **Step 4: Run the full suite once**

Run: `npm test`
Expected: PASS — no regressions elsewhere (nothing else references the literal scope string).

- [ ] **Step 5: Commit**

```bash
git add src/utils/googleAuth.ts src/utils/googleAuth.test.ts
git commit -m "feat: broaden Google OAuth scope to full calendar read/write"
```

---

### Task 3: Calendar list / create / select

**Files:**
- Modify: `src/utils/googleCalendarApi.ts`
- Modify: `src/utils/googleCalendarApi.test.ts`

**Interfaces:**
- Consumes: `getValidAccessToken` (already in this file, unchanged), `getGoogleCalendarAuth`/`saveGoogleCalendarAuth` from `src/utils/storage.ts`.
- Produces (used by Task 6):
  ```ts
  export interface GoogleCalendarListEntry {
    id: string;
    summary: string;
    primary?: boolean;
  }
  export async function listGoogleCalendars(): Promise<GoogleCalendarListEntry[]>;
  export async function createSyllabaCalendar(): Promise<{ id: string; summary: string }>;
  export function selectGoogleCalendar(calendarId: string, calendarSummary: string): void;
  ```
  These are purely additive — the existing `ensureSyllabaCalendar` and `syncAssignments` in this file are NOT touched by this task (Task 5 rewrites `syncAssignments` and removes `ensureSyllabaCalendar`; keeping this task additive-only means `npm run build`/`npm test` stay green after this task on their own).

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/googleCalendarApi.test.ts` (after the existing `describe('disconnectGoogleCalendar', ...)` block, same file — do not create a new file):

```ts

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
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  });

  it('returns an empty array when the account has no calendars', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const calendars = await listGoogleCalendars();

    expect(calendars).toEqual([]);
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
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars');
    expect(JSON.parse(init.body)).toEqual({ summary: 'Syllaba' });
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: FAIL — `listGoogleCalendars is not a function` (and similarly for `createSyllabaCalendar`/`selectGoogleCalendar`).

- [ ] **Step 3: Implement the three functions in `src/utils/googleCalendarApi.ts`**

Add this block right after the existing `ensureSyllabaCalendar` function (leave `ensureSyllabaCalendar` itself untouched — `syncAssignments` still calls it until Task 5):

```ts

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

  do {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to list calendars');
    }
    for (const item of data.items || []) {
      results.push({ id: item.id, summary: item.summary, primary: item.primary ?? false });
    }
    pageToken = data.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 2);

  return results;
}

export async function createSyllabaCalendar(): Promise<{ id: string; summary: string }> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(`${CALENDAR_BASE}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Syllaba' })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create Syllaba calendar');
  }
  return { id: data.id, summary: data.summary };
}

export function selectGoogleCalendar(calendarId: string, calendarSummary: string): void {
  const auth = getGoogleCalendarAuth();
  if (!auth) {
    throw new Error('Google Calendar is not connected');
  }
  saveGoogleCalendarAuth({ ...auth, calendarId, calendarSummary });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: PASS — all tests in this file passing, including the pre-existing ones (this task is purely additive).

- [ ] **Step 5: Run the full suite once**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/googleCalendarApi.ts src/utils/googleCalendarApi.test.ts
git commit -m "feat: add Google calendar list/create/select functions"
```

---

### Task 4: Pure pull-diff logic

**Files:**
- Modify: `src/utils/googleCalendarSync.ts`
- Modify: `src/utils/googleCalendarSync.test.ts`

**Interfaces:**
- Consumes: `Assignment`, `SyncedEventRecord` (from `src/types/index.ts`, unchanged imports).
- Produces (used by Task 5):
  ```ts
  export interface RemoteCalendarEvent {
    id: string;
    updated: string; // RFC3339
    summary: string;
    start: { date?: string; dateTime?: string };
  }
  export interface ImportPlan {
    toCreate: RemoteCalendarEvent[];
    toUpdate: { event: RemoteCalendarEvent; assignmentId: string }[];
    toDeleteAssignmentIds: string[];
  }
  export function computeImportPlan(
    remoteEvents: RemoteCalendarEvent[],
    events: Record<string, SyncedEventRecord>,
    assignmentsById: Record<string, Assignment>,
    windowStartDate: string // 'YYYY-MM-DD'
  ): ImportPlan;
  export function eventToAssignmentFields(event: RemoteCalendarEvent): {
    title: string;
    dueDate: string;
    dueTime: string | null;
  };
  ```
  This file's existing `buildSignature`/`computeSyncPlan`/`SyncPlan` are untouched by this task.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/googleCalendarSync.test.ts` (after the existing `describe('computeSyncPlan', ...)` block):

```ts

import { computeImportPlan, eventToAssignmentFields, RemoteCalendarEvent } from './googleCalendarSync';

function makeEvent(overrides: Partial<RemoteCalendarEvent> = {}): RemoteCalendarEvent {
  return {
    id: 'gEvent1',
    updated: '2026-08-01T10:00:00.000Z',
    summary: 'Midterm Review Session',
    start: { dateTime: '2026-09-05T14:00:00-04:00' },
    ...overrides
  };
}

describe('eventToAssignmentFields', () => {
  it('splits a timed event into dueDate/dueTime', () => {
    const fields = eventToAssignmentFields(makeEvent());
    expect(fields).toEqual({ title: 'Midterm Review Session', dueDate: '2026-09-05', dueTime: '14:00' });
  });

  it('handles an all-day event with dueTime null', () => {
    const fields = eventToAssignmentFields(makeEvent({ start: { date: '2026-09-06' } }));
    expect(fields).toEqual({ title: 'Midterm Review Session', dueDate: '2026-09-06', dueTime: null });
  });
});

describe('computeImportPlan', () => {
  it('plans a create for a remote event with no matching record', () => {
    const plan = computeImportPlan([makeEvent()], {}, {}, '2026-01-01');
    expect(plan.toCreate).toEqual([makeEvent()]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans nothing when the event is not newer than the last-seen remoteUpdated', () => {
    const events = { a_1: { googleEventId: 'gEvent1', signature: 'x', remoteUpdated: '2026-08-01T10:00:00.000Z' } };
    const plan = computeImportPlan([makeEvent()], events, { a_1: {} as any }, '2026-01-01');
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans an update when the event is newer than the last-seen remoteUpdated', () => {
    const events = { a_1: { googleEventId: 'gEvent1', signature: 'x', remoteUpdated: '2026-07-01T00:00:00.000Z' } };
    const event = makeEvent({ updated: '2026-08-15T00:00:00.000Z' });
    const plan = computeImportPlan([event], events, { a_1: {} as any }, '2026-01-01');
    expect(plan.toUpdate).toEqual([{ event, assignmentId: 'a_1' }]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans a delete when a previously-pulled event is missing and its assignment is within the fetch window', () => {
    const events = { a_1: { googleEventId: 'gEventGone', signature: 'x', remoteUpdated: '2026-07-01T00:00:00.000Z' } };
    const assignmentsById = { a_1: { dueDate: '2026-08-01' } as any };
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toEqual(['a_1']);
  });

  it('does NOT plan a delete when the assignment predates the fetch window (avoids false deletes)', () => {
    const events = { a_1: { googleEventId: 'gEventGone', signature: 'x', remoteUpdated: '2025-01-01T00:00:00.000Z' } };
    const assignmentsById = { a_1: { dueDate: '2025-06-01' } as any }; // before windowStartDate
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('does NOT plan a delete for a native (never-pulled) assignment missing from the fetch', () => {
    const events = { a_1: { googleEventId: 'gEventPushed', signature: 'x' } }; // no remoteUpdated: pushed, not pulled
    const assignmentsById = { a_1: { dueDate: '2026-08-01' } as any };
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/googleCalendarSync.test.ts`
Expected: FAIL — `computeImportPlan is not a function`.

- [ ] **Step 3: Implement in `src/utils/googleCalendarSync.ts`**

Append at the end of the file:

```ts

export interface RemoteCalendarEvent {
  id: string;
  updated: string; // RFC3339
  summary: string;
  start: { date?: string; dateTime?: string };
}

export function eventToAssignmentFields(event: RemoteCalendarEvent): {
  title: string;
  dueDate: string;
  dueTime: string | null;
} {
  if (event.start.dateTime) {
    const [datePart, timePart] = event.start.dateTime.split('T');
    return { title: event.summary, dueDate: datePart, dueTime: timePart.slice(0, 5) };
  }
  return { title: event.summary, dueDate: event.start.date || '', dueTime: null };
}

export interface ImportPlan {
  toCreate: RemoteCalendarEvent[];
  toUpdate: { event: RemoteCalendarEvent; assignmentId: string }[];
  toDeleteAssignmentIds: string[];
}

export function computeImportPlan(
  remoteEvents: RemoteCalendarEvent[],
  events: Record<string, SyncedEventRecord>,
  assignmentsById: Record<string, Assignment>,
  windowStartDate: string
): ImportPlan {
  const toCreate: RemoteCalendarEvent[] = [];
  const toUpdate: { event: RemoteCalendarEvent; assignmentId: string }[] = [];
  const seenGoogleEventIds = new Set<string>();

  const byGoogleEventId = new Map<string, string>();
  for (const [assignmentId, record] of Object.entries(events)) {
    byGoogleEventId.set(record.googleEventId, assignmentId);
  }

  for (const event of remoteEvents) {
    seenGoogleEventIds.add(event.id);
    const assignmentId = byGoogleEventId.get(event.id);

    if (!assignmentId) {
      toCreate.push(event);
      continue;
    }

    const record = events[assignmentId];
    const lastSeen = record.remoteUpdated ?? null;
    if (!lastSeen || event.updated > lastSeen) {
      toUpdate.push({ event, assignmentId });
    }
  }

  const toDeleteAssignmentIds: string[] = Object.entries(events)
    .filter(([assignmentId, record]) => {
      if (record.remoteUpdated == null) return false; // never pulled (native/pushed-only): don't delete-by-absence
      if (seenGoogleEventIds.has(record.googleEventId)) return false;
      const assignment = assignmentsById[assignmentId];
      if (!assignment) return false;
      return assignment.dueDate >= windowStartDate; // only trust absence within the fetched window
    })
    .map(([assignmentId]) => assignmentId);

  return { toCreate, toUpdate, toDeleteAssignmentIds };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/googleCalendarSync.test.ts`
Expected: PASS — all tests (existing + new) passing.

- [ ] **Step 5: Run the full suite once**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/googleCalendarSync.ts src/utils/googleCalendarSync.test.ts
git commit -m "feat: add pure pull-diff logic for Google Calendar import"
```

---

### Task 5: Rewrite `syncAssignments` for two-way sync

**Files:**
- Modify: `src/utils/googleCalendarApi.ts`
- Modify: `src/utils/googleCalendarApi.test.ts`

**Interfaces:**
- Consumes: `computeSyncPlan`, `buildSignature` (existing), `computeImportPlan`, `eventToAssignmentFields`, `RemoteCalendarEvent` (Task 4); `getOrCreateGoogleImportCourse` (Task 1); `getGoogleCalendarAuth`/`saveGoogleCalendarAuth`/`clearGoogleCalendarAuth` (existing).
- Produces (used by Task 6):
  ```ts
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
  export class GoogleAuthExpiredError extends Error {}
  export async function syncAssignments(
    assignments: Assignment[]
  ): Promise<{ result: SyncResult; assignments: Assignment[] }>;
  ```
  This REPLACES the current `SyncResult` (flat `{created,updated,deleted,failed}`) and the current `syncAssignments` return type (`Promise<SyncResult>`) — Task 6 depends on the new nested shape and the new `{ result, assignments }` wrapper. `ensureSyllabaCalendar` is removed (dead code — Task 3's `createSyllabaCalendar` replaces its only real use, and `syncAssignments` no longer auto-creates a calendar; it requires one already picked).

- [ ] **Step 1: Rewrite `src/utils/googleCalendarApi.test.ts`**

Replace the full file contents:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncAssignments,
  disconnectGoogleCalendar,
  listGoogleCalendars,
  createSyllabaCalendar,
  selectGoogleCalendar,
  GoogleAuthExpiredError
} from './googleCalendarApi';
import { saveGoogleCalendarAuth, getGoogleCalendarAuth } from './storage';
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: FAIL — `syncAssignments` still returns the old flat shape / calls `ensureSyllabaCalendar` implicitly, so the new "throws when no calendar is picked" and pull-related assertions fail; `GoogleAuthExpiredError` doesn't exist yet.

- [ ] **Step 3: Rewrite `src/utils/googleCalendarApi.ts`**

Replace the full file contents:

```ts
import { Assignment } from '../types';
import { getGoogleCalendarAuth, saveGoogleCalendarAuth, clearGoogleCalendarAuth, getOrCreateGoogleImportCourse } from './storage';
import { computeSyncPlan, buildSignature, computeImportPlan, eventToAssignmentFields, RemoteCalendarEvent } from './googleCalendarSync';
import { refreshAccessToken } from './googleAuth';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleAuthExpiredError extends Error {}

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

function toEventBody(assignment: Assignment) {
  const dateTime = assignment.dueTime
    ? `${assignment.dueDate}T${assignment.dueTime}:00`
    : `${assignment.dueDate}T23:59:00`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: `[${assignment.courseName}] ${assignment.title}`,
    description: `${assignment.type.toUpperCase()}${
      assignment.weightPercent != null ? ` — Weight: ${assignment.weightPercent}%` : ''
    }`,
    start: { dateTime, timeZone },
    end: { dateTime, timeZone },
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

  do {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to list calendars');
    }
    for (const item of data.items || []) {
      results.push({ id: item.id, summary: item.summary, primary: item.primary ?? false });
    }
    pageToken = data.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 2);

  return results;
}

export async function createSyllabaCalendar(): Promise<{ id: string; summary: string }> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(`${CALENDAR_BASE}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Syllaba' })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create Syllaba calendar');
  }
  return { id: data.id, summary: data.summary };
}

export function selectGoogleCalendar(calendarId: string, calendarSummary: string): void {
  const auth = getGoogleCalendarAuth();
  if (!auth) {
    throw new Error('Google Calendar is not connected');
  }
  saveGoogleCalendarAuth({ ...auth, calendarId, calendarSummary });
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
  try {
    remoteEvents = await fetchCalendarEvents(accessToken, calendarId, sixMonthsAgo.toISOString());
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleCalendarAuth();
      throw new Error('Google Calendar access needs to be reconnected');
    }
    pulled.failed += 1;
  }

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

  // --- Push ---
  const pushPlan = computeSyncPlan(workingAssignments, events);

  for (const assignment of pushPlan.toCreate) {
    try {
      const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(toEventBody(assignment))
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Create failed');
      events[assignment.id] = {
        googleEventId: data.id,
        signature: buildSignature(assignment),
        remoteUpdated: data.updated ?? null
      };
      pushed.created += 1;
    } catch {
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
      if (!res.ok) throw new Error(data.error?.message || 'Update failed');
      events[assignment.id] = {
        googleEventId,
        signature: buildSignature(assignment),
        remoteUpdated: data.updated ?? events[assignment.id]?.remoteUpdated ?? null
      };
      pushed.updated += 1;
    } catch {
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
        throw new Error(data.error?.message || 'Delete failed');
      }
      const assignmentId = Object.keys(events).find((id) => events[id].googleEventId === googleEventId);
      if (assignmentId) delete events[assignmentId];
      pushed.deleted += 1;
    } catch {
      pushed.failed += 1;
    }
  }

  saveGoogleCalendarAuth({ ...authBefore, events });

  return { result: { pushed, pulled }, assignments: workingAssignments };
}

export function disconnectGoogleCalendar(): void {
  clearGoogleCalendarAuth();
}
```

Note `ensureSyllabaCalendar` is deliberately removed — it's dead code once `syncAssignments` requires a pre-picked `calendarId` and calendar creation is a separate explicit UI action (`createSyllabaCalendar`, Task 3).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: PASS — all tests passing (rewritten file from Step 1).

- [ ] **Step 5: Run the full suite once**

Run: `npm test`
Expected: PASS — no regressions in Tasks 1-4's tests.

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: succeeds — confirms no other file (e.g. `CalendarSyncModal.tsx`, not yet updated) references the removed `ensureSyllabaCalendar` or the old flat `SyncResult` shape in a way that breaks compilation before Task 6. If `tsc` fails here because `CalendarSyncModal.tsx` used the old `SyncResult` shape, that's expected and fine — Task 6 fixes it; note the failure in your report rather than trying to fix `CalendarSyncModal.tsx` yourself (out of this task's scope).

- [ ] **Step 7: Commit**

```bash
git add src/utils/googleCalendarApi.ts src/utils/googleCalendarApi.test.ts
git commit -m "feat: rewrite syncAssignments for two-way pull-then-push sync"
```

---

### Task 6: UI — calendar picker + two-way sync results

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CalendarSyncModal.tsx`

**Interfaces:**
- Consumes: `listGoogleCalendars`, `createSyllabaCalendar`, `selectGoogleCalendar`, `syncAssignments` (new signature), `GoogleAuthExpiredError` (Task 3/5); `getGoogleCalendarAuth` (existing).
- Produces: nothing consumed elsewhere — final integration point.

No unit test for this task, matching the precedent set by the original integration's UI task — OAuth/network-heavy UI code, verified by build + manual check. Preserve everything currently in `CalendarSyncModal.tsx` that this task doesn't need to touch: the manual Client ID entry flow (`customClientId`/`showClientIdInput`/`handleSaveCustomClientId`), the `.ics` download section, the subscription-feed section, and the email-digest section must all remain exactly as they are today — only the "Google Calendar Auto-Sync" section and the sync-result display change.

- [ ] **Step 1: Add `onAssignmentsChanged` prop wiring in `src/App.tsx`**

Find the `CalendarSyncModal` render block (near the end of the file, inside the `{isSyncModalOpen && (...)}` block) and add one new prop:

```tsx
      {isSyncModalOpen && (
        <CalendarSyncModal
          assignments={assignments}
          onClose={() => {
            setIsSyncModalOpen(false);
            setGoogleOAuthError(null);
          }}
          oauthError={googleOAuthError}
          connectTick={googleConnectTick}
          onAssignmentsChanged={updateAssignments}
        />
      )}
```

(`updateAssignments` already exists in `App.tsx` — it's the same function `handleToggleComplete`/`handleDeleteAssignment`/etc. already call to persist + set state. No other change needed in `App.tsx`.)

- [ ] **Step 2: Rewrite the Google Calendar section of `src/components/CalendarSyncModal.tsx`**

Read the current full file first — it has a manual Client ID entry flow, an `.ics` download section, a subscription-feed section, and an email-digest section that must all be preserved verbatim. Make these changes:

**Imports** — replace:
```ts
import { getGoogleAuthUrl, getGoogleClientId, saveGoogleClientId } from '../utils/googleAuth';
import { syncAssignments, disconnectGoogleCalendar, SyncResult } from '../utils/googleCalendarApi';
```
with:
```ts
import { getGoogleAuthUrl, getGoogleClientId, saveGoogleClientId } from '../utils/googleAuth';
import {
  syncAssignments,
  disconnectGoogleCalendar,
  listGoogleCalendars,
  createSyllabaCalendar,
  selectGoogleCalendar,
  GoogleAuthExpiredError,
  SyncResult,
  GoogleCalendarListEntry
} from '../utils/googleCalendarApi';
```

**Props interface** — add `onAssignmentsChanged`:
```ts
interface CalendarSyncModalProps {
  assignments: Assignment[];
  onClose: () => void;
  oauthError?: string | null;
  connectTick?: number;
  onAssignmentsChanged: (assignments: Assignment[]) => void;
}
```
and destructure it in the component's props: add `onAssignmentsChanged` alongside the existing `assignments, onClose, oauthError: propOauthError, connectTick`.

**New state**, added alongside the existing `isConnected`/`isSyncing`/`syncResult`/`syncError`/`customClientId`/`showClientIdInput` state:
```ts
const [calendarId, setCalendarId] = useState<string | null>(null);
const [calendarSummary, setCalendarSummary] = useState<string | null>(null);
const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendarListEntry[]>([]);
const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
const [calendarListError, setCalendarListError] = useState<string | null>(null);
```

**The connection-check effect** — replace the existing one:
```ts
useEffect(() => {
  setIsConnected(getGoogleCalendarAuth() !== null);
  const existing = getGoogleClientId();
  if (existing) {
    setCustomClientId(existing);
  }
}, [propOauthError, connectTick]);
```
with a version that also picks up the stored calendar selection and loads the picker when connected but no calendar is chosen yet:
```ts
useEffect(() => {
  const auth = getGoogleCalendarAuth();
  setIsConnected(auth !== null);
  setCalendarId(auth?.calendarId ?? null);
  setCalendarSummary(auth?.calendarSummary ?? null);
  const existing = getGoogleClientId();
  if (existing) {
    setCustomClientId(existing);
  }
  if (auth !== null && auth.calendarId === null) {
    loadCalendars();
  }
}, [propOauthError, connectTick]);
```

**New handlers**, added alongside the existing `handleConnectGoogle`/`handleSaveCustomClientId`/`handleSyncNow`/`handleDisconnect`:
```ts
const loadCalendars = async () => {
  setIsLoadingCalendars(true);
  setCalendarListError(null);
  try {
    const calendars = await listGoogleCalendars();
    setAvailableCalendars(calendars);
  } catch (err) {
    setCalendarListError(err instanceof Error ? err.message : 'Failed to load calendars');
  } finally {
    setIsLoadingCalendars(false);
  }
};

const handlePickCalendar = (id: string, summary: string) => {
  selectGoogleCalendar(id, summary);
  setCalendarId(id);
  setCalendarSummary(summary);
};

const handleCreateSyllabaCalendar = async () => {
  setIsLoadingCalendars(true);
  setCalendarListError(null);
  try {
    const created = await createSyllabaCalendar();
    handlePickCalendar(created.id, created.summary);
  } catch (err) {
    setCalendarListError(err instanceof Error ? err.message : 'Failed to create calendar');
  } finally {
    setIsLoadingCalendars(false);
  }
};

const handleChangeCalendar = () => {
  setCalendarId(null);
  setCalendarSummary(null);
  loadCalendars();
};
```

**`handleSyncNow`** — replace the existing implementation:
```ts
const handleSyncNow = async () => {
  setIsSyncing(true);
  setSyncError(null);
  setSyncResult(null);
  try {
    const { result, assignments: updated } = await syncAssignments(assignments);
    setSyncResult(result);
    onAssignmentsChanged(updated);
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError || (err instanceof Error && err.message.includes('reconnected'))) {
      setIsConnected(false);
      setCalendarId(null);
      setCalendarSummary(null);
    }
    setSyncError(err instanceof Error ? err.message : 'Sync failed');
  } finally {
    setIsSyncing(false);
  }
};
```

**`handleDisconnect`** — extend to also clear the new calendar state:
```ts
const handleDisconnect = () => {
  disconnectGoogleCalendar();
  setIsConnected(false);
  setCalendarId(null);
  setCalendarSummary(null);
  setAvailableCalendars([]);
  setSyncResult(null);
  setSyncError(null);
};
```

**The "Google Calendar Auto-Sync" section's JSX** — replace the whole `{/* Google Calendar Connect/Sync */}` block (from `<div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">` through its closing `</div>`, i.e. everything currently between the "Options" header and the "Download .ICS" section) with:

```tsx
          {/* Google Calendar Connect/Sync */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 mb-1 font-heading">
              <RefreshCw className="h-4 w-4 text-caplen-navy" />
              <span>Google Calendar Sync</span>
            </h4>
            <p className="text-xs text-caplen-muted mb-3 font-medium">
              {isConnected && calendarId
                ? `Two-way sync with "${calendarSummary}". Assignments push out, events pull in.`
                : isConnected
                ? 'Pick which Google calendar to sync with.'
                : 'Connect your Google account to two-way sync assignments with a calendar you choose.'}
            </p>

            {syncError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p>{syncError}</p>
                  <button
                    onClick={() => setShowClientIdInput(!showClientIdInput)}
                    className="mt-1 text-[11px] font-extrabold text-rose-900 underline hover:text-caplen-navy"
                  >
                    {showClientIdInput ? 'Hide Client ID Input' : 'Enter Google Client ID manually'}
                  </button>
                </div>
              </div>
            )}

            {showClientIdInput && !isConnected && (
              <form onSubmit={handleSaveCustomClientId} className="mb-3 space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-caplen-navy flex items-center gap-1.5 font-heading">
                  <Key className="h-3.5 w-3.5 text-vibrant-purpleText" />
                  <span>Google OAuth Client ID</span>
                </label>
                <input
                  type="text"
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-caplen-navy py-1.5 text-xs font-extrabold text-white shadow-xs font-heading"
                >
                  Save & Connect Google
                </button>
              </form>
            )}

            {!isConnected ? (
              <button
                onClick={handleConnectGoogle}
                className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all font-heading tracking-wide"
              >
                <span>Connect Google Calendar</span>
              </button>
            ) : !calendarId ? (
              <div className="space-y-2">
                {calendarListError && (
                  <p className="text-xs text-rose-700 font-semibold">{calendarListError}</p>
                )}
                {isLoadingCalendars ? (
                  <p className="text-xs text-caplen-muted font-medium">Loading your calendars…</p>
                ) : (
                  <>
                    {availableCalendars.map((cal) => (
                      <button
                        key={cal.id}
                        onClick={() => handlePickCalendar(cal.id, cal.summary)}
                        className="w-full text-left rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-caplen-navy hover:bg-slate-50 transition-all flex items-center justify-between"
                      >
                        <span>{cal.summary}</span>
                        {cal.primary && <span className="text-[10px] text-caplen-muted">Primary</span>}
                      </button>
                    ))}
                    <button
                      onClick={handleCreateSyllabaCalendar}
                      className="w-full rounded-xl bg-caplen-navy px-3 py-2 text-xs font-extrabold text-white hover:bg-caplen-navyHover transition-all"
                    >
                      ＋ Create new "Syllaba" calendar
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all disabled:opacity-50 font-heading"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync now'}</span>
                  </button>
                  <button
                    onClick={handleChangeCalendar}
                    className="text-[11px] font-bold text-caplen-navy underline hover:text-caplen-navyHover"
                  >
                    Change calendar
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all shadow-xs font-heading"
                  >
                    <Unlink className="h-3.5 w-3.5 text-slate-600" />
                    <span>Disconnect</span>
                  </button>
                </div>

                {syncResult && (
                  <p className="text-xs text-emerald-800 font-bold mt-2.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      Pushed — {syncResult.pushed.created} created, {syncResult.pushed.updated} updated,{' '}
                      {syncResult.pushed.deleted} removed{syncResult.pushed.failed > 0 ? `, ${syncResult.pushed.failed} failed` : ''}.{' '}
                      Pulled — {syncResult.pulled.created} created, {syncResult.pulled.updated} updated,{' '}
                      {syncResult.pulled.deleted} removed{syncResult.pulled.failed > 0 ? `, ${syncResult.pulled.failed} failed` : ''}.
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: builds clean, no TypeScript errors. This is the step that confirms Task 5's "may leave the build red" note is now resolved.

- [ ] **Step 4: Run full test suite once more**

Run: `npm test`
Expected: PASS — no regressions from Tasks 1-5's tests (this task has no new tests of its own, per the note above).

- [ ] **Step 5: Manual end-to-end verification**

Prerequisites: real Google Cloud OAuth credentials configured (`.env` populated per `.env.example`, or manual Client ID entry via the existing in-app flow), `npm run dev:netlify`.

1. Open the app, open the Calendar Sync modal, connect Google (or confirm already connected — existing token will need reconnecting once, since the OAuth scope changed in Task 2).
2. Confirm the calendar picker appears listing real calendars from the connected account, plus "＋ Create new 'Syllaba' calendar".
3. Pick an existing personal/school calendar (not creating a new one) — confirm "Syncing with: {name}" replaces the picker, confirm "Change calendar" and "Sync now" both appear.
4. In Google Calendar directly (outside the app), add a new event to that calendar. Click "Sync now" in the app — confirm the pulled count is ≥1 and the event now appears as an assignment under "Imported from Google Calendar" in the timeline.
5. Edit that imported assignment's due date inside Syllaba, click "Sync now" again — confirm the Google event's time updates (not duplicated) and the local edit isn't clobbered by the next pull (pull sees its own `remoteUpdated` didn't advance and leaves it, then push sends the local edit out).
6. Delete the event in Google Calendar directly, click "Sync now" — confirm the assignment disappears from Syllaba.
7. Click "Change calendar", pick a different calendar, confirm sync now targets the new one.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/CalendarSyncModal.tsx
git commit -m "feat: add Google calendar picker and two-way sync UI"
```
