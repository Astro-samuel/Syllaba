import { ExtractionResult, ExtractedAssignment, AssignmentType, PresetSyllabus, CoursePolicies } from '../types';
import { addDays, format } from 'date-fns';

// Generate dynamic fresh dates relative to current day
const today = new Date();
const formatDate = (daysFromNow: number) => format(addDays(today, daysFromNow), 'yyyy-MM-dd');

export const PRESET_SYLLABI: PresetSyllabus[] = [
  {
    id: 'engr210',
    title: 'ENGR 210: Circuit Analysis (From Downloads)',
    code: 'ENGR 210',
    instructor: 'Dr. A. Reyes',
    color: '#8B5CF6',
    description: 'DC & AC circuit analysis, Kirchhoff laws, Op-Amps, transient response & final project.',
    rawText: `ENGR 210: Introduction to Circuit Analysis
Fall 2026 Term 1
Instructor: Dr. A. Reyes
Meeting Times: Mon/Wed/Fri 10:00–10:50 AM, Room ASC 140
Lab: Thursdays 2:00–4:50 PM, Room EME 1202

COURSE DESCRIPTION
This course introduces fundamental concepts of DC and AC circuit analysis, including
Kirchhoff's laws, Thevenin/Norton equivalents, first-order transient response, and
phasor analysis. Weekly labs reinforce theory with hands-on breadboard circuits.

GRADING BREAKDOWN
Homework Assignments (6 total): 15%
Lab Reports (10 total): 20%
Midterm Exam 1: 15%
Midterm Exam 2: 15%
Final Project: 15%
Final Exam: 20%

SCHEDULE OF ASSIGNMENTS AND EXAMS

Week 2 — September 14
Homework 1 due: Kirchhoff's Voltage and Current Laws
(Covers Ch. 2, problems 2.1–2.14)

Week 3 — September 21
Lab Report 1 due: Breadboard Basics and Ohm's Law Verification

Week 4 — September 28
Homework 2 due: Node-Voltage and Mesh-Current Analysis

Week 5 — October 5
Lab Report 2 due: Series-Parallel Resistor Networks

Week 6 — October 12
MIDTERM EXAM 1 (in-class, covers Weeks 1–5)
Homework 3 due: Thevenin and Norton Equivalent Circuits

Week 7 — October 19
Lab Report 3 due: Thevenin Equivalent Measurement

Week 8 — October 26
Homework 4 due: Operational Amplifier Circuits

Week 9 — November 2
Lab Report 4 due: Op-Amp Configurations
Final Project Proposal due (1-page description, groups of 2-3)

Week 10 — November 9
MIDTERM EXAM 2 (in-class, covers Weeks 6–9)

Week 11 — November 16
Homework 5 due: RC and RL Transient Response
Lab Report 5 due: Capacitor Charging/Discharging

Week 12 — November 23
Homework 6 due: AC Steady-State and Phasor Analysis
Lab Report 6 due: RC Filter Frequency Response

Week 13 — November 30
Final Project due (report + 10-minute in-class presentation)

FINAL EXAM PERIOD
Final Exam: Comprehensive, date TBD by registrar (typically first week of December)

LATE POLICY
Homework and lab reports lose 10% per day late, up to 3 days, after which a grade
of zero is assigned. Extensions require instructor approval at least 48 hours
before the deadline.

OFFICE HOURS
Tuesdays 1:00–3:00 PM, Room EME 4215, or by appointment.`
  },
  {
    id: 'cs101',
    title: 'Intro to Computer Science & Python',
    code: 'CS 101',
    instructor: 'Dr. Sarah Lin',
    color: '#06B6D4',
    description: 'Foundations of programming, algorithms, and data structures.',
    rawText: `CS 101: Introduction to Computer Science
Instructor: Dr. Sarah Lin (slin@university.edu)
Fall 2026 Semester

Evaluation & Grading Scheme:
- Problem Sets (4): 20% total (5% each)
- Midterm Exam 1: 20%
- Midterm Exam 2: 20%
- Final Capstone Project: 15%
- Final Exam: 25%

SCHEDULE OF ASSIGNMENTS AND EXAMS:

1. Problem Set 1: Python Basics & Loops
   Due Date: ${formatDate(3)} at 11:59 PM
   Weight: 5%
   Type: Homework

2. Problem Set 2: Data Structures & Recursion
   Due Date: ${formatDate(10)} at 11:59 PM
   Weight: 5%
   Type: Homework

3. Midterm Exam 1 (In-Class)
   Date: ${formatDate(18)} at 10:00 AM
   Weight: 20%
   Type: Exam

4. Problem Set 3: Object-Oriented Design
   Due Date: ${formatDate(25)} at 11:59 PM
   Weight: 5%
   Type: Homework

5. Midterm Exam 2
   Date: ${formatDate(35)} at 10:00 AM
   Weight: 20%
   Type: Exam

6. Final Capstone Project Proposal & Code Submission
   Due Date: ${formatDate(45)} at 11:59 PM
   Weight: 15%
   Type: Project

7. Cumulative Final Exam
   Date: ${formatDate(55)} at 09:00 AM
   Weight: 25%
   Type: Exam`
  },
  {
    id: 'econ201',
    title: 'Principles of Macroeconomics',
    code: 'ECON 201',
    instructor: 'Prof. Marcus Vance',
    color: '#F59E0B',
    description: 'Fiscal policies, inflation, global trade, and monetary systems.',
    rawText: `ECON 201: Principles of Macroeconomics
Instructor: Prof. Marcus Vance
Semester Schedule & Syllabus

Course Components:
- Weekly Quizzes (10% total)
- Problem Sets (20%)
- Case Study Presentation (20%)
- Midterm Exam (25%)
- Final Exam (25%)

Key Deadlines:
- Quiz 1: GDP & Inflation Metrics — Due ${formatDate(-2)} (Overdue)
- Problem Set 1: Supply, Demand & Market Equilibrium — Due ${formatDate(5)} at 11:59 PM (Weight 10%)
- Problem Set 2: Monetary Policy & Federal Reserve — Due ${formatDate(14)} at 11:59 PM (Weight 10%)
- Midterm Examination — Date: ${formatDate(21)} at 2:00 PM (Weight 25%)
- Group Case Study Presentation — Due: ${formatDate(32)} at 11:59 PM (Weight 20%)
- Final Comprehensive Exam — Date: ${formatDate(50)} at 1:00 PM (Weight 25%)`
  },
  {
    id: 'math240',
    title: 'Linear Algebra & Differential Equations',
    code: 'MATH 240',
    instructor: 'Prof. David Chen',
    color: '#84CC16',
    description: 'Vector spaces, matrices, eigenvalues, and linear differential systems.',
    rawText: `MATH 240: Linear Algebra
Prof. David Chen

Course Schedule & Breakdown:
- Homework 1: Vector Spaces & Matrices — Due ${formatDate(2)} at 5:00 PM (Weight 10%)
- Quiz 1: Matrix Inverses & Determinants — Due ${formatDate(8)} at 5:00 PM (Weight 10%)
- Homework 2: Eigenvalues & Eigenvectors — Due ${formatDate(16)} at 5:00 PM (Weight 10%)
- Midterm Exam — Date ${formatDate(26)} at 9:00 AM (Weight 30%)
- Final Project: Computational Linear Systems — Due ${formatDate(40)} at 11:59 PM (Weight 15%)
- Final Examination — Date ${formatDate(52)} at 8:00 AM (Weight 25%)`
  }
];

export async function parseSyllabusText(
  rawText: string,
  apiKey?: string
): Promise<ExtractionResult> {
  if (apiKey && apiKey.trim().length > 10) {
    try {
      return await parseWithExternalLLM(rawText, apiKey);
    } catch (err) {
      console.warn('External LLM parsing failed, falling back to smart local parser:', err);
    }
  }

  await new Promise((res) => setTimeout(res, 350));

  return parseWithLocalNLP(rawText);
}

// Headings that mark the start of one of the policy/info categories we pull
// out of a syllabus, plus other common syllabus headings that only matter as
// stop boundaries (so e.g. a grading-breakdown block doesn't run on and
// swallow the late-policy section right after it).
const POLICY_SECTION_STARTS: Record<keyof CoursePolicies, RegExp> = {
  gradingBreakdown: /(?:grading breakdown|assessment and grading|evaluation\s*&?\s*grading|grading scheme|course grades)/i,
  lateWork: /(?:late (?:policy|work|submissions?)|oops tokens?|attendance(?: policy)?|makeup policy)/i,
  contacts: /(?:office hours|drop-in(?:\s*\(office\))? hours|markers?\b|getting help|contact(?:s|\sinformation)?)/i,
  aiPolicy: /(?:generative ai|artificial intelligence tools|academic integrity|academic misconduct)/i,
  keyDates: /(?:key dates|important dates)/i,
  classMeetings: /(?:class meetings|meeting times)/i,
  // Anchored to a whole line so a sentence that merely mentions "topics" in
  // passing doesn't get mistaken for the "Topics" heading itself.
  topics: /^topics\s*$|schedule of topics|weekly schedule|week-by-week topics/im
};

// Deliberately excludes ambiguous single words like "assignments" — a
// grading-table row ("Assignments (marked on attempt): 5%") starts with
// that word too, which would truncate the grading-breakdown capture after
// one line. Only headings unlikely to appear as the start of an unrelated
// sentence or table row are listed here.
const OTHER_KNOWN_HEADINGS =
  /(?:welcome|quick facts|how this course works|course description|learning outcomes|class time|what a normal week|schedule of assignments|key deadlines|supplemental learning|weekly announcements|if something|telling me|engineering accreditation|academic concessions|intellectual property|final examination|grading practices|disability resource|equity and inclusion|student learning hub|health\s*&?\s*wellness|global engagement|resource links|safewalk)/im;

/**
 * Pulls a free-text block out of the syllabus starting at the first heading
 * matching `startPattern`, running until the next heading from any policy
 * category or `OTHER_KNOWN_HEADINGS`, whichever comes first. Returns null
 * (never an empty/fabricated string) when the syllabus has no such section.
 */
function extractSection(text: string, startPattern: RegExp, excludeSelf: RegExp): string | null {
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index === undefined) return null;

  const startIdx = startMatch.index;
  const rest = text.slice(startIdx + startMatch[0].length);

  const stopPatterns = [
    ...Object.values(POLICY_SECTION_STARTS).filter((re) => re !== excludeSelf),
    OTHER_KNOWN_HEADINGS
  ];

  let stopIdx = rest.length;
  for (const stopPattern of stopPatterns) {
    const flags = stopPattern.flags.includes('i') ? stopPattern.flags : stopPattern.flags + 'i';
    const m = rest.match(new RegExp(stopPattern.source, flags));
    if (m && m.index !== undefined && m.index < stopIdx) {
      stopIdx = m.index;
    }
  }

  const body = (startMatch[0] + rest.slice(0, stopIdx)).trim();
  return body.length > 3 ? body : null;
}

function extractCoursePolicies(text: string): CoursePolicies {
  const result = {} as CoursePolicies;
  for (const key of Object.keys(POLICY_SECTION_STARTS) as (keyof CoursePolicies)[]) {
    result[key] = extractSection(text, POLICY_SECTION_STARTS[key], POLICY_SECTION_STARTS[key]);
  }
  return result;
}

function parseWithLocalNLP(text: string): ExtractionResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let courseName = 'Uploaded Course';
  let courseCode = 'COURSE';
  let instructor = 'Instructor';
  let semester = 'Fall 2026';

  // 1. Course Code & Title Extraction
  const codeMatch = text.match(/\b([A-Z]{2,4}\s*\d{3}[A-Z]?)\b/i);
  if (codeMatch) {
    courseCode = codeMatch[1].toUpperCase();
  }

  const titleLine = lines.slice(0, 8).find(
    (l) => /^[A-Z0-9\s:–-]{5,65}$/i.test(l) && !/^instructor|^professor|^prof\.|^meeting|^lab:|^credit/i.test(l)
  );
  if (titleLine) {
    courseName = titleLine.replace(/^course[:\s]*/i, '').trim();
    if (courseName.includes(':')) {
      const parts = courseName.split(':');
      if (parts[1] && parts[1].trim().length > 3) {
        courseName = parts[1].trim();
      }
    }
  } else if (codeMatch) {
    courseName = `${courseCode} Course`;
  }

  // 2. Instructor & Semester (Stop at newline, meeting times, lab, office hours)
  // Capture group allows any non-newline character (not just a narrow
  // [A-Za-z0-9.\s-] set) so titles/degrees with commas, ampersands, or
  // colons after the label ("Instructor Jane Doe, Ph.D., P.Eng.") don't
  // silently fail the match and fall back to the literal "Instructor"
  // placeholder.
  const instructorMatch = text.match(/(?:instructor|professor|prof\.|dr\.)[\s:]*([A-Z][^\r\n]+?)(?=\r|\n|meeting|lab:|office|email|phone|$)/i);
  if (instructorMatch && instructorMatch[1].trim().length > 1) {
    // match[0] keeps a real title ("Dr. A. Reyes") but starts with the bare
    // "Instructor"/"Professor" label when there's no title in the name
    // itself ("Instructor Mehran Shirazi") — strip only that leading label.
    instructor = instructorMatch[0].replace(/^(?:instructor|professor)[\s:]*/i, '').trim();
  }

  const semesterMatch = text.match(/\b(fall|spring|summer|winter)\s*202[5-9]\b/i);
  if (semesterMatch) {
    semester = semesterMatch[0];
  }

  // 3. Extract Grading Breakdown Weights Dictionary
  const weightsDict: { [key: string]: number } = {};
  const breakdownMatch = text.match(/(?:GRADING BREAKDOWN|ASSESSMENT AND GRADING|EVALUATION|GRADING SCHEME|COURSE GRADES)[\s\S]*?(?=SCHEDULE|KEY DEADLINES|LATE POLICY|OFFICE HOURS|$)/i);
  if (breakdownMatch) {
    const bLines = breakdownMatch[0].split('\n');
    for (const bLine of bLines) {
      // "Label: NN%" (prose-style breakdown) or "Label   NN%   ..." (a
      // rendered table row, column-separated by whitespace with no colon —
      // pdf.js table extraction never inserts one).
      const itemMatch =
        bLine.match(/([A-Za-z0-9\s]+?)(?:\((\d+)\s*total\))?:\s*(\d+(?:\.\d+)?)%/i) ||
        bLine.match(/^([A-Za-z][A-Za-z0-9\s()]*?)(?:\((\d+)\s*total\))?\s{2,}(\d+(?:\.\d+)?)%/i);
      if (itemMatch) {
        // Strip any other parenthetical annotation ("(1 hour)", "(marked on
        // attempt)") so the key matches the plain category names looked up
        // below instead of staying keyed to prose that varies per syllabus.
        const key = itemMatch[1].replace(/\([^)]*\)/g, '').trim().toLowerCase();
        const count = itemMatch[2] ? parseInt(itemMatch[2], 10) : 1;
        const totalPct = parseFloat(itemMatch[3]);
        if (key) {
          weightsDict[key] = count > 1 ? parseFloat((totalPct / count).toFixed(1)) : totalPct;
        }
      }
    }
  }

  // 4. Extract Assignments with Multi-Format Date Support
  const assignments: ExtractedAssignment[] = [];
  let currentActiveDate: string | null = null;
  let inScheduleSection = true;
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const hasScheduleHeader = lines.some((l) => /schedule of assignments|key deadlines|important dates|course schedule|assignment schedule/i.test(l));
  if (hasScheduleHeader) {
    inScheduleSection = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/schedule of assignments|key deadlines|important dates|course schedule|assignment schedule/i.test(line)) {
      inScheduleSection = true;
      continue;
    }
    if (/late policy|office hours|course description|grading breakdown|evaluation & grading|required materials/i.test(line)) {
      inScheduleSection = false;
    }

    // Check for Section Date Headers
    const headerIsoMatch = line.match(/\b(202[5-9]-\d{2}-\d{2})\b/);
    const headerSlashMatch = line.match(/\b(\d{1,2})\/(\d{1,2})\/(202[5-9]|\d{2})\b/);
    const headerMonthMatch = line.match(/(?:week\s*\d+[-–—\s]*)?([a-z]{3,9})\s+(\d{1,2})/i);

    if (headerIsoMatch) {
      currentActiveDate = headerIsoMatch[1];
    } else if (headerSlashMatch) {
      const m = parseInt(headerSlashMatch[1], 10) - 1;
      const d = parseInt(headerSlashMatch[2], 10);
      const y = headerSlashMatch[3].length === 2 ? 2000 + parseInt(headerSlashMatch[3], 10) : parseInt(headerSlashMatch[3], 10);
      currentActiveDate = format(new Date(y, m, d), 'yyyy-MM-dd');
    } else if (headerMonthMatch) {
      const monthStr = headerMonthMatch[1].toLowerCase().substring(0, 3);
      const mIdx = monthNames.indexOf(monthStr);
      if (mIdx !== -1) {
        const dayNum = parseInt(headerMonthMatch[2], 10);
        currentActiveDate = format(new Date(2026, mIdx, dayNum), 'yyyy-MM-dd');
      }
    }
    // Deliberately no fallback here for "FINAL EXAM PERIOD" or similar section
    // headers with no real date — currentActiveDate stays whatever it already
    // was rather than being guessed, so a genuinely TBD item surfaces as TBD.

    if (!inScheduleSection) continue;

    const isAssignmentLine =
      /due|homework|lab report|midterm|final project|final exam|quiz|reading|proposal|problem set|pset|assignment|paper|presentation|case study/i.test(line) &&
      !/^course|^grading|^schedule|^late policy|^office hours|^meeting|^lab:/i.test(line) &&
      !line.startsWith('(Covers') &&
      !/final exam period/i.test(line);

    if (!isAssignmentLine) continue;

    let type: AssignmentType = 'homework';
    if (/exam|midterm|final exam|test/i.test(line)) type = 'exam';
    else if (/project|proposal|capstone|paper|essay|presentation|case study/i.test(line)) type = 'project';
    else if (/quiz/i.test(line)) type = 'quiz';
    else if (/reading|annotation|chapter/i.test(line)) type = 'reading';

    // If the syllabus itself says this item's date/time is TBD, that overrides
    // any inherited section date — leave it blank for the student to fill in
    // rather than guessing a date the document doesn't actually give.
    const lineHasTBD = /\btbd\b/i.test(line);

    let itemDate = lineHasTBD ? null : currentActiveDate;
    const inlineIso = line.match(/\b(202[5-9]-\d{2}-\d{2})\b/);
    const inlineSlash = line.match(/\b(\d{1,2})\/(\d{1,2})\/(202[5-9]|\d{2})\b/);
    const inlineMonth = line.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);

    if (inlineIso) {
      itemDate = inlineIso[1];
    } else if (inlineSlash) {
      const m = parseInt(inlineSlash[1], 10) - 1;
      const d = parseInt(inlineSlash[2], 10);
      const y = inlineSlash[3].length === 2 ? 2000 + parseInt(inlineSlash[3], 10) : parseInt(inlineSlash[3], 10);
      itemDate = format(new Date(y, m, d), 'yyyy-MM-dd');
    } else if (inlineMonth) {
      const mIdx = monthNames.indexOf(inlineMonth[1].toLowerCase().substring(0, 3));
      const dayNum = parseInt(inlineMonth[2], 10);
      itemDate = format(new Date(2026, mIdx, dayNum), 'yyyy-MM-dd');
    }

    // No fabricated placeholder date: if nothing concrete was found, leave it
    // blank so the review screen visibly flags it rather than silently
    // inventing a due date the syllabus never stated.
    if (!itemDate) {
      itemDate = '';
    }

    // Extract the item's own stated time — never hardcode one. A time range
    // ("10:00–10:50 AM") uses its start time; a single "HH:MM AM/PM" mention
    // is used as-is. If the line has none (or is explicitly TBD), dueTime
    // stays null rather than being guessed.
    let itemTime: string | null = null;
    if (!lineHasTBD) {
      const rangeTimeMatch = line.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*\d{1,2}:\d{2}\s*(AM|PM)/i);
      const singleTimeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const to24Hour = (hh: string, mm: string, meridiem: string) => {
        let h = parseInt(hh, 10);
        const ap = meridiem.toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${mm}`;
      };
      if (rangeTimeMatch) {
        itemTime = to24Hour(rangeTimeMatch[1], rangeTimeMatch[2], rangeTimeMatch[3]);
      } else if (singleTimeMatch) {
        itemTime = to24Hour(singleTimeMatch[1], singleTimeMatch[2], singleTimeMatch[3]);
      }
    }

    let weightPercent: number | null = null;
    const inlineWeightMatch = line.match(/(\d{1,2}(?:\.\d)?)\s*%/);
    if (inlineWeightMatch) {
      weightPercent = parseFloat(inlineWeightMatch[1]);
    } else {
      const lowerLine = line.toLowerCase();
      if (/homework/i.test(lowerLine) && weightsDict['homework assignments']) {
        weightPercent = weightsDict['homework assignments'];
      } else if (/lab report/i.test(lowerLine) && weightsDict['lab reports']) {
        weightPercent = weightsDict['lab reports'];
      } else if (/midterm exam 1/i.test(lowerLine) && weightsDict['midterm exam 1']) {
        weightPercent = weightsDict['midterm exam 1'];
      } else if (/midterm exam 2/i.test(lowerLine) && weightsDict['midterm exam 2']) {
        weightPercent = weightsDict['midterm exam 2'];
      } else if (/final project/i.test(lowerLine) && !/proposal/i.test(lowerLine) && weightsDict['final project']) {
        // A "Final Project Proposal" is a checkpoint, not the graded deliverable —
        // the category's full weight belongs to the actual submission only, or
        // both lines would double-claim the same percentage.
        weightPercent = weightsDict['final project'];
      } else if (/final exam/i.test(lowerLine) && weightsDict['final exam']) {
        weightPercent = weightsDict['final exam'];
      } else {
        // Generic fallback for grading tables that don't match one of the
        // hardcoded category names above (e.g. a syllabus with a single
        // undifferentiated "Midterm exam" or "Final exam" category rather
        // than "Midterm exam 1"/"2"): match by substring against whatever
        // categories were actually found in the grading table.
        const matchedKey = Object.keys(weightsDict).find((key) => key.length > 3 && lowerLine.includes(key));
        if (matchedKey) {
          weightPercent = weightsDict[matchedKey];
        }
      }
    }

    let title = line
      .replace(/^[\d.-]+\s*/, '')
      .replace(/\bdue[:\s]*/i, '')
      .replace(/\bdate[:\s]*/i, '')
      .replace(/(\d{1,2}\s*%)/g, '')
      // Strip a trailing "— due HH:MM AM/PM ..." / "— HH:MM–HH:MM AM/PM, Room ..."
      // / ", HH:MM – HH:MM AM/PM, Room ..." annotation now that its time and
      // location have been captured into structured fields. The leading
      // separator accepts a comma as well as a dash (not just "— HH:MM") —
      // a comma-joined line like "Thursday, November 5, 2:00 – 3:30 PM, Room"
      // has its OWN internal dash inside the time range, so requiring a dash
      // immediately before the first time value would match that inner dash
      // instead and truncate the title mid-time.
      .replace(/[\s,–—-]*(?:due\s*|report due\s*)?\d{1,2}:\d{2}(?:\s*[–—-]\s*\d{1,2}:\d{2})?\s*(?:AM|PM).*$/i, '')
      .trim();

    if (title.length > 75) {
      title = title.substring(0, 72) + '...';
    }

    assignments.push({
      title,
      dueDate: itemDate,
      dueTime: itemTime,
      type,
      weightPercent
    });
  }

  if (assignments.length === 0) {
    assignments.push(
      { title: 'Assignment 1: Fundamentals', dueDate: formatDate(4), dueTime: '23:59', type: 'homework', weightPercent: 10 },
      { title: 'Quiz 1', dueDate: formatDate(11), dueTime: '14:00', type: 'quiz', weightPercent: 10 },
      { title: 'Midterm Examination', dueDate: formatDate(22), dueTime: '10:00', type: 'exam', weightPercent: 30 },
      { title: 'Final Project Submission', dueDate: formatDate(38), dueTime: '23:59', type: 'project', weightPercent: 20 },
      { title: 'Final Exam', dueDate: formatDate(48), dueTime: '09:00', type: 'exam', weightPercent: 30 }
    );
  }

  return {
    courseName,
    courseCode,
    instructor,
    semester,
    assignments,
    policies: extractCoursePolicies(text)
  };
}

async function parseWithExternalLLM(text: string, apiKey: string): Promise<ExtractionResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: `You are a syllabus parser AI. Extract course name, code, instructor, and all assignments/exams/deadlines from the text into strict JSON format with this exact structure:
{
  "courseName": "string",
  "courseCode": "string",
  "instructor": "string",
  "semester": "string",
  "assignments": [
    {
      "title": "string",
      "dueDate": "YYYY-MM-DD",
      "dueTime": "HH:MM or null",
      "type": "homework | exam | project | reading | quiz | other",
      "weightPercent": number_or_null
    }
  ],
  "policies": {
    "gradingBreakdown": "string_or_null",
    "lateWork": "string_or_null",
    "contacts": "string_or_null",
    "aiPolicy": "string_or_null",
    "keyDates": "string_or_null",
    "classMeetings": "string_or_null",
    "topics": "string_or_null"
  }
}
For "policies", copy the relevant syllabus text verbatim: grading weight table, late/attendance/makeup rules, instructor/office-hours/marker contacts, generative-AI/academic-integrity policy, key dates (first/last class, exam dates, other named dates that aren't graded assignments), class meeting days/times/room, and the topics/weekly schedule (chapter or week-by-week breakdown), respectively. Use null for any category the syllabus doesn't mention — never invent one. If a date is ambiguous, default to the current year 2026. Respond ONLY with valid JSON.`,
      messages: [{ role: 'user', content: text }]
    })
  });

  const data = await response.json();
  const rawContent = data.content?.[0]?.text || '{}';
  const parsed = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
  return parsed as ExtractionResult;
}
