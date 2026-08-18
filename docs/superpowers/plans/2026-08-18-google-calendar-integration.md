# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Syllaba user connect their Google account and push assignments to a dedicated "Syllaba" Google Calendar via a manual "Sync now" button, using a Netlify Function to broker OAuth (no server-side database, all state in localStorage).

**Architecture:** Browser redirects to Google's OAuth consent screen → Google redirects back with a `code` → browser POSTs `code` to a Netlify Function (`netlify/functions/google-token.ts`), which holds the OAuth client secret and exchanges it for tokens → tokens are stored in `localStorage` → all Google Calendar API calls (create/update/delete events, create calendar) happen directly from the browser using the stored access token, refreshed via the same Netlify Function when expired.

**Tech Stack:** React + TypeScript + Vite (existing), Netlify Functions (`@netlify/functions`), Vitest + jsdom (new test infra — none exists yet), native `fetch` (no Google SDK — plain REST calls to `oauth2.googleapis.com` and `www.googleapis.com/calendar/v3`).

## Global Constraints

- No server-side database, no user accounts, no sessions — all Google Calendar state lives in `localStorage`, matching PRODUCT.md's "no login required, everything stored locally."
- OAuth scope is `https://www.googleapis.com/auth/calendar.app.created` only — the app must never be able to read or write the user's existing calendars/events, only calendars it creates itself.
- Sync is manual only (a "Sync now" button) — never automatic on assignment change.
- The dedicated calendar is named exactly `Syllaba` and is created once, id cached in localStorage.
- `GOOGLE_CLIENT_SECRET` must only ever be read server-side (`process.env` inside the Netlify Function) — never referenced in any file under `src/`.
- `GOOGLE_CLIENT_ID` is public; expose it to the browser as `VITE_GOOGLE_CLIENT_ID`.

---

### Task 1: Netlify Function for OAuth token exchange + test infra

**Files:**
- Create: `netlify.toml`
- Create: `netlify/functions/google-token.ts`
- Create: `.env.example`
- Modify: `package.json` (add `@netlify/functions`, `vitest`, `jsdom` deps; add `"test": "vitest run"` script)
- Modify: `vite.config.ts` (add Vitest `test` config block)
- Test: `netlify/functions/google-token.test.ts`

**Interfaces:**
- Produces: `POST /.netlify/functions/google-token` accepting either `{ code: string, redirectUri: string }` or `{ refreshToken: string }`, returning `{ accessToken: string, refreshToken: string | null, expiresIn: number }` on success (HTTP 200) or `{ error: string }` (HTTP 4xx/5xx). Later tasks (Task 4) call this endpoint by URL string — no shared TypeScript import between frontend and function.

- [ ] **Step 1: Add `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev"
  targetPort = 5173
  framework = "#custom"
```

- [ ] **Step 2: Add `.env.example`**

```
# Public — safe to expose in the browser bundle. Set in Netlify site settings AND local .env.
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Server-only — set in Netlify site settings (Site configuration > Environment variables).
# Never prefix with VITE_. Never commit the real value.
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

- [ ] **Step 3: Install dependencies**

Run: `npm install --save-dev @netlify/functions vitest jsdom @vitest/coverage-v8`
Expected: `package.json` `devDependencies` gains `@netlify/functions`, `vitest`, `jsdom`, `@vitest/coverage-v8`.

- [ ] **Step 4: Add test script to `package.json`**

Modify the `"scripts"` block (`package.json:6-11`):

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 5: Add Vitest config to `vite.config.ts`**

Replace the full file contents:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 6: Write `netlify/functions/google-token.ts`**

```ts
import type { Handler } from '@netlify/functions';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface TokenRequestBody {
  code?: string;
  redirectUri?: string;
  refreshToken?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server misconfigured: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET' })
    };
  }

  let payload: TokenRequestBody;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);

  if (payload.refreshToken) {
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', payload.refreshToken);
  } else if (payload.code && payload.redirectUri) {
    params.set('grant_type', 'authorization_code');
    params.set('code', payload.code);
    params.set('redirect_uri', payload.redirectUri);
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Must provide either { code, redirectUri } or { refreshToken }' })
    };
  }

  const googleRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await googleRes.json();

  if (!googleRes.ok) {
    return {
      statusCode: googleRes.status,
      body: JSON.stringify({ error: data.error_description || data.error || 'Google token exchange failed' })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresIn: data.expires_in
    })
  };
};
```

- [ ] **Step 7: Write the failing test**

```ts
// netlify/functions/google-token.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from './google-token';

function makeEvent(body: unknown, method = 'POST') {
  return { httpMethod: method, body: JSON.stringify(body) } as any;
}

describe('google-token handler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, GOOGLE_CLIENT_ID: 'test-id', GOOGLE_CLIENT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
  });

  it('rejects non-POST methods', async () => {
    const res = await handler(makeEvent({}, 'GET'), {} as any, {} as any);
    expect(res!.statusCode).toBe(405);
  });

  it('rejects when neither code nor refreshToken provided', async () => {
    const res = await handler(makeEvent({}), {} as any, {} as any);
    expect(res!.statusCode).toBe(400);
  });

  it('exchanges an authorization code for tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at123', refresh_token: 'rt123', expires_in: 3600 })
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(
      makeEvent({ code: 'abc', redirectUri: 'https://example.com/callback' }),
      {} as any,
      {} as any
    );

    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body as string);
    expect(body).toEqual({ accessToken: 'at123', refreshToken: 'rt123', expiresIn: 3600 });

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentParams = new URLSearchParams(requestInit.body);
    expect(sentParams.get('grant_type')).toBe('authorization_code');
    expect(sentParams.get('code')).toBe('abc');
    expect(sentParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(sentParams.get('client_secret')).toBe('test-secret');
  });

  it('refreshes an access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at456', expires_in: 3600 })
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(makeEvent({ refreshToken: 'rt123' }), {} as any, {} as any);

    expect(res!.statusCode).toBe(200);
    const body = JSON.parse(res!.body as string);
    expect(body).toEqual({ accessToken: 'at456', refreshToken: null, expiresIn: 3600 });

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentParams = new URLSearchParams(requestInit.body);
    expect(sentParams.get('grant_type')).toBe('refresh_token');
    expect(sentParams.get('refresh_token')).toBe('rt123');
  });

  it('surfaces Google API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Bad code' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(
      makeEvent({ code: 'bad', redirectUri: 'https://example.com/callback' }),
      {} as any,
      {} as any
    );

    expect(res!.statusCode).toBe(400);
    const body = JSON.parse(res!.body as string);
    expect(body.error).toBe('Bad code');
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- netlify/functions/google-token.test.ts`
Expected: FAIL — `Cannot find module './google-token'` or similar (file exists from Step 6, so this should actually now compile; if Steps 6 and 7 were both applied it should PASS — run it anyway to confirm no red flags before moving on).

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- netlify/functions/google-token.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 10: Commit**

```bash
git add netlify.toml netlify/functions/google-token.ts netlify/functions/google-token.test.ts .env.example package.json package-lock.json vite.config.ts
git commit -m "feat: add Netlify Function for Google OAuth token exchange"
```

---

### Task 2: localStorage persistence for Google Calendar state

**Files:**
- Modify: `src/types/index.ts` (add `GoogleCalendarAuth` type)
- Modify: `src/utils/storage.ts` (add get/save/clear functions)
- Test: `src/utils/storage.googleCalendar.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 3 and Task 5):
  ```ts
  interface SyncedEventRecord {
    googleEventId: string;
    signature: string;
  }
  interface GoogleCalendarAuth {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // epoch ms
    calendarId: string | null;
    events: Record<string, SyncedEventRecord>; // assignmentId -> record
  }
  function getGoogleCalendarAuth(): GoogleCalendarAuth | null;
  function saveGoogleCalendarAuth(auth: GoogleCalendarAuth): void;
  function clearGoogleCalendarAuth(): void;
  ```

- [ ] **Step 1: Add the type to `src/types/index.ts`**

Append to the end of the file:

```ts

export interface SyncedEventRecord {
  googleEventId: string;
  signature: string;
}

export interface GoogleCalendarAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  calendarId: string | null;
  events: Record<string, SyncedEventRecord>; // assignmentId -> record
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/utils/storage.googleCalendar.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getGoogleCalendarAuth, saveGoogleCalendarAuth, clearGoogleCalendarAuth } from './storage';
import { GoogleCalendarAuth } from '../types';

describe('Google Calendar auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(getGoogleCalendarAuth()).toBeNull();
  });

  it('round-trips a saved auth object', () => {
    const auth: GoogleCalendarAuth = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1234567890,
      calendarId: 'cal123',
      events: { a_1: { googleEventId: 'ev1', signature: 'sig1' } }
    };
    saveGoogleCalendarAuth(auth);
    expect(getGoogleCalendarAuth()).toEqual(auth);
  });

  it('clears stored auth', () => {
    saveGoogleCalendarAuth({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1,
      calendarId: null,
      events: {}
    });
    clearGoogleCalendarAuth();
    expect(getGoogleCalendarAuth()).toBeNull();
  });

  it('returns null and does not throw on corrupted JSON', () => {
    localStorage.setItem('syllaba_google_calendar_v1', '{not json');
    expect(getGoogleCalendarAuth()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/utils/storage.googleCalendar.test.ts`
Expected: FAIL — `getGoogleCalendarAuth is not a function` (not yet exported).

- [ ] **Step 4: Add storage functions to `src/utils/storage.ts`**

Modify the import line at `src/utils/storage.ts:1` to also import the new type:

```ts
import { Course, Assignment, StreakState, GoogleCalendarAuth } from '../types';
```

Add a new key constant next to the existing ones (`src/utils/storage.ts:5-7`):

```ts
const GOOGLE_CALENDAR_KEY = 'syllaba_google_calendar_v1';
```

Append these functions at the end of the file:

```ts

export function getGoogleCalendarAuth(): GoogleCalendarAuth | null {
  try {
    const raw = localStorage.getItem(GOOGLE_CALENDAR_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load Google Calendar auth from localStorage', e);
    return null;
  }
}

export function saveGoogleCalendarAuth(auth: GoogleCalendarAuth): void {
  localStorage.setItem(GOOGLE_CALENDAR_KEY, JSON.stringify(auth));
}

export function clearGoogleCalendarAuth(): void {
  localStorage.removeItem(GOOGLE_CALENDAR_KEY);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/utils/storage.googleCalendar.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/storage.ts src/utils/storage.googleCalendar.test.ts
git commit -m "feat: add localStorage persistence for Google Calendar auth state"
```

---

### Task 3: Pure sync-plan diff logic

**Files:**
- Create: `src/utils/googleCalendarSync.ts`
- Test: `src/utils/googleCalendarSync.test.ts`

**Interfaces:**
- Consumes: `Assignment` (from `src/types/index.ts`), `SyncedEventRecord` (from `src/types/index.ts`).
- Produces (used by Task 5):
  ```ts
  function buildSignature(assignment: Assignment): string;
  interface SyncPlan {
    toCreate: Assignment[];
    toUpdate: { assignment: Assignment; googleEventId: string }[];
    toDelete: string[]; // googleEventIds
  }
  function computeSyncPlan(
    assignments: Assignment[],
    events: Record<string, SyncedEventRecord>
  ): SyncPlan;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/googleCalendarSync.test.ts
import { describe, it, expect } from 'vitest';
import { buildSignature, computeSyncPlan } from './googleCalendarSync';
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

describe('buildSignature', () => {
  it('is stable for identical content', () => {
    const a = makeAssignment();
    const b = makeAssignment();
    expect(buildSignature(a)).toBe(buildSignature(b));
  });

  it('changes when due date changes', () => {
    const a = makeAssignment();
    const b = makeAssignment({ dueDate: '2026-09-02' });
    expect(buildSignature(a)).not.toBe(buildSignature(b));
  });

  it('is unaffected by fields outside the mapped set (e.g. completed)', () => {
    const a = makeAssignment({ completed: false });
    const b = makeAssignment({ completed: true });
    expect(buildSignature(a)).toBe(buildSignature(b));
  });
});

describe('computeSyncPlan', () => {
  it('plans a create for an assignment with no event record', () => {
    const plan = computeSyncPlan([makeAssignment()], {});
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans nothing when signature is unchanged', () => {
    const assignment = makeAssignment();
    const events = { a_1: { googleEventId: 'ev1', signature: buildSignature(assignment) } };
    const plan = computeSyncPlan([assignment], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans an update when signature changed', () => {
    const assignment = makeAssignment({ title: 'Homework 1 (revised)' });
    const events = { a_1: { googleEventId: 'ev1', signature: 'stale-signature' } };
    const plan = computeSyncPlan([assignment], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toEqual([{ assignment, googleEventId: 'ev1' }]);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans a delete for an event with no matching assignment', () => {
    const events = { a_gone: { googleEventId: 'ev_gone', signature: 'x' } };
    const plan = computeSyncPlan([], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toEqual(['ev_gone']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/googleCalendarSync.test.ts`
Expected: FAIL — `Failed to resolve import "./googleCalendarSync"`.

- [ ] **Step 3: Write `src/utils/googleCalendarSync.ts`**

```ts
import { Assignment, SyncedEventRecord } from '../types';

export function buildSignature(assignment: Assignment): string {
  return JSON.stringify({
    title: assignment.title,
    courseName: assignment.courseName,
    dueDate: assignment.dueDate,
    dueTime: assignment.dueTime,
    type: assignment.type,
    weightPercent: assignment.weightPercent
  });
}

export interface SyncPlan {
  toCreate: Assignment[];
  toUpdate: { assignment: Assignment; googleEventId: string }[];
  toDelete: string[]; // googleEventIds
}

export function computeSyncPlan(
  assignments: Assignment[],
  events: Record<string, SyncedEventRecord>
): SyncPlan {
  const toCreate: Assignment[] = [];
  const toUpdate: { assignment: Assignment; googleEventId: string }[] = [];

  const seenAssignmentIds = new Set<string>();

  for (const assignment of assignments) {
    seenAssignmentIds.add(assignment.id);
    const existing = events[assignment.id];
    const signature = buildSignature(assignment);

    if (!existing) {
      toCreate.push(assignment);
    } else if (existing.signature !== signature) {
      toUpdate.push({ assignment, googleEventId: existing.googleEventId });
    }
    // else: signature unchanged, nothing to do
  }

  const toDelete: string[] = Object.entries(events)
    .filter(([assignmentId]) => !seenAssignmentIds.has(assignmentId))
    .map(([, record]) => record.googleEventId);

  return { toCreate, toUpdate, toDelete };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/googleCalendarSync.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/googleCalendarSync.ts src/utils/googleCalendarSync.test.ts
git commit -m "feat: add pure Google Calendar sync-plan diff logic"
```

---

### Task 4: OAuth URL + token exchange/refresh wrappers

**Files:**
- Create: `src/utils/googleAuth.ts`
- Test: `src/utils/googleAuth.test.ts`

**Interfaces:**
- Consumes: `GoogleCalendarAuth`-shaped token fields (no direct import needed — functions here only produce them).
- Produces (used by Task 5 and Task 6):
  ```ts
  function getGoogleAuthUrl(redirectUri: string): string;
  function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }>;
  function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/googleAuth.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getGoogleAuthUrl, exchangeCodeForTokens, refreshAccessToken } from './googleAuth';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getGoogleAuthUrl', () => {
  it('builds a consent URL with the app-created-calendar scope and given redirect URI', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-abc');
    const url = new URL(getGoogleAuthUrl('https://example.com/app'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.app.created');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });
});

describe('exchangeCodeForTokens', () => {
  it('posts to the Netlify function and maps the response, computing expiresAt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'at1', refreshToken: 'rt1', expiresIn: 3600 })
    });
    vi.stubGlobal('fetch', fetchMock);
    const before = Date.now();

    const result = await exchangeCodeForTokens('code123', 'https://example.com/app');

    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/google-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'code123', redirectUri: 'https://example.com/app' })
      })
    );
    expect(result.accessToken).toBe('at1');
    expect(result.refreshToken).toBe('rt1');
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  it('throws with the server error message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bad code' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCodeForTokens('bad', 'https://example.com/app')).rejects.toThrow('Bad code');
  });
});

describe('refreshAccessToken', () => {
  it('posts a refreshToken and returns a new access token + expiresAt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'at2', refreshToken: null, expiresIn: 3600 })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshAccessToken('rt1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/google-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'rt1' })
      })
    );
    expect(result.accessToken).toBe('at2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/googleAuth.test.ts`
Expected: FAIL — `Failed to resolve import "./googleAuth"`.

- [ ] **Step 3: Write `src/utils/googleAuth.ts`**

```ts
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_FUNCTION_URL = '/.netlify/functions/google-token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent'
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

async function postToTokenFunction(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Google token request failed');
  }
  return data;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const data = await postToTokenFunction({ code, redirectUri });
  if (!data.refreshToken) {
    throw new Error('Google did not return a refresh token. Try disconnecting and reconnecting.');
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const data = await postToTokenFunction({ refreshToken });
  return {
    accessToken: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1000
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/googleAuth.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/googleAuth.ts src/utils/googleAuth.test.ts
git commit -m "feat: add Google OAuth URL + token exchange/refresh wrappers"
```

---

### Task 5: Calendar API wrappers + sync orchestration

**Files:**
- Create: `src/utils/googleCalendarApi.ts`
- Test: `src/utils/googleCalendarApi.test.ts`

**Interfaces:**
- Consumes:
  - `computeSyncPlan`, `buildSignature` from `src/utils/googleCalendarSync.ts` (Task 3)
  - `refreshAccessToken` from `src/utils/googleAuth.ts` (Task 4)
  - `getGoogleCalendarAuth`, `saveGoogleCalendarAuth`, `clearGoogleCalendarAuth` from `src/utils/storage.ts` (Task 2)
  - `Assignment`, `GoogleCalendarAuth` from `src/types/index.ts`
- Produces (used by Task 6):
  ```ts
  interface SyncResult {
    created: number;
    updated: number;
    deleted: number;
    failed: number;
  }
  async function syncAssignments(assignments: Assignment[]): Promise<SyncResult>;
  function disconnectGoogleCalendar(): void;
  ```

**Known simplification vs. spec:** the design spec's `extendedProperties.private.syllabaId` reconciliation ("search by syllabaId before creating a duplicate," for when the local `events` map is lost but the calendar isn't) is written onto every created event below, but this task does not implement the reconciliation *lookup* — it only relies on the local `events` map to decide create vs. update. `events` and `calendarId` live in the same localStorage blob and are always cleared together, so in practice the map is never lost while the calendar id survives, making the lookup dead code for the flows this app actually has. The field is kept so a future task could add the lookup cheaply if a real gap emerges (e.g. multi-device use). Flagging this explicitly rather than silently dropping it.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/googleCalendarApi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncAssignments, disconnectGoogleCalendar } from './googleCalendarApi';
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

describe('syncAssignments', () => {
  beforeEach(() => {
    localStorage.clear();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000, // not expired
      calendarId: 'cal123',
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

  it('creates a new event and records it in storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'gEvent1' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAssignments([makeAssignment()]);

    expect(result).toEqual({ created: 1, updated: 0, deleted: 0, failed: 0 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/cal123/events');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer valid-token');

    const stored = getGoogleCalendarAuth();
    expect(stored!.events.a_1).toEqual({
      googleEventId: 'gEvent1',
      signature: buildSignature(makeAssignment())
    });
  });

  it('does nothing when signature is unchanged (no fetch calls)', async () => {
    const assignment = makeAssignment();
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal123',
      events: { a_1: { googleEventId: 'gEvent1', signature: buildSignature(assignment) } }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAssignments([assignment]);

    expect(result).toEqual({ created: 0, updated: 0, deleted: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes events for removed assignments', async () => {
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'cal123',
      events: { a_gone: { googleEventId: 'gEventGone', signature: 'x' } }
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAssignments([]);

    expect(result).toEqual({ created: 0, updated: 0, deleted: 1, failed: 0 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/cal123/events/gEventGone');
    expect(init.method).toBe('DELETE');
    expect(getGoogleCalendarAuth()!.events.a_gone).toBeUndefined();
  });

  it('creates the Syllaba calendar on first sync when none is cached', async () => {
    saveGoogleCalendarAuth({
      accessToken: 'valid-token',
      refreshToken: 'rt1',
      expiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: null,
      events: {}
    });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === 'https://www.googleapis.com/calendar/v3/calendars') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'newCal1' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 'gEvent1' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await syncAssignments([makeAssignment()]);

    const createCalCall = fetchMock.mock.calls.find(
      ([url]) => url === 'https://www.googleapis.com/calendar/v3/calendars'
    );
    expect(createCalCall).toBeDefined();
    expect(JSON.parse(createCalCall![1].body)).toEqual({ summary: 'Syllaba' });
    expect(getGoogleCalendarAuth()!.calendarId).toBe('newCal1');
  });

  it('continues past a single failed event and counts it as failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'nope' } }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAssignments([makeAssignment()]);

    expect(result).toEqual({ created: 0, updated: 0, deleted: 0, failed: 1 });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: FAIL — `Failed to resolve import "./googleCalendarApi"`.

- [ ] **Step 3: Write `src/utils/googleCalendarApi.ts`**

```ts
import { Assignment } from '../types';
import { getGoogleCalendarAuth, saveGoogleCalendarAuth, clearGoogleCalendarAuth } from './storage';
import { computeSyncPlan, buildSignature } from './googleCalendarSync';
import { refreshAccessToken } from './googleAuth';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
}

function toEventBody(assignment: Assignment) {
  const dateTime = assignment.dueTime
    ? `${assignment.dueDate}T${assignment.dueTime}:00`
    : `${assignment.dueDate}T23:59:00`;
  return {
    summary: `[${assignment.courseName}] ${assignment.title}`,
    description: `${assignment.type.toUpperCase()}${
      assignment.weightPercent != null ? ` — Weight: ${assignment.weightPercent}%` : ''
    }`,
    start: { dateTime },
    end: { dateTime },
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

async function ensureSyllabaCalendar(accessToken: string, calendarId: string | null): Promise<string> {
  if (calendarId) return calendarId;

  const res = await fetch(`${CALENDAR_BASE}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Syllaba' })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create Syllaba calendar');
  }

  const auth = getGoogleCalendarAuth();
  if (auth) {
    saveGoogleCalendarAuth({ ...auth, calendarId: data.id });
  }
  return data.id;
}

export async function syncAssignments(assignments: Assignment[]): Promise<SyncResult> {
  const { accessToken, calendarId: cachedCalendarId } = await getValidAccessToken();
  const calendarId = await ensureSyllabaCalendar(accessToken, cachedCalendarId);

  const auth = getGoogleCalendarAuth();
  if (!auth) {
    throw new Error('Google Calendar is not connected');
  }

  const plan = computeSyncPlan(assignments, auth.events);
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, failed: 0 };
  const events = { ...auth.events };

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  for (const assignment of plan.toCreate) {
    try {
      const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(toEventBody(assignment))
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Create failed');
      events[assignment.id] = { googleEventId: data.id, signature: buildSignature(assignment) };
      result.created += 1;
    } catch {
      result.failed += 1;
    }
  }

  for (const { assignment, googleEventId } of plan.toUpdate) {
    try {
      const res = await fetch(`${CALENDAR_BASE}/calendars/${calendarId}/events/${googleEventId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(toEventBody(assignment))
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Update failed');
      }
      events[assignment.id] = { googleEventId, signature: buildSignature(assignment) };
      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  for (const googleEventId of plan.toDelete) {
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
      result.deleted += 1;
    } catch {
      result.failed += 1;
    }
  }

  saveGoogleCalendarAuth({ ...auth, calendarId, events });
  return result;
}

export function disconnectGoogleCalendar(): void {
  clearGoogleCalendarAuth();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/googleCalendarApi.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests across all four test files passing (Tasks 1–5 combined).

- [ ] **Step 6: Commit**

```bash
git add src/utils/googleCalendarApi.ts src/utils/googleCalendarApi.test.ts
git commit -m "feat: add Google Calendar sync orchestration (create/update/delete events)"
```

---

### Task 6: Wire up the UI (connect, sync, disconnect, OAuth redirect)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CalendarSyncModal.tsx`

**Interfaces:**
- Consumes: `getGoogleAuthUrl`, `exchangeCodeForTokens` (Task 4); `syncAssignments`, `disconnectGoogleCalendar` (Task 5); `getGoogleCalendarAuth` (Task 2).
- Produces: nothing consumed by other tasks — this is the final integration point.

No unit test for this task — it's OAuth-redirect + real-network UI wiring that can't be meaningfully tested without live Google credentials. Verify manually per Step 5 below (this matches the spec's "Testing" section, which calls out this exact manual flow).

- [ ] **Step 1: Add OAuth redirect capture to `src/App.tsx`**

Add to the imports at the top of `src/App.tsx:1-18`:

```tsx
import { exchangeCodeForTokens } from './utils/googleAuth';
import { getGoogleCalendarAuth, saveGoogleCalendarAuth } from './utils/storage';
```

(`getGoogleCalendarAuth` here is only used to check connection state for opening the modal pre-connected; if unused after Step 2 below, skip importing it — Step 2 does use it.)

Add new state right after the existing `isSyncModalOpen` state (`src/App.tsx:37`):

```tsx
  const [googleOAuthError, setGoogleOAuthError] = useState<string | null>(null);
```

Add a new `useEffect` right after the existing data-loading `useEffect` (`src/App.tsx:40-50`), to run once on mount:

```tsx
  // Handle Google OAuth redirect back to the app (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const redirectUri = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', redirectUri);
    setIsSyncModalOpen(true);

    exchangeCodeForTokens(code, redirectUri)
      .then(({ accessToken, refreshToken, expiresAt }) => {
        saveGoogleCalendarAuth({ accessToken, refreshToken, expiresAt, calendarId: null, events: {} });
      })
      .catch((err) => {
        setGoogleOAuthError(err instanceof Error ? err.message : 'Failed to connect Google Calendar');
      });
  }, []);
```

Pass the error down to the modal — modify the modal render block (`src/App.tsx:200-205`):

```tsx
      {isSyncModalOpen && (
        <CalendarSyncModal
          assignments={assignments}
          onClose={() => {
            setIsSyncModalOpen(false);
            setGoogleOAuthError(null);
          }}
          oauthError={googleOAuthError}
        />
      )}
```

- [ ] **Step 2: Rewrite `src/components/CalendarSyncModal.tsx`**

Replace the full file contents:

```tsx
import React, { useState, useEffect } from 'react';
import { Assignment } from '../types';
import { downloadICSFile } from '../utils/calendarExport';
import { getGoogleAuthUrl } from '../utils/googleAuth';
import { syncAssignments, disconnectGoogleCalendar, SyncResult } from '../utils/googleCalendarApi';
import { getGoogleCalendarAuth } from '../utils/storage';
import {
  X,
  Download,
  Calendar,
  Mail,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Unlink
} from 'lucide-react';

interface CalendarSyncModalProps {
  assignments: Assignment[];
  onClose: () => void;
  oauthError?: string | null;
}

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({
  assignments,
  onClose,
  oauthError
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [savedEmailMsg, setSavedEmailMsg] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setIsConnected(getGoogleCalendarAuth() !== null);
  }, [oauthError]);

  const handleDownloadICS = () => {
    downloadICSFile(assignments, 'Syllaba_Master_Schedule.ics');
  };

  const handleCopyFeedLink = () => {
    navigator.clipboard.writeText('webcal://syllaba.app/feed/user-demo-calendar.ics');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveEmailDigest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) return;
    setSavedEmailMsg(true);
    setTimeout(() => setSavedEmailMsg(false), 3000);
  };

  const handleConnectGoogle = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = getGoogleAuthUrl(redirectUri);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncAssignments(assignments);
      setSyncResult(result);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleCalendar();
    setIsConnected(false);
    setSyncResult(null);
    setSyncError(null);
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
              <h2 className="font-display text-lg font-extrabold text-caplen-navy">Calendar Sync & Export</h2>
              <p className="text-xs text-caplen-muted">
                Sync {assignments.length} assignments with Google Calendar, Apple Calendar, or Outlook.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4">

          {/* Google Calendar Connect/Sync */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-caplen-navy" />
              <span>Google Calendar Auto-Sync</span>
            </h4>
            <p className="text-xs text-caplen-muted mb-3">
              {isConnected
                ? 'Connected. Events sync into a dedicated "Syllaba" calendar in your account.'
                : 'Connect your Google account to auto-create events in a dedicated "Syllaba" calendar.'}
            </p>

            {oauthError && (
              <p className="text-xs text-red-600 font-semibold mb-2">{oauthError}</p>
            )}

            {!isConnected ? (
              <button
                onClick={handleConnectGoogle}
                className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all"
              >
                <span>Connect Google Calendar</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync now'}</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}

            {syncResult && (
              <p className="text-xs text-emerald-700 font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Synced — {syncResult.created} created, {syncResult.updated} updated, {syncResult.deleted} removed
                  {syncResult.failed > 0 ? `, ${syncResult.failed} failed (try again)` : ''}.
                </span>
              </p>
            )}
            {syncError && (
              <p className="text-xs text-red-600 font-semibold mt-2">{syncError}</p>
            )}
          </div>

          {/* Download .ICS */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2">
                  <Download className="h-4 w-4 text-caplen-navy" />
                  <span>Download iCalendar (.ics) File</span>
                </h4>
                <p className="text-xs text-caplen-muted mt-1">
                  Standard format for Apple iCal, Google Calendar, and Outlook.
                </p>
              </div>
              <button
                onClick={handleDownloadICS}
                className="flex items-center gap-1.5 rounded-full bg-caplen-navy px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all shrink-0"
              >
                <span>Download .ics</span>
              </button>
            </div>
          </div>

          {/* Subscription URL */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 mb-1">
              <ExternalLink className="h-4 w-4 text-caplen-navy" />
              <span>Live Subscription Feed URL</span>
            </h4>
            <p className="text-xs text-caplen-muted mb-3">
              Subscribe once to auto-sync calendar updates.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value="webcal://syllaba.app/feed/user-demo-calendar.ics"
                className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-mono text-slate-600 focus:outline-none"
              />
              <button
                onClick={handleCopyFeedLink}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-caplen-navy border border-slate-200 hover:bg-slate-50 transition-all shrink-0 shadow-sm"
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

          {/* Email Digest */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-sm font-bold text-caplen-navy flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-caplen-navy" />
              <span>Daily Email Reminders</span>
            </h4>
            <p className="text-xs text-caplen-muted mb-3">
              Get morning email notifications for tasks due in 48 hours.
            </p>

            <form onSubmit={handleSaveEmailDigest} className="flex items-center gap-2">
              <input
                type="email"
                placeholder="student@university.edu"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-caplen-navy placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shrink-0 shadow-sm"
              >
                Enable
              </button>
            </form>

            {savedEmailMsg && (
              <p className="text-xs text-emerald-700 font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Daily email digest preference saved!</span>
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 text-[11px] font-bold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>100% Free & Private — No login required</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: builds clean, no TypeScript errors (in particular, confirm `SyncResult` is exported from `googleCalendarApi.ts` — it is, from Task 5 Step 3).

- [ ] **Step 4: Run full test suite once more**

Run: `npm test`
Expected: PASS — no regressions from the UI changes (UI itself is untested per this task's note, but Tasks 1–5's tests must still all pass).

- [ ] **Step 5: Manual end-to-end verification**

Prerequisites: a Google Cloud project with the Calendar API enabled, an OAuth 2.0 Web Client with redirect URI `http://localhost:5173` (or whatever `netlify dev` serves) registered, `.env` populated from `.env.example`, and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set for local Netlify dev (`netlify env:set` or a `.env` picked up by `netlify dev`).

Run: `netlify dev`

1. Open the app, click the sidebar's calendar-sync entry point to open `CalendarSyncModal`.
2. Click "Connect Google Calendar" → approve consent screen → confirm redirect lands back on the app with the modal open and "Connected" state shown (no `?code=` left in the URL bar).
3. Click "Sync now" → confirm a calendar literally named "Syllaba" appears in the connected Google account (not the primary calendar), with events matching current assignments.
4. Edit an assignment's due date in the app, click "Sync now" again → confirm the existing event's time updates in Google Calendar rather than a duplicate being created.
5. Delete an assignment in the app, click "Sync now" → confirm its event is removed from the Syllaba calendar.
6. Click "Disconnect" → confirm the modal reverts to the "Connect Google Calendar" button state and `localStorage.getItem('syllaba_google_calendar_v1')` is `null` in devtools.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/CalendarSyncModal.tsx
git commit -m "feat: wire up Google Calendar connect/sync/disconnect UI"
```
