export type AssignmentType = 'homework' | 'exam' | 'project' | 'reading' | 'quiz' | 'other';

export interface Assignment {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string | null; // HH:mm format or null
  type: AssignmentType;
  weightPercent: number | null;
  completed: boolean;
  score?: number | null; // Earned grade % (e.g., 95)
  notes?: string;
  color: string; // Course theme color hex or tailwind class
}

export interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  instructor?: string;
  semester?: string;
  syllabusText?: string;
  createdAt: string;
}

export interface ExtractedAssignment {
  title: string;
  dueDate: string;
  dueTime: string | null;
  type: AssignmentType;
  weightPercent: number | null;
}

export interface ExtractionResult {
  courseName: string;
  courseCode: string;
  instructor: string;
  semester: string;
  assignments: ExtractedAssignment[];
}

export interface StreakState {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  activeDates: string[];
}

export interface FilterState {
  courseId: string; // 'all' or specific id
  type: AssignmentType | 'all';
  searchQuery: string;
  timeframe: 'all' | 'overdue' | 'today' | 'week' | 'month';
  hideCompleted: boolean;
}

export type TabType = 'timeline' | 'calendar' | 'upload' | 'calculator' | 'courses';

export interface PresetSyllabus {
  id: string;
  title: string;
  code: string;
  instructor: string;
  description: string;
  color: string;
  rawText: string;
}

export interface SyncedEventRecord {
  googleEventId: string;
  signature: string;
  remoteUpdated?: string | null; // last-seen Google 'updated' RFC3339 timestamp; undefined/null = never pulled
}

export interface GoogleCalendarAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  calendarId: string | null;
  calendarSummary?: string | null; // display name of the picked calendar
  events: Record<string, SyncedEventRecord>; // assignmentId -> record
}
