# Google Calendar Integration — Design

## Goal

Let a Syllaba user connect their real Google Calendar and have assignments auto-created/updated there as Google Calendar events, triggered manually via a "Sync now" button. No accounts, no server-side database — consistent with the product's existing "100% free, private, no login required, everything stored locally" principle (PRODUCT.md).

## Current state (before this change)

`CalendarSyncModal.tsx` already offers:
- `.ics` file download (`calendarExport.ts` → `downloadICSFile`)
- Per-assignment "Add to Google Calendar" template link (`generateGoogleCalendarUrl`, no auth)
- A fake "Live Subscription Feed URL" (`webcal://syllaba.app/feed/user-demo-calendar.ics`) — not real, out of scope for this design
- A fake "Daily Email Reminders" signup — not real, out of scope for this design

Neither existing feature auto-pushes/updates events on a real account. This design adds that.

## Why OAuth needs a backend

Google's OAuth `authorization_code` → token exchange requires a client secret. A client secret cannot ship in browser JS (it would be public). A minimal serverless function proxies just that one exchange step and holds the secret as a server-only env var. It does not store anything — no DB, no sessions.

## Architecture

```
Browser (React)                     Serverless (Netlify)             Google
────────────────                    ────────────────────             ──────
1. Click "Connect"
   → redirect to Google consent ────────────────────────────────────→
                                                                  (user approves)
2. Redirect back with ?code=... ←─────────────────────────────────────
3. POST code to
   /api/google/token         ──→  exchange code+secret for
                                   access_token/refresh_token  ──────→
                              ←──  tokens                      ←──────
   ←── tokens returned to browser
4. Save tokens to localStorage
5. "Sync now" → Calendar API calls directly from browser ─────────────→
   (create calendar, create/update/delete events)
```

- New file: `netlify/functions/google-token.ts` (Netlify Function). Single responsibility: accept `{ code, redirectUri }` (or `{ refreshToken }` for refresh), call Google's token endpoint with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env vars, return `{ access_token, refresh_token, expires_in }` (refresh calls return a refreshed `access_token` only). No persistence, no logging of tokens. Requires a `netlify.toml` with `[build] functions = "netlify/functions"` and, for local dev, `netlify dev` (not plain `vite dev`) so `/.netlify/functions/google-token` resolves.
- New file: `src/utils/googleCalendar.ts` — all browser-side Google Calendar logic:
  - `getAuthUrl()` — builds Google OAuth consent URL. Scope: `https://www.googleapis.com/auth/calendar.app.created` (app can only see/manage calendars it creates — cannot read the user's existing events or primary calendar). `access_type=offline`, `prompt=consent` (needed to reliably get a `refresh_token`).
  - `exchangeCodeForTokens(code)` — calls `/.netlify/functions/google-token`.
  - `refreshAccessToken(refreshToken)` — calls `/.netlify/functions/google-token` with refresh grant.
  - `ensureSyllabaCalendar(accessToken)` — looks up stored calendar id; if missing, creates a calendar named "Syllaba" via `POST /calendars`, stores its id.
  - `syncAssignments(assignments)` — orchestrates: refresh token if needed → ensure calendar → diff `assignments` against stored `assignment.id → googleEventId` map → `POST` new events, `PATCH` changed events, `DELETE` removed events → update the map.
  - `disconnect()` — clears all Google-related localStorage keys.
- Extend `src/utils/storage.ts` with the same localStorage pattern already used for assignments, for a `google_calendar` blob: `{ accessToken, refreshToken, expiresAt, calendarId, eventMap: Record<assignmentId, googleEventId> }`.
- `CalendarSyncModal.tsx` gets a new section: "Connect Google Calendar" (button) → once connected, shows "Connected ✓" + "Sync now" button + "Disconnect" link, replacing/sitting alongside the existing static Google Calendar link option.

## Data mapping (Syllaba assignment → Google event)

| Assignment field | Google event field |
|---|---|
| `title` + `courseName` | `summary`: `[${courseName}] ${title}` |
| `dueDate` + `dueTime` | `start`/`end` (same as existing `.ics`/template logic — reuse date/time formatting from `calendarExport.ts` rather than duplicating it) |
| `type`, `weightPercent`, `courseName` | `description` |
| `id` | stored in `extendedProperties.private.syllabaId` on the event, as a durable backup identity link in case the local `eventMap` is ever lost (browser data cleared) — sync can then reconcile by searching `extendedProperties.private.syllabaId` before creating a duplicate |

## Sync semantics

- Manual only — a "Sync now" button, not automatic on every assignment edit (per approved design decision: predictable, bounded API calls).
- Idempotent: re-running sync with no changes makes no API calls (diff finds nothing to do).
- Deletions: an assignment removed from Syllaba has its mapped Google event deleted on next sync.
- Dedicated calendar only: this feature never touches the user's primary calendar or reads their existing events (scope enforces this).

## Error handling

- Access token expired (per stored `expiresAt`) → silently refresh via `refreshAccessToken` before sync proceeds.
- Refresh fails (revoked/expired refresh token) → clear stored tokens, show "Reconnect Google Calendar" state instead of silent failure.
- Per-event API failure during a sync batch → don't abort the whole batch; collect failures, show "Synced 8 of 10 — 2 failed, try again" in the modal.
- Network/API errors surfaced as inline text in the modal, no silent failures.

## Explicitly out of scope

- Reading the user's existing Google Calendar events (read-only import) — not requested.
- Auto-sync on every assignment change — explicitly rejected in favor of manual "Sync now".
- Server-side accounts/database/session auth — explicitly rejected; localStorage-only per product's no-login principle.
- Fixing the existing fake webcal subscription feed or fake email digest signup — pre-existing stubs, unrelated to this feature.

## Config required from user before implementation

- A Google Cloud project with the Calendar API enabled, and an OAuth 2.0 Web Client (ID + secret).
- Authorized redirect URI(s) registered on that OAuth client (one for local dev, one for production).
- Hosting target: **Netlify** (confirmed). Needs a `netlify.toml` added at repo root pointing `functions` at `netlify/functions`, and `@netlify/functions` added as a dependency for typed handlers.
- `GOOGLE_CLIENT_ID` (safe to expose in browser — used to build the consent URL) and `GOOGLE_CLIENT_SECRET` (server-only env var, set in Netlify site settings, never in a `VITE_`-prefixed var) — `GOOGLE_CLIENT_ID` additionally set as `VITE_GOOGLE_CLIENT_ID` (build-time, public) since Vite only exposes `VITE_`-prefixed vars to the browser.

## Testing

- Unit test `googleCalendar.ts` diff logic (given assignments + existing eventMap, produces correct create/update/delete sets) with mocked `fetch`.
- Manual end-to-end: connect real Google account in dev, sync, verify events land in a calendar literally named "Syllaba" (not primary), edit an assignment, re-sync, verify event updates not duplicates, delete an assignment, re-sync, verify event removed, disconnect, verify localStorage cleared.
