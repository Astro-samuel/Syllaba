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

Key dates
First class Tuesday, September 8, 2026
Midterm exam – Section 101 Thursday, November 5, 2:00 – 3:30 PM, ASC-140
Last class Tuesday, December 8, 2026

Assessment and grading
Component Weight When
Assignments (marked on attempt) 5% Throughout the term
Midterm exam (1 hour) 35% Thursday, November 5, in class
Final exam (3 hours) 60% December examination period`;

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
});
