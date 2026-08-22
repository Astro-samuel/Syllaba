import { describe, it, expect } from 'vitest';
import { parseSyllabusText, parseClassSchedule } from './aiParser';

// Regression test for the bug where a real multi-line PDF syllabus (tables,
// wrapped headings, a schedule with one item per line) produced garbage or
// empty results. Root cause was in documentExtractor's PDF text extraction,
// which joined every text run on a page with a single space and discarded
// line breaks entirely -- collapsing each page into one unparseable line.
// That fix can't be unit tested directly (it needs pdf.js's TextItem.hasEOL,
// which only exists mid-render), so this test instead locks in the parser's
// behavior on text shaped the way the fixed extractor now produces it: real
// newlines between visual lines, exactly like the APSC 179 Linear Algebra
// syllabus that surfaced the bug.
describe('parseSyllabusText against a real multi-page syllabus layout', () => {
  const apsc179Text = `APSC 179 – Linear Algebra for Engineers
Sections 101 and 102 · Winter 2026, Term 1 · 3 credits
School of Engineering, UBC Okanagan

Quick facts
Instructor Mehran Shirazi, Ph.D., P.Eng.
Email mehran.shirazi@ubc.ca
Office EME 3219 · 250 807 8140

Class meetings
Section   Days and time   Room
101   Tuesday and Thursday, 2:00 – 3:30 PM   ASC-140

Key dates
First class Tuesday, September 8, 2026
Midterm exam – Section 101 Thursday, November 5, 2:00 – 3:30 PM, ASC-140
Last class Tuesday, December 8, 2026

Assessment and grading
Component   Weight   When
Assignments (marked on attempt)   5%   Throughout the term
Midterm exam (1 hour)   35%   Thursday, November 5, in class
Final exam (3 hours)   60%   December examination period

Topics
Chapter   Sections
1. Linear Equations
Systems of linear equations · Row reduction and echelon forms

Late work and oops tokens
Late submissions are not accepted; Canvas flags anything late, even by one minute.
However, you have two oops tokens for the term.

Drop-in (Office) hours
Fridays, 1:00 - 5:00 PM, EME 3219. You do not need an appointment.

Generative AI
You may use artificial intelligence tools, including generative AI, to gather information.
AI tools are not permitted during the midterm or the final exam.

Academic integrity
The academic enterprise is founded on honesty, civility, and integrity.`;

  it('extracts course code and instructor instead of collapsing the page into one blob', async () => {
    const result = await parseSyllabusText(apsc179Text);

    expect(result.courseCode).toBe('APSC 179');
    expect(result.instructor.toLowerCase()).toContain('mehran shirazi');
  });

  it('does not throw and returns some assignment scaffolding when no dated schedule is present', async () => {
    const result = await parseSyllabusText(apsc179Text);

    expect(Array.isArray(result.assignments)).toBe(true);
    expect(result.assignments.length).toBeGreaterThan(0);
  });

  it('extracts all seven info/policy categories from their respective sections', async () => {
    const result = await parseSyllabusText(apsc179Text);

    expect(result.policies?.gradingBreakdown).toContain('35%');
    expect(result.policies?.lateWork?.toLowerCase()).toContain('oops token');
    expect(result.policies?.contacts?.toLowerCase()).toContain('drop-in');
    expect(result.policies?.aiPolicy?.toLowerCase()).toContain('generative ai');
    expect(result.policies?.keyDates?.toLowerCase()).toContain('first class');
    expect(result.policies?.classMeetings?.toLowerCase()).toContain('tuesday and thursday');
    expect(result.policies?.topics?.toLowerCase()).toContain('linear equations');
  });

  it('leaves a policy category null rather than fabricating text when the syllabus has no such section', async () => {
    const result = await parseSyllabusText('COURSE 101\nInstructor Jane Doe\nNo other sections here.');

    expect(result.policies?.lateWork).toBeNull();
    expect(result.policies?.aiPolicy).toBeNull();
  });

  it('does not truncate a title mid-time when the time range is comma-joined, not dash-joined', async () => {
    // "Thursday, November 5, 2:00 – 3:30 PM, ASC-140" — the only dash in the
    // line sits *inside* the time range, not before it. A title-stripper
    // that requires a dash immediately before the first time value matches
    // that inner dash instead and truncates the title mid-number. The
    // section tag and the now-redundant date text (already captured as
    // dueDate) are also stripped, leaving a clean "Midterm exam" title.
    const result = await parseSyllabusText(apsc179Text);
    const midterm = result.assignments.find((a) => a.title.toLowerCase().includes('midterm'));

    expect(midterm?.title).not.toMatch(/2:00/);
    expect(midterm?.title).toBe('Midterm exam');
  });

  it('deduplicates the same exam listed once per section so its weight is not double-counted', async () => {
    // The real syllabus lists "Midterm exam – Section 101" and
    // "– Section 102" as two separate lines (each section's own room/time),
    // but a given student is enrolled in exactly one section. Counting both
    // would double the item's weight in the allocated-weight total.
    const textWithBothSections = apsc179Text.replace(
      'Midterm exam – Section 101 Thursday, November 5, 2:00 – 3:30 PM, ASC-140',
      'Midterm exam – Section 101 Thursday, November 5, 2:00 – 3:30 PM, ASC-140\nMidterm exam – Section 102 Thursday, November 5, 12:30 – 2:00 PM, ASC-140'
    );
    const result = await parseSyllabusText(textWithBothSections);
    const midterms = result.assignments.filter((a) => a.title.toLowerCase().includes('midterm'));

    expect(midterms).toHaveLength(1);
  });

  it('leaves the date blank when the syllabus states it is not yet scheduled, instead of inheriting an unrelated date', async () => {
    // "Final exam: Scheduled by the University and announced during the
    // term" is not the last-day-of-classes date, even though that's what
    // the currently-active section date would otherwise supply. Inserted
    // inside Key Dates, matching where the real syllabus actually states it.
    const textWithFinalExam = apsc179Text.replace(
      'Last class Tuesday, December 8, 2026',
      'Last class Tuesday, December 8, 2026\nFinal exam Scheduled by the University and announced during the term.'
    );
    const result = await parseSyllabusText(textWithFinalExam);
    const finalExam = result.assignments.find((a) => a.title.toLowerCase().includes('final exam'));

    expect(finalExam?.dueDate).toBe('');
    expect(finalExam?.title).toBe('Final exam');
  });

  it('picks up key, non-graded schedule dates (first/last class) as their own schedule items', async () => {
    const result = await parseSyllabusText(apsc179Text);
    const firstClass = result.assignments.find((a) => a.title.toLowerCase() === 'first class');
    const lastClass = result.assignments.find((a) => a.title.toLowerCase() === 'last class');

    expect(firstClass?.dueDate).toBe('2026-09-08');
    expect(firstClass?.type).toBe('other');
    expect(lastClass?.dueDate).toBe('2026-12-08');
  });

  it('attaches the grading-table weight to an item even when the table has no colon separator', async () => {
    // "Midterm exam (1 hour)   35%   Thursday, November 5, in class" is a
    // rendered table row (whitespace-separated columns), not "Label: NN%".
    const result = await parseSyllabusText(apsc179Text);
    const midterm = result.assignments.find((a) => a.title.toLowerCase().includes('midterm'));

    expect(midterm?.weightPercent).toBe(35);
  });

  it('parses a recurring weekly meeting pattern out of classMeetings text', async () => {
    const result = await parseSyllabusText(apsc179Text);
    const schedule = parseClassSchedule(result.policies?.classMeetings);

    // "Tuesday and Thursday, 2:00 – 3:30 PM   ASC-140" -> Tue=2, Thu=4
    expect(schedule?.days).toEqual([2, 4]);
    expect(schedule?.startTime).toBe('14:00');
    expect(schedule?.endTime).toBe('15:30');
    expect(schedule?.location).toBe('ASC-140');
  });

  it('returns null for a class schedule when there is no classMeetings text', () => {
    expect(parseClassSchedule(null)).toBeNull();
    expect(parseClassSchedule(undefined)).toBeNull();
    expect(parseClassSchedule('No days or times mentioned here.')).toBeNull();
  });
});

// A second, differently-worded syllabus (APSC 999, a fictional test doc) to
// prove the extraction generalizes rather than being tuned to one PDF's
// specific wording. This one also renders its institutional banner
// ("THE UNIVERSITY OF BRITISH COLUMBIA") as real extractable text sitting
// above the actual title line -- APSC 179's banner was a logo image, not
// text, so this case hadn't been exercised yet.
describe('parseSyllabusText against a second, differently-worded syllabus', () => {
  const apsc999Text = `THE UNIVERSITY OF BRITISH COLUMBIA
APSC 999 – Introduction to Widget Engineering
Sections 101 and 102 · Winter 2026, Term 1 · 3 credits
School of Engineering, UBC Okanagan

Quick facts
Instructor Dr. Priya Fenwick, Ph.D., P.Eng.
Email priya.fenwick@ubc.ca

Class meetings
Section   Days and time   Room
101   Monday and Wednesday, 1:00 – 2:30 PM   EME-1101
102   Monday and Wednesday, 3:00 – 4:30 PM   EME-1101

Key dates
First class Monday, September 7, 2026
Midterm exam – Section 101 Wednesday, October 28, 1:00 – 2:30 PM, EME-1101
Midterm exam – Section 102 Wednesday, October 28, 3:00 – 4:30 PM, EME-1101
Last class Wednesday, December 2, 2026
Final exam Scheduled by the University and announced during the term.

Assessment and grading
Component   Weight   When
Assignments (marked on attempt)   10%   Throughout the term
Midterm exam (1 hour)   30%   Wednesday, October 28, in class
Final exam (3 hours)   60%   December examination period

Topics
Week   Topic
1–3   Fasteners: threads, bolts, washers, torque specs

Late work and oops tokens
Late submissions are not accepted; Canvas flags anything late, even by one minute.

Getting help
Drop-in hours are Wednesdays, 2:00 – 4:00 PM, in EME 3311.`;

  it('picks the real title, not the institutional banner line above it', async () => {
    const result = await parseSyllabusText(apsc999Text);

    expect(result.courseCode).toBe('APSC 999');
    expect(result.courseName).toBe('APSC 999 – Introduction to Widget Engineering');
  });

  it('produces the same clean schedule shape on a differently-worded syllabus, including recurring meeting/office-hours rows', async () => {
    const result = await parseSyllabusText(apsc999Text);
    const titles = result.assignments.map((a) => a.title);

    expect(titles).toEqual([
      'First class',
      'Midterm exam',
      'Last class',
      'Final exam',
      'Class Meeting (Mon, Wed) — EME-1101',
      'Office Hours (Wed) — EME 3311'
    ]);
    const midterm = result.assignments.find((a) => a.title === 'Midterm exam');
    const finalExam = result.assignments.find((a) => a.title === 'Final exam');
    expect(midterm?.weightPercent).toBe(30);
    expect(finalExam?.weightPercent).toBe(60);
    expect(finalExam?.dueDate).toBe('');

    // Neither recurring pattern is a graded item, and the review table
    // needs to allow (not fabricate) an empty weight for both.
    const classMeeting = result.assignments.find((a) => a.title.startsWith('Class Meeting'));
    const officeHours = result.assignments.find((a) => a.title.startsWith('Office Hours'));
    expect(classMeeting?.weightPercent).toBeNull();
    expect(officeHours?.weightPercent).toBeNull();
    // Anchored to the term's first-class date so they show up on the
    // calendar/table instead of floating with no date.
    expect(classMeeting?.dueDate).toBe('2026-09-07');
    expect(officeHours?.dueDate).toBe('2026-09-07');
  });

  it('leaves aiPolicy null when the syllabus genuinely has no AI/academic-integrity section', async () => {
    const result = await parseSyllabusText(apsc999Text);
    expect(result.policies?.aiPolicy).toBeNull();
  });
});
