import { Assignment, SyncedEventRecord } from '../types';

export function buildSignature(assignment: Assignment): string {
  return JSON.stringify({
    title: assignment.title,
    courseName: assignment.courseName,
    dueDate: assignment.dueDate,
    dueTime: assignment.dueTime,
    type: assignment.type,
    weightPercent: assignment.weightPercent
  });
}

export interface SyncPlan {
  toCreate: Assignment[];
  toUpdate: { assignment: Assignment; googleEventId: string }[];
  toDelete: string[]; // googleEventIds
}

export function computeSyncPlan(
  assignments: Assignment[],
  events: Record<string, SyncedEventRecord>
): SyncPlan {
  const toCreate: Assignment[] = [];
  const toUpdate: { assignment: Assignment; googleEventId: string }[] = [];

  const seenAssignmentIds = new Set<string>();

  for (const assignment of assignments) {
    seenAssignmentIds.add(assignment.id);
    const existing = events[assignment.id];
    const signature = buildSignature(assignment);

    if (!existing) {
      toCreate.push(assignment);
    } else if (existing.signature !== signature) {
      toUpdate.push({ assignment, googleEventId: existing.googleEventId });
    }
    // else: signature unchanged, nothing to do
  }

  const toDelete: string[] = Object.entries(events)
    .filter(([assignmentId]) => !seenAssignmentIds.has(assignmentId))
    .map(([, record]) => record.googleEventId);

  return { toCreate, toUpdate, toDelete };
}

export interface RemoteCalendarEvent {
  id: string;
  updated: string; // RFC3339
  summary: string;
  start: { date?: string; dateTime?: string };
}

export function eventToAssignmentFields(event: RemoteCalendarEvent): {
  title: string;
  dueDate: string;
  dueTime: string | null;
} {
  if (event.start.dateTime) {
    const [datePart, timePart] = event.start.dateTime.split('T');
    return { title: event.summary, dueDate: datePart, dueTime: timePart.slice(0, 5) };
  }
  return { title: event.summary, dueDate: event.start.date || '', dueTime: null };
}

export interface ImportPlan {
  toCreate: RemoteCalendarEvent[];
  toUpdate: { event: RemoteCalendarEvent; assignmentId: string }[];
  toDeleteAssignmentIds: string[];
}

export function computeImportPlan(
  remoteEvents: RemoteCalendarEvent[],
  events: Record<string, SyncedEventRecord>,
  assignmentsById: Record<string, Assignment>,
  windowStartDate: string
): ImportPlan {
  const toCreate: RemoteCalendarEvent[] = [];
  const toUpdate: { event: RemoteCalendarEvent; assignmentId: string }[] = [];
  const seenGoogleEventIds = new Set<string>();

  const byGoogleEventId = new Map<string, string>();
  for (const [assignmentId, record] of Object.entries(events)) {
    byGoogleEventId.set(record.googleEventId, assignmentId);
  }

  for (const event of remoteEvents) {
    seenGoogleEventIds.add(event.id);
    const assignmentId = byGoogleEventId.get(event.id);

    if (!assignmentId) {
      toCreate.push(event);
      continue;
    }

    const record = events[assignmentId];
    const lastSeen = record.remoteUpdated ?? null;
    if (!lastSeen || event.updated > lastSeen) {
      toUpdate.push({ event, assignmentId });
    }
  }

  const toDeleteAssignmentIds: string[] = Object.entries(events)
    .filter(([assignmentId, record]) => {
      if (record.remoteUpdated == null) return false; // never pulled (native/pushed-only): don't delete-by-absence
      if (seenGoogleEventIds.has(record.googleEventId)) return false;
      const assignment = assignmentsById[assignmentId];
      if (!assignment) return false;
      return assignment.dueDate >= windowStartDate; // only trust absence within the fetched window
    })
    .map(([assignmentId]) => assignmentId);

  return { toCreate, toUpdate, toDeleteAssignmentIds };
}
