import React, { useState } from 'react';
import { Assignment, AssignmentType, Course } from '../types';
import { X, Plus } from 'lucide-react';

const NO_COURSE_COLOR = '#64748B'; // slate — used when a task isn't tied to any course

interface AddTaskModalProps {
  courses: Course[];
  defaultDate: string; // YYYY-MM-DD, pre-fills the date field (e.g. the day clicked on the calendar)
  onClose: () => void;
  onAdd: (assignment: Omit<Assignment, 'id'>) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ courses, defaultDate, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [dueTime, setDueTime] = useState('');
  const [type, setType] = useState<AssignmentType>('other');
  const [courseId, setCourseId] = useState<string>('');

  const selectedCourse = courses.find((c) => c.id === courseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    onAdd({
      courseId: courseId,
      courseName: selectedCourse ? selectedCourse.code : 'Personal',
      title: title.trim(),
      dueDate,
      dueTime: dueTime || null,
      type,
      weightPercent: null,
      completed: false,
      color: selectedCourse ? selectedCourse.color : NO_COURSE_COLOR
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200/80 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-heading text-lg font-extrabold text-caplen-navy">Add Task</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Study for chapter 3 quiz"
            autoFocus
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-caplen-navy focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-mono text-caplen-navy focus:outline-none number-display"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Time (optional)</label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-mono text-caplen-navy focus:outline-none number-display"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AssignmentType)}
              className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-caplen-navy focus:outline-none"
            >
              <option value="other">Task</option>
              <option value="homework">Homework</option>
              <option value="exam">Exam</option>
              <option value="project">Project</option>
              <option value="quiz">Quiz</option>
              <option value="reading">Reading</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Course (optional)</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-caplen-navy focus:outline-none"
            >
              <option value="">Personal (no course)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || !dueDate}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-caplen-navy px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all font-heading tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Add to Calendar</span>
        </button>
      </form>
    </div>
  );
};
