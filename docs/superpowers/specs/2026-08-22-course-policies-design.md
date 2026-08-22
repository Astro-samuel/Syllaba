# Per-Course Policies Section

## Problem

Syllabi carry policy information beyond assignment dates — grading breakdown, late-work/attendance rules, contacts, and AI/academic-integrity policy — that the app currently discards after extracting assignments.

## Scope

Add a per-course "Policies" view covering four categories:
1. Grading breakdown
2. Late work / attendance / makeup rules
3. Key contacts & logistics (instructor email, office hours, markers/TAs, drop-in hours)
4. AI / academic integrity policy

Auto-extracted from the uploaded syllabus at upload time, editable afterward.

## Data model

`src/types/index.ts`:

```ts
export interface CoursePolicies {
  gradingBreakdown: string | null;
  lateWork: string | null;
  contacts: string | null;
  aiPolicy: string | null;
}
```

- `ExtractionResult.policies?: CoursePolicies`
- `Course.policies?: CoursePolicies`

## Extraction

`src/utils/aiParser.ts`:

- `parseWithLocalNLP`: add four keyword-anchored section captures, following the existing `breakdownMatch` pattern (capture from a heading keyword up to the next known heading or end of text). Each category checks a set of heading synonyms (e.g. late work: `late policy|attendance|oops token|makeup`; contacts: `office hours|drop-in|markers?|email`; AI policy: `generative ai|academic integrity|academic misconduct`). Missing sections stay `null` rather than fabricated.
- `parseWithExternalLLM`: extend the JSON schema/system prompt with the same four fields.

## Review flow

`src/components/ReviewModal.tsx`: add a collapsible "Policies" section below the assignment list with four editable textareas, pre-filled from `extraction.policies`, blank when nothing was found. `onSave` passes the (possibly edited) `CoursePolicies` object through.

`src/App.tsx`: `handleSaveExtractedCourse` accepts the policies object and stores it on the new `Course`.

## Display

No per-course detail route exists today. Rather than build new routing, make each course card in `DashboardTimeline.tsx` clickable to open a `CourseDetailModal` (same modal pattern as `ReviewModal`/`CalendarSyncModal`) with two internal tabs:
- **Assignments** — existing per-course assignment list (already computable from `assignments` filtered by `courseId`)
- **Policies** — the four sections, editable, saved back onto the `Course` object via a new `onUpdateCoursePolicies` callback in `App.tsx`

## Out of scope

- No new top-level "Courses" page/route (TabType has an unused `'courses'` entry — not touched here).
- No re-extraction/re-upload flow from inside the modal.
