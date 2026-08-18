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
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar');
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
