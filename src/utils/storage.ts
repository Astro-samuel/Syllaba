import { Course, Assignment, StreakState, GoogleCalendarAuth } from '../types';
import { PRESET_SYLLABI, parseSyllabusText } from './aiParser';
import { format, isSameDay, differenceInDays, parseISO, startOfDay } from 'date-fns';

const COURSES_KEY = 'syllaba_courses_v1';
const ASSIGNMENTS_KEY = 'syllaba_assignments_v1';
const STREAK_KEY = 'syllaba_streak_v1';
const GOOGLE_CALENDAR_KEY = 'syllaba_google_calendar_v1';
export const GOOGLE_IMPORT_COURSE_ID = 'c_google_import';

export function getStoredCourses(): Course[] {
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    if (!raw) {
      // Seed default course if empty
      const defaultCourse: Course = {
        id: 'c_cs101',
        name: 'Intro to Computer Science',
        code: 'CS 101',
        color: '#8b5cf6',
        instructor: 'Dr. Sarah Lin',
        semester: 'Fall 2026',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(COURSES_KEY, JSON.stringify([defaultCourse]));
      return [defaultCourse];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load courses from localStorage', e);
    return [];
  }
}

export function saveCourses(courses: Course[]): void {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export async function getStoredAssignments(): Promise<Assignment[]> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (!raw) {
      // Seed default assignments from CS 101 preset
      const parsedPreset = await parseSyllabusText(PRESET_SYLLABI[0].rawText);
      const defaultAssignments: Assignment[] = parsedPreset.assignments.map((a, idx) => ({
        id: `a_cs101_${idx}`,
        courseId: 'c_cs101',
        courseName: 'CS 101',
        title: a.title,
        dueDate: a.dueDate,
        dueTime: a.dueTime,
        type: a.type,
        weightPercent: a.weightPercent,
        completed: idx === 0, // First task checked off for streak demo!
        color: '#8b5cf6'
      }));
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(defaultAssignments));
      return defaultAssignments;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load assignments from localStorage', e);
    return [];
  }
}

export function saveAssignments(assignments: Assignment[]): void {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

export function getStoredStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (!raw) {
      const initial: StreakState = {
        currentStreak: 3,
        bestStreak: 7,
        lastActiveDate: todayStr,
        activeDates: [todayStr]
      };
      localStorage.setItem(STREAK_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return { currentStreak: 1, bestStreak: 1, lastActiveDate: todayStr, activeDates: [todayStr] };
  }
}

export function recordStreakActivity(): StreakState {
  const current = getStoredStreak();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  if (current.lastActiveDate === todayStr) {
    return current; // Already recorded activity today
  }

  const lastDateObj = startOfDay(parseISO(current.lastActiveDate));
  const todayObj = startOfDay(new Date());
  const diffDays = differenceInDays(todayObj, lastDateObj);

  let newStreak = current.currentStreak;
  if (diffDays === 1) {
    newStreak += 1;
  } else if (diffDays > 1) {
    newStreak = 1;
  }

  const newBest = Math.max(newStreak, current.bestStreak);
  const updatedActiveDates = Array.from(new Set([...current.activeDates, todayStr]));

  const updated: StreakState = {
    currentStreak: newStreak,
    bestStreak: newBest,
    lastActiveDate: todayStr,
    activeDates: updatedActiveDates
  };

  localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  return updated;
}

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

export function getOrCreateGoogleImportCourse(): Course {
  const courses = getStoredCourses();
  const existing = courses.find((c) => c.id === GOOGLE_IMPORT_COURSE_ID);
  if (existing) return existing;

  const importCourse: Course = {
    id: GOOGLE_IMPORT_COURSE_ID,
    name: 'Imported from Google Calendar',
    code: 'GCAL',
    color: '#4285F4',
    createdAt: new Date().toISOString()
  };
  saveCourses([...courses, importCourse]);
  return importCourse;
}
