import { describe, it, expect } from 'vitest';
import { buildSignature, computeSyncPlan } from './googleCalendarSync';
import { Assignment } from '../types';

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a_1',
    courseId: 'c_1',
    courseName: 'CS 101',
    title: 'Homework 1',
    dueDate: '2026-09-01',
    dueTime: '23:59',
    type: 'homework',
    weightPercent: 10,
    completed: false,
    color: '#8b5cf6',
    ...overrides
  };
}

describe('buildSignature', () => {
  it('is stable for identical content', () => {
    const a = makeAssignment();
    const b = makeAssignment();
    expect(buildSignature(a)).toBe(buildSignature(b));
  });

  it('changes when due date changes', () => {
    const a = makeAssignment();
    const b = makeAssignment({ dueDate: '2026-09-02' });
    expect(buildSignature(a)).not.toBe(buildSignature(b));
  });

  it('is unaffected by fields outside the mapped set (e.g. completed)', () => {
    const a = makeAssignment({ completed: false });
    const b = makeAssignment({ completed: true });
    expect(buildSignature(a)).toBe(buildSignature(b));
  });
});

describe('computeSyncPlan', () => {
  it('plans a create for an assignment with no event record', () => {
    const plan = computeSyncPlan([makeAssignment()], {});
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans nothing when signature is unchanged', () => {
    const assignment = makeAssignment();
    const events = { a_1: { googleEventId: 'ev1', signature: buildSignature(assignment) } };
    const plan = computeSyncPlan([assignment], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans an update when signature changed', () => {
    const assignment = makeAssignment({ title: 'Homework 1 (revised)' });
    const events = { a_1: { googleEventId: 'ev1', signature: 'stale-signature' } };
    const plan = computeSyncPlan([assignment], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toEqual([{ assignment, googleEventId: 'ev1' }]);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('plans a delete for an event with no matching assignment', () => {
    const events = { a_gone: { googleEventId: 'ev_gone', signature: 'x' } };
    const plan = computeSyncPlan([], events);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toEqual(['ev_gone']);
  });
});

import { computeImportPlan, eventToAssignmentFields, RemoteCalendarEvent } from './googleCalendarSync';

function makeEvent(overrides: Partial<RemoteCalendarEvent> = {}): RemoteCalendarEvent {
  return {
    id: 'gEvent1',
    updated: '2026-08-01T10:00:00.000Z',
    summary: 'Midterm Review Session',
    start: { dateTime: '2026-09-05T14:00:00-04:00' },
    ...overrides
  };
}

describe('eventToAssignmentFields', () => {
  it('splits a timed event into dueDate/dueTime', () => {
    const fields = eventToAssignmentFields(makeEvent());
    expect(fields).toEqual({ title: 'Midterm Review Session', dueDate: '2026-09-05', dueTime: '14:00' });
  });

  it('handles an all-day event with dueTime null', () => {
    const fields = eventToAssignmentFields(makeEvent({ start: { date: '2026-09-06' } }));
    expect(fields).toEqual({ title: 'Midterm Review Session', dueDate: '2026-09-06', dueTime: null });
  });
});

describe('computeImportPlan', () => {
  it('plans a create for a remote event with no matching record', () => {
    const plan = computeImportPlan([makeEvent()], {}, {}, '2026-01-01');
    expect(plan.toCreate).toEqual([makeEvent()]);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans nothing when the event is not newer than the last-seen remoteUpdated', () => {
    const events = { a_1: { googleEventId: 'gEvent1', signature: 'x', remoteUpdated: '2026-08-01T10:00:00.000Z' } };
    const plan = computeImportPlan([makeEvent()], events, { a_1: {} as any }, '2026-01-01');
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans an update when the event is newer than the last-seen remoteUpdated', () => {
    const events = { a_1: { googleEventId: 'gEvent1', signature: 'x', remoteUpdated: '2026-07-01T00:00:00.000Z' } };
    const event = makeEvent({ updated: '2026-08-15T00:00:00.000Z' });
    const plan = computeImportPlan([event], events, { a_1: {} as any }, '2026-01-01');
    expect(plan.toUpdate).toEqual([{ event, assignmentId: 'a_1' }]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('plans a delete when a previously-pulled event is missing and its assignment is within the fetch window', () => {
    const events = { a_1: { googleEventId: 'gEventGone', signature: 'x', remoteUpdated: '2026-07-01T00:00:00.000Z' } };
    const assignmentsById = { a_1: { dueDate: '2026-08-01' } as any };
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toEqual(['a_1']);
  });

  it('does NOT plan a delete when the assignment predates the fetch window (avoids false deletes)', () => {
    const events = { a_1: { googleEventId: 'gEventGone', signature: 'x', remoteUpdated: '2025-01-01T00:00:00.000Z' } };
    const assignmentsById = { a_1: { dueDate: '2025-06-01' } as any }; // before windowStartDate
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });

  it('does NOT plan a delete for a native (never-pulled) assignment missing from the fetch', () => {
    const events = { a_1: { googleEventId: 'gEventPushed', signature: 'x' } }; // no remoteUpdated: pushed, not pulled
    const assignmentsById = { a_1: { dueDate: '2026-08-01' } as any };
    const plan = computeImportPlan([], events, assignmentsById, '2026-01-01');
    expect(plan.toDeleteAssignmentIds).toHaveLength(0);
  });
});
