const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_FUNCTION_URL = '/.netlify/functions/google-token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

export function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || localStorage.getItem('syllaba_google_client_id') || '';
}

export function saveGoogleClientId(clientId: string): void {
  localStorage.setItem('syllaba_google_client_id', clientId.trim());
}

export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Missing Google OAuth Client ID. Please enter your Google Client ID or use the 1-click .ics Calendar Export.');
  }

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
