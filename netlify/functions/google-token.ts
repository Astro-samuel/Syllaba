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
