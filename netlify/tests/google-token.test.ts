import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../functions/google-token';

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
