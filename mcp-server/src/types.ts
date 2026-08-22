// Mirrors the shapes in ../../src/types/index.ts. Duplicated rather than
// imported because this is a standalone package with its own tsconfig/build
// (it has to run as a plain `node dist/index.js` launched by an MCP client,
// not bundled with the Vite app) — only the fields this server actually
// reads are included.

export type AssignmentType = 'homework' | 'exam' | 'project' | 'reading' | 'quiz' | 'other';

export interface Assignment {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  dueDate: string; // YYYY-MM-DD, or '' when unknown
  dueTime: string | null;
  type: AssignmentType;
  weightPercent: number | null;
  completed: boolean;
  score?: number | null;
}

export interface ClassSchedule {
  section: string | null;
  days: number[]; // 0=Sunday..6=Saturday
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  startsOn: string | null;
  until: string | null;
}

export interface CoursePolicies {
  gradingBreakdown: string | null;
  lateWork: string | null;
  contacts: string | null;
  aiPolicy: string | null;
  keyDates: string | null;
  classMeetings: string | null;
  topics: string | null;
  equipment: string | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  instructor?: string;
  semester?: string;
  policies?: CoursePolicies;
  classSchedule?: ClassSchedule | null;
}

export interface SyllabaData {
  courses: Course[];
  assignments: Assignment[];
}
