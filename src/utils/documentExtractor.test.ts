import { describe, it, expect } from 'vitest';
import { parseSyllabusText } from './aiParser';

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
    // that inner dash instead and truncates the title mid-number.
    const result = await parseSyllabusText(apsc179Text);
    const midterm = result.assignments.find((a) => a.title.toLowerCase().includes('midterm'));

    expect(midterm?.title).not.toMatch(/2:00$/);
    expect(midterm?.title).toBe('Midterm exam – Section 101 Thursday, November 5');
  });

  it('attaches the grading-table weight to an item even when the table has no colon separator', async () => {
    // "Midterm exam (1 hour)   35%   Thursday, November 5, in class" is a
    // rendered table row (whitespace-separated columns), not "Label: NN%".
    const result = await parseSyllabusText(apsc179Text);
    const midterm = result.assignments.find((a) => a.title.toLowerCase().includes('midterm'));

    expect(midterm?.weightPercent).toBe(35);
  });
});
