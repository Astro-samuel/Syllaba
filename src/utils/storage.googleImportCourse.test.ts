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
