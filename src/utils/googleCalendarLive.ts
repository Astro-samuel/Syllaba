export interface UserGoogleProfile {
  name: string;
  email: string;
  picture?: string;
  accessToken: string;
  expiresAt: number;
}

const GOOGLE_AUTH_STORAGE_KEY = 'syllaba_user_google_profile';

/**
 * Get stored Google User Profile
 */
export function getStoredGoogleUser(): UserGoogleProfile | null {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save Google User Profile
 */
export function saveGoogleUser(user: UserGoogleProfile): void {
  localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Log out Google User
 */
export function logoutGoogleUser(): void {
  localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
}

/**
 * Fetch the signed-in Google account's identity (email + display name) using
 * the primary calendar endpoint, which is covered by the existing calendar
 * scope so no extra OAuth consent screen is needed.
 */
export async function fetchGoogleAccountProfile(
  accessToken: string
): Promise<{ email: string; name: string }> {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch Google account profile');
  }
  const data = await response.json();
  const email: string = data.id;
  const name: string =
    data.summary && data.summary !== email ? data.summary : email.split('@')[0].replace(/\./g, ' ');
  return { email, name };
}
