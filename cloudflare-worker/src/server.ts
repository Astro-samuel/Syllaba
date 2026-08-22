// Tool definitions mirror ../../mcp-server/src/server.ts exactly (same 5
// tools, same behavior) — duplicated rather than shared because the two
// run in different runtimes (Node local process vs. Cloudflare Workers) and
// get their data differently (a local file vs. KV). The one structural
// difference: tools here take a `getData` callback instead of importing a
// file-reading function directly, so this file has no runtime dependency on
// how the data was fetched.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Assignment, Course, SyllabaData } from './types.js';

const NO_DATA_MESSAGE =
  'No Syllaba data found for this key. Open the Syllaba desktop app at least once with cloud sync configured — it pushes your courses and assignments automatically whenever something changes.';

export function createSyllabaMcpServer(getData: () => Promise<SyllabaData | null>): McpServer {
  const server = new McpServer({ name: 'syllaba', version: '1.0.0' });
  registerTools(server, getData);
  return server;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function findCourse(courses: Course[], courseCode: string): Course | undefined {
  const needle = courseCode.trim().toLowerCase();
  return courses.find((c) => c.code.toLowerCase() === needle || c.name.toLowerCase().includes(needle));
}

// Mirrors the math in src/components/GradeCalculator.tsx exactly, so a
// grade reported here matches what the app itself shows.
function summarizeGrade(course: Course, assignments: Assignment[]) {
  const courseItems = assignments.filter((a) => a.courseId === course.id);

  let totalGradedWeight = 0;
  let totalEarnedPoints = 0;
  let remainingWeight = 0;

  for (const a of courseItems) {
    const weight = a.weightPercent || 0;
    if (a.score !== undefined && a.score !== null && !Number.isNaN(a.score)) {
      totalGradedWeight += weight;
      totalEarnedPoints += (a.score * weight) / 100;
    } else {
      remainingWeight += weight;
    }
  }

  const hasAnyGrade = totalGradedWeight > 0;
  const currentPercentage = hasAnyGrade ? (totalEarnedPoints / totalGradedWeight) * 100 : null;

  return {
    course: course.code,
    currentPercentage: currentPercentage !== null ? Math.round(currentPercentage * 10) / 10 : null,
    gradedWeightSoFar: totalGradedWeight,
    remainingWeight,
    totalWeightTracked: totalGradedWeight + remainingWeight
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function registerTools(server: McpServer, getData: () => Promise<SyllabaData | null>): void {
  server.registerTool(
    'list_courses',
    {
      title: 'List courses',
      description: "List all of the student's courses currently tracked in Syllaba, with instructor and semester.",
      inputSchema: {}
    },
    async () => {
      const data = await getData();
      if (!data) return textResult(NO_DATA_MESSAGE);
      if (data.courses.length === 0) return textResult('No courses in Syllaba yet.');
      return jsonResult(
        data.courses.map((c) => ({
          code: c.code,
          name: c.name,
          instructor: c.instructor || null,
          semester: c.semester || null
        }))
      );
    }
  );

  const ASSIGNMENT_STATUS = z.enum(['all', 'upcoming', 'overdue', 'completed']);

  server.registerTool(
    'list_assignments',
    {
      title: 'List assignments',
      description:
        'List assignments/exams/tasks, optionally filtered by course, status (upcoming/overdue/completed), or type (homework/exam/project/reading/quiz/other).',
      inputSchema: {
        courseCode: z.string().optional().describe("A course code or name substring, e.g. 'APSC 179'. Omit to list across all courses."),
        status: ASSIGNMENT_STATUS.optional().default('all'),
        type: z.enum(['homework', 'exam', 'project', 'reading', 'quiz', 'other']).optional()
      }
    },
    async ({ courseCode, status, type }) => {
      const data = await getData();
      if (!data) return textResult(NO_DATA_MESSAGE);

      let items: Assignment[] = data.assignments;

      if (courseCode) {
        const course = findCourse(data.courses, courseCode);
        if (!course) return textResult(`No course matching "${courseCode}" found.`);
        items = items.filter((a) => a.courseId === course.id);
      }

      if (type) {
        items = items.filter((a) => a.type === type);
      }

      const today = new Date().toISOString().split('T')[0];
      if (status === 'completed') {
        items = items.filter((a) => a.completed);
      } else if (status === 'upcoming') {
        items = items.filter((a) => !a.completed && a.dueDate && a.dueDate >= today);
      } else if (status === 'overdue') {
        items = items.filter((a) => !a.completed && a.dueDate && a.dueDate < today);
      }

      items = [...items].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

      if (items.length === 0) return textResult('No matching assignments.');
      return jsonResult(
        items.map((a) => ({
          title: a.title,
          course: a.courseName,
          dueDate: a.dueDate || 'TBD',
          dueTime: a.dueTime,
          type: a.type,
          weightPercent: a.weightPercent,
          completed: a.completed,
          score: a.score ?? null
        }))
      );
    }
  );

  server.registerTool(
    'get_upcoming_deadlines',
    {
      title: 'Get upcoming deadlines',
      description: 'List not-yet-completed assignments/exams due within the next N days across all courses, soonest first.',
      inputSchema: {
        days: z.number().int().positive().max(365).optional().default(14).describe('How many days ahead to look. Defaults to 14.')
      }
    },
    async ({ days }) => {
      const data = await getData();
      if (!data) return textResult(NO_DATA_MESSAGE);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() + days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const upcoming = data.assignments
        .filter((a) => !a.completed && a.dueDate && a.dueDate >= todayStr && a.dueDate <= cutoffStr)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      if (upcoming.length === 0) return textResult(`No deadlines in the next ${days} day(s).`);
      return jsonResult(
        upcoming.map((a) => ({
          title: a.title,
          course: a.courseName,
          dueDate: a.dueDate,
          dueTime: a.dueTime,
          type: a.type,
          weightPercent: a.weightPercent
        }))
      );
    }
  );

  server.registerTool(
    'get_course_policies',
    {
      title: 'Get course policies',
      description:
        "Get one course's grading breakdown, late-work policy, contacts/office-hours, AI policy, topics/schedule, equipment, and recurring class meeting time — everything extracted from its syllabus.",
      inputSchema: {
        courseCode: z.string().describe("A course code or name substring, e.g. 'APSC 179'.")
      }
    },
    async ({ courseCode }) => {
      const data = await getData();
      if (!data) return textResult(NO_DATA_MESSAGE);

      const course = findCourse(data.courses, courseCode);
      if (!course) return textResult(`No course matching "${courseCode}" found.`);

      const p = course.policies;
      const schedule = course.classSchedule;

      return jsonResult({
        course: { code: course.code, name: course.name, instructor: course.instructor || null, semester: course.semester || null },
        gradingBreakdown: p?.gradingBreakdown ?? null,
        lateWork: p?.lateWork ?? null,
        contacts: p?.contacts ?? null,
        aiPolicy: p?.aiPolicy ?? null,
        topics: p?.topics ?? null,
        equipment: p?.equipment ?? null,
        classSchedule: schedule
          ? {
              days: schedule.days.map((d) => DAY_NAMES[d]),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              location: schedule.location,
              startsOn: schedule.startsOn,
              until: schedule.until
            }
          : null
      });
    }
  );

  server.registerTool(
    'get_grade_summary',
    {
      title: 'Get grade summary',
      description:
        "Get the student's current weighted grade for one course (or all courses), computed from entered scores and each item's weight — same math as the in-app Grade Calculator.",
      inputSchema: {
        courseCode: z.string().optional().describe('Omit to get a summary for every course.')
      }
    },
    async ({ courseCode }) => {
      const data = await getData();
      if (!data) return textResult(NO_DATA_MESSAGE);

      if (courseCode) {
        const course = findCourse(data.courses, courseCode);
        if (!course) return textResult(`No course matching "${courseCode}" found.`);
        return jsonResult(summarizeGrade(course, data.assignments));
      }

      if (data.courses.length === 0) return textResult('No courses in Syllaba yet.');
      return jsonResult(data.courses.map((c) => summarizeGrade(c, data.assignments)));
    }
  );
}
