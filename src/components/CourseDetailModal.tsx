import React, { useState } from 'react';
import { Course, Assignment, CoursePolicies } from '../types';
import { X, CheckCircle2, Circle, Save } from 'lucide-react';

const POLICY_FIELDS: { key: keyof CoursePolicies; label: string; placeholder: string }[] = [
  { key: 'gradingBreakdown', label: 'Grading Breakdown', placeholder: 'No grading breakdown recorded for this course.' },
  { key: 'lateWork', label: 'Late Work / Attendance', placeholder: 'No late-work or attendance policy recorded.' },
  { key: 'contacts', label: 'Contacts & Logistics', placeholder: 'No office hours, contacts, or logistics recorded.' },
  { key: 'aiPolicy', label: 'AI / Academic Integrity', placeholder: 'No AI or academic integrity policy recorded.' }
];

interface CourseDetailModalProps {
  course: Course;
  assignments: Assignment[];
  onClose: () => void;
  onToggleComplete: (id: string) => void;
  onSavePolicies: (policies: CoursePolicies) => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  assignments,
  onClose,
  onToggleComplete,
  onSavePolicies
}) => {
  const [tab, setTab] = useState<'assignments' | 'policies'>('assignments');
  const [policies, setPolicies] = useState<CoursePolicies>({
    gradingBreakdown: null,
    lateWork: null,
    contacts: null,
    aiPolicy: null,
    ...course.policies
  });
  const [dirty, setDirty] = useState(false);

  const handleUpdatePolicy = (key: keyof CoursePolicies, value: string) => {
    setPolicies((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    onSavePolicies(policies);
    setDirty(false);
  };

  const sortedAssignments = [...assignments].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white border border-slate-200/80 p-8 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full shadow-xs" style={{ backgroundColor: course.color }} />
            <div>
              <h2 className="font-heading text-xl font-extrabold text-caplen-navy">{course.name}</h2>
              <p className="text-xs text-caplen-muted font-medium">
                {course.code}
                {course.instructor ? ` · ${course.instructor}` : ''}
                {course.semester ? ` · ${course.semester}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setTab('assignments')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold font-heading transition-colors ${
              tab === 'assignments' ? 'bg-caplen-navy text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Assignments
          </button>
          <button
            onClick={() => setTab('policies')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold font-heading transition-colors ${
              tab === 'policies' ? 'bg-caplen-navy text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Policies
          </button>
        </div>

        {tab === 'assignments' && (
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {sortedAssignments.length === 0 && (
              <p className="p-6 text-center text-xs text-caplen-muted font-medium">No assignments for this course yet.</p>
            )}
            {sortedAssignments.map((a) => (
              <button
                key={a.id}
                onClick={() => onToggleComplete(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                {a.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <span className={`flex-1 text-xs font-bold ${a.completed ? 'text-slate-400 line-through' : 'text-caplen-navy'}`}>
                  {a.title}
                </span>
                <span className="text-[10px] font-mono text-caplen-muted number-display">
                  {a.dueDate || 'TBD'}
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'policies' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POLICY_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">{label}</label>
                  <textarea
                    value={policies[key] || ''}
                    placeholder={placeholder}
                    onChange={(e) => handleUpdatePolicy(key, e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-medium text-caplen-navy focus:outline-none resize-y"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!dirty}
                className="flex items-center gap-2 rounded-full bg-caplen-navy px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all font-heading tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Policies</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
