import { describe, it, expect } from 'vitest';
import { parseSyllabusText, parseClassSchedule, parseClassScheduleOptions } from './aiParser';

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
    // Parsed straight from classMeetings text alone, there's no "starts
    // on"/"repeats until" to infer — the review UI fills those in from the
    // syllabus's First/Last class dates once both are available.
    expect(schedule?.startsOn).toBeNull();
    expect(schedule?.until).toBeNull();
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
Drop-in hours Wednesdays, 2:00 – 4:00 PM, in EME 3311 or on Zoom.
Textbook Priya Fenwick & Daniel Osei, Foundations of Widget Design, 4th edition,
Pearson, 2023
Calculator Only the TI-36X Pro or the CASIO fx-991ES PLUS C may be used in exams.

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

  it('produces the same clean schedule shape on a differently-worded syllabus', async () => {
    const result = await parseSyllabusText(apsc999Text);
    const titles = result.assignments.map((a) => a.title);

    // Class meetings/office hours are deliberately NOT in the schedule
    // table — they're recurring, not one-off dated items, and are instead
    // offered through the recurrence picker (parseClassScheduleOptions).
    expect(titles).toEqual(['First class', 'Midterm exam', 'Last class', 'Final exam']);
    const midterm = result.assignments.find((a) => a.title === 'Midterm exam');
    const finalExam = result.assignments.find((a) => a.title === 'Final exam');
    expect(midterm?.weightPercent).toBe(30);
    expect(finalExam?.weightPercent).toBe(60);
    expect(finalExam?.dueDate).toBe('');
  });

  it('leaves aiPolicy null when the syllabus genuinely has no AI/academic-integrity section', async () => {
    const result = await parseSyllabusText(apsc999Text);
    expect(result.policies?.aiPolicy).toBeNull();
  });

  it('offers one class-schedule option per section, for the recurrence picker dropdown', async () => {
    const result = await parseSyllabusText(apsc999Text);
    const options = parseClassScheduleOptions(result.policies?.classMeetings);

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ section: '101', days: [1, 3], startTime: '13:00', endTime: '14:30', location: 'EME-1101' });
    expect(options[1]).toMatchObject({ section: '102', days: [1, 3], startTime: '15:00', endTime: '16:30', location: 'EME-1101' });
  });

  it('extracts required textbook/calculator into equipment, and strips them out of contacts', async () => {
    const result = await parseSyllabusText(apsc999Text);

    expect(result.policies?.equipment?.toLowerCase()).toContain('foundations of widget design');
    expect(result.policies?.equipment?.toLowerCase()).toContain('ti-36x pro');
    expect(result.policies?.contacts?.toLowerCase()).not.toContain('foundations of widget design');
    expect(result.policies?.contacts?.toLowerCase()).not.toContain('ti-36x pro');
    expect(result.policies?.contacts?.toLowerCase()).toContain('drop-in hours');
  });

  it('captures a wrapped textbook citation continuation line, not just the labeled first line', async () => {
    // "Textbook ..., 4th edition,\nPearson, 2023" — the citation wraps onto
    // a second physical line with no label of its own. Matching only lines
    // that start with "Textbook" would truncate the citation and leave
    // "Pearson, 2023" as an orphan fragment inside contacts instead.
    const result = await parseSyllabusText(apsc999Text);

    expect(result.policies?.equipment?.toLowerCase()).toContain('pearson, 2023');
    expect(result.policies?.contacts?.toLowerCase()).not.toContain('pearson, 2023');
  });
});

// A third syllabus (APSC 182), structured differently again: no "Key Dates"
// or "Class Meetings" section at all — the instructor/office info sits in
// one info block, the grading table is headed "Evaluation Criteria and
// Grading" (not any previously-recognized heading), and the only stated
// exam date is a sentence buried in "Midterm Examination" prose next to
// another sentence that merely *mentions* "final exam" while stating a pass
// requirement, with no date of its own. Locks in real bugs found by running
// this exact text through the parser: a title with parens, cross-section
// date leakage, grading-table rows leaking into the schedule, and a
// deep-in-a-sentence keyword mention faking a schedule item.
describe('parseSyllabusText against a syllabus with no Key Dates/Class Meetings section', () => {
  const apsc182Text = `APSC 182 (3) Matter and Energy I

Instructor: Dr. Elizabeth Trudel
Email: elizabeth.trudel@ubc.ca
Office: EME3277
Office hours: Mondays 2:00-3:30 PM

Evaluation Criteria and Grading
Component   Weight
In class activities   5
Assignments   12
Midterm Exam   30
Final Exam   53

In order to pass this course you must:
achieve final exam grade of at least 45%.

Midterm Examination
The midterm will take place in class on Wednesday November 4th, 2026. The exam is closed book.

Final Examination
The final exam will be cumulative, closed book and a formula sheet will be provided.`;

  it('picks the real title even though it contains parens ("(3)") the shape check used to reject', async () => {
    const result = await parseSyllabusText(apsc182Text);
    expect(result.courseCode).toBe('APSC 182');
    expect(result.courseName).toBe('APSC 182 (3) Matter and Energy I');
  });

  it('does not let a grading-table row ("Midterm Exam   30") leak into the schedule as a fake dated item', async () => {
    const result = await parseSyllabusText(apsc182Text);
    const titles = result.assignments.map((a) => a.title);
    expect(titles).not.toContain('Midterm Exam 30');
    expect(titles).not.toContain('Final Exam 53');
    expect(result.policies?.gradingBreakdown).toContain('Midterm Exam');
    expect(result.policies?.gradingBreakdown).toContain('Final Exam');
  });

  it('does not treat a pass-requirement sentence that merely mentions "final exam" as a schedule item', async () => {
    const result = await parseSyllabusText(apsc182Text);
    const bogus = result.assignments.find((a) => a.title.toLowerCase().includes('achieve final exam grade'));
    expect(bogus).toBeUndefined();
  });

  it('attaches the real midterm date, and does not let the final exam (genuinely undated) inherit it', async () => {
    const result = await parseSyllabusText(apsc182Text);
    const midterm = result.assignments.find((a) => a.title.toLowerCase().includes('midterm will take place'));
    const finalExam = result.assignments.find((a) => a.title.toLowerCase().includes('final exam will be cumulative'));

    expect(midterm?.dueDate).toBe('2026-11-04');
    expect(finalExam?.dueDate).toBe('');
  });
});

describe('parseSyllabusText no longer fabricates a fake schedule when nothing real is found', () => {
  it('returns an empty assignments array instead of five made-up demo items', async () => {
    // This syllabus text has no recognizable schedule/date structure at all
    // (no Key Dates, no dated table the parser understands). It used to
    // silently fill the table with five entirely fake items ("Assignment 1:
    // Fundamentals" due in 4 days, etc.) with nothing marking them as
    // placeholders — indistinguishable from a real extracted schedule, and
    // able to make a student miss an actual deadline by trusting a fake one.
    const result = await parseSyllabusText('APSC 999 Some Course\nInstructor Jane Doe\nNo dates or schedule mentioned anywhere in this document.');
    expect(result.assignments).toEqual([]);
  });
});
