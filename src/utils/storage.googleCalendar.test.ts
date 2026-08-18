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
