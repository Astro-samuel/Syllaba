# Google Calendar Two-Way Sync + Calendar Picker — Design

## Goal

Extend the existing one-way Google Calendar push integration (see
[2026-08-18-google-calendar-integration-design.md](2026-08-18-google-calendar-integration-design.md))
into two-way sync, and let the user pick which of their real Google
calendars to sync with instead of always using an app-created "Syllaba"
calendar.

**This supersedes one constraint from the prior spec:** that design explicitly
ruled out reading the user's existing calendar ("app can never read or write
the user's existing calendars/events, only calendars it creates itself").
This design reverses that by user request — the app will now read and write
whichever calendar the user picks.

## Current state (before this change)

Confirmed against the actual code on `main` as of this design (not the
original plan's assumptions, which have partially drifted — file paths,
manual-Client-ID entry, and the Caplen rebrand all happened via concurrent
work outside this design's authorship):

- `src/utils/googleAuth.ts` — OAuth URL builder (scope:
  `https://www.googleapis.com/auth/calendar.app.created`), token
  exchange/refresh via `netlify/functions/google-token.ts`. Also has
  `getGoogleClientId`/`saveGoogleClientId` for a manual-entry fallback when
  `VITE_GOOGLE_CLIENT_ID` isn't configured — keep this fallback as-is, out of
  scope for this design.
- `src/utils/googleCalendarSync.ts` — pure `buildSignature`/`computeSyncPlan`
  diff logic, push-direction only.
- `src/utils/googleCalendarApi.ts` — `syncAssignments` orchestrates push only:
  auto-creates a calendar named "Syllaba" if none is cached
  (`ensureSyllabaCalendar`), then creates/updates/deletes events in it.
- `src/types/index.ts` — `GoogleCalendarAuth { accessToken, refreshToken,
  expiresAt, calendarId, events: Record<assignmentId, SyncedEventRecord> }`,
  `SyncedEventRecord { googleEventId, signature }`.
- `src/components/CalendarSyncModal.tsx` — Connect / Sync now / Disconnect UI,
  no calendar picker, no import.

## Scope of this change

1. Broaden OAuth scope to full calendar read/write (approved tradeoff).
2. Add a calendar picker: list the user's calendars, let them pick one
   (or create a new "Syllaba" calendar) — replaces the current
   always-auto-create behavior.
3. Add pull (import): events in the picked calendar become Syllaba
   assignments.
4. Existing push (export) behavior is preserved, now targeting whichever
   calendar is picked instead of the hardcoded auto-created one.
5. Both directions run from the same manual "Sync now" click — no new
   trigger, no background polling.

## OAuth scope change

`src/utils/googleAuth.ts`: `SCOPE` changes from
`https://www.googleapis.com/auth/calendar.app.created` to
`https://www.googleapis.com/auth/calendar`. This is required to list
calendars the app didn't create and to read/write events in them. Anyone
already connected under the old narrower scope will need to reconnect —
`syncAssignments` should detect a Google `403 insufficientPermissions` and
prompt reconnect rather than fail silently (see Error handling).

## Data model changes

`src/types/index.ts`:

```ts
export interface SyncedEventRecord {
  googleEventId: string;
  signature: string;        // last-pushed local content signature (push diff, unchanged from today)
  remoteUpdated: string | null; // last-seen Google 'updated' RFC3339 timestamp (pull diff); null until first pulled
}

export interface GoogleCalendarAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  calendarId: string | null;      // now: the user's PICKED calendar id (was: auto-created "Syllaba" calendar id)
  calendarSummary: string | null; // display name of the picked calendar, for the UI
  events: Record<string, SyncedEventRecord>; // assignmentId -> record, used for BOTH push and pull matching
}
```

One map (`events`), not two. `assignmentId -> googleEventId` already lets pull
match an incoming Google event back to its Syllaba assignment via a reverse
lookup (`Object.values(events).find(r => r.googleEventId === event.id)`) — no
need for a second `importedEvents` map. This also means an assignment that
originated from an import and is later edited in Syllaba gets pushed back to
the *same* Google event on the next sync (a real PATCH, not a duplicate),
which is the correct two-way behavior.

`src/utils/storage.ts` bump: `GOOGLE_CALENDAR_KEY` stays
`'syllaba_google_calendar_v1'` — no migration needed, since this is additive
(`remoteUpdated`/`calendarSummary` are new optional-shaped fields read as
`undefined`/absent on old stored blobs, which the code below treats as
"never pulled" — safe default, no separate migration step required).

**New pseudo-course for imports:** `src/utils/storage.ts` gains a function
`getOrCreateGoogleImportCourse(): Course` — looks for a course with
`id === 'c_google_import'` in `getStoredCourses()`; if absent, creates and
persists one (`name: 'Imported from Google Calendar'`, `code: 'GCAL'`,
`color: '#4285F4'` — Google's blue, so imported items are visually
identifiable in the timeline). Every assignment created by pull uses this
course's `id`/`name`/`color`.

## Calendar picker

New function in `src/utils/googleCalendarApi.ts`:

```ts
export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarListEntry[]>
```

Calls `GET /users/me/calendarList` (paginated via `nextPageToken`, but capped
at 2 pages / ~500 calendars — no real user has more, YAGNI beyond that),
returns `{ id, summary, primary }` per entry, refreshing the access token
first via the existing `getValidAccessToken` path (already handles
expiry/refresh, reused as-is).

`CalendarSyncModal.tsx`: once connected, if no calendar is yet picked
(`calendarId === null`), show a dropdown populated by `listGoogleCalendars()`
plus one extra synthetic option "＋ Create new 'Syllaba' calendar". Selecting
an existing calendar sets `calendarId`/`calendarSummary` directly (no
creation call). Selecting the synthetic option calls the existing
`ensureSyllabaCalendar`-style creation (kept, renamed `createSyllabaCalendar`
for clarity now that "ensure" no longer fits — it's no longer the implicit
default path). Once picked, the modal shows "Syncing with: {calendarSummary}"
with a "Change calendar" link that re-opens the picker.

## Sync orchestration (pull-then-push)

`src/utils/googleCalendarApi.ts` `syncAssignments` signature changes to also
need write-back access to the assignments array (pull can create/update/delete
assignments, which today's function has no way to hand back to
`CalendarSyncModal`'s React state). New shape:

```ts
export interface SyncResult {
  pushed: { created: number; updated: number; deleted: number; failed: number };
  pulled: { created: number; updated: number; deleted: number; failed: number };
}

export async function syncAssignments(
  assignments: Assignment[]
): Promise<{ result: SyncResult; assignments: Assignment[] }>
```

`CalendarSyncModal.tsx`'s `handleSyncNow` already holds `assignments` as a
prop from `App.tsx`; the modal doesn't own assignment state today (`App.tsx`
does, via `updateAssignments`). So `CalendarSyncModal` needs a new prop
`onAssignmentsChanged: (assignments: Assignment[]) => void` wired to
`App.tsx`'s existing `updateAssignments`, called after a successful sync with
the `assignments` the pull step produced (merged with the caller's original
array — pull only touches imported-course assignments, push doesn't mutate
assignments at all, so this is a safe additive merge, not a full replace).

**Order inside `syncAssignments`:**

1. Resolve access token (existing `getValidAccessToken`, unchanged).
2. **Pull:** `GET /calendars/{calendarId}/events?timeMin={6 months ago,
   RFC3339}&singleEvents=true` (single page — Google caps at 250 results per
   page; pagination beyond that is out of scope, YAGNI for a course
   schedule). For each returned event:
   - Reverse-lookup `assignmentId` by `event.id` in `auth.events`.
   - **Found + `event.updated` newer than the stored `remoteUpdated`:**
     update the matching local assignment's `title`/`dueDate`/`dueTime` from
     the event, bump `remoteUpdated`.
   - **Found + not newer:** no-op (nothing changed remotely since last pull).
   - **Not found:** create a new assignment (via
     `getOrCreateGoogleImportCourse()`), add a new `events` record with
     `remoteUpdated: event.updated` and `signature` computed from the new
     assignment (so the immediately-following push step sees it as
     unchanged and doesn't redundantly PATCH what was just pulled).
   - Events present in `auth.events` but absent from this fetch (deleted on
     Google's side) → delete the matching local assignment, remove its
     `events` record.
3. **Push:** unchanged from today — `computeSyncPlan(assignments, auth.events)`
   against the (possibly pull-updated) `events` map, create/update/delete
   Google events for local assignments including any not just pulled.
4. Persist the final merged `events` map once at the end (single
   `saveGoogleCalendarAuth` call, same as today).

`buildSignature` (`googleCalendarSync.ts`) is unchanged — it already only
depends on `Assignment` fields, agnostic to origin.

## Event ⇄ Assignment field mapping (pull direction)

| Google event field | Assignment field |
|---|---|
| `summary` | `title` (verbatim; no `[courseName]` stripping attempted — imported events don't carry a parseable course prefix in general) |
| `start.date` (all-day) or `start.dateTime` | `dueDate` (`YYYY-MM-DD`, sliced from either form) |
| `start.dateTime`'s time part, if present | `dueTime`; `null` for all-day events |
| — | `type: 'other'` (Google events have no concept of homework/exam/etc.) |
| — | `weightPercent: null`, `score: null`, `completed: false` |
| `id` | stored in the `events` map, not on the `Assignment` itself |

## Error handling

- **`403` on any Calendar API call** (stale narrower-scope token from before
  this change, or revoked access): treat identically to today's refresh
  failure — `clearGoogleCalendarAuth()`, surface "Google Calendar access
  needs to be reconnected" in the modal, don't silently drop the sync.
- **Per-item pull failure** (malformed event, transient network error):
  same isolation pattern as push already uses — caught individually, counted
  in `result.pulled.failed`, doesn't abort the rest of the batch.
- **Calendar list fetch failure** (picker can't load): show inline retry in
  the picker UI rather than blocking the whole modal.

## Explicitly out of scope

- Real-time/background sync — still manual "Sync now" only, per existing
  constraint.
- Automatic conflict-resolution UI — same-tick pull-then-push ordering means
  "local wins" on same-item conflicts, no dialog, per approved design.
- Multi-calendar sync (picking more than one calendar at once) — one picked
  calendar at a time, per approved design.
- Pagination beyond ~250 pulled events / ~500 listed calendars — no realistic
  user hits either limit for a course-schedule use case.
- Recurring-event expansion beyond what `singleEvents=true` already gives
  Google's API to flatten for us.
- Editing the pseudo "Imported from Google Calendar" course's name/color from
  the UI — it's system-created, out of scope to make it user-editable in
  this pass.

## Testing

- Unit test `googleCalendarApi.ts`'s pull-diff logic with mocked `fetch`
  (mirrors the existing push tests' style): a new remote event creates an
  assignment in the import pseudo-course; an updated remote event (newer
  `updated`) patches the existing assignment; an unchanged remote event is a
  no-op (no assignment mutation, no `saveGoogleCalendarAuth` call beyond the
  final persist); a remote deletion removes the local assignment.
- Unit test `listGoogleCalendars()` against mocked `fetch` (parses
  `id`/`summary`/`primary` correctly, handles the empty-list case).
- Manual end-to-end (extends the original spec's manual verification): pick
  an existing personal calendar (not "Syllaba"), add an event in Google
  Calendar directly, click "Sync now", confirm it appears as a Syllaba
  assignment under "Imported from Google Calendar"; edit that assignment's
  due date in Syllaba, sync again, confirm the Google event's time updates
  (not a duplicate); delete the event in Google Calendar, sync again, confirm
  the Syllaba assignment disappears.
