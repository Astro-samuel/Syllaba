import React from 'react';
import { ClassSchedule } from '../types';
import { Repeat, X, Plus } from 'lucide-react';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const BLANK_SCHEDULE: ClassSchedule = {
  section: null,
  days: [],
  startTime: null,
  endTime: null,
  location: null,
  startsOn: null,
  until: null
};

interface ClassScheduleEditorProps {
  /** Candidate patterns parsed from the syllabus (one per section, when it lists several). */
  options: ClassSchedule[];
  value: ClassSchedule | null;
  onChange: (schedule: ClassSchedule | null) => void;
}

/**
 * A compact, Google-Calendar-style recurrence editor: pick which section
 * (when the syllabus lists more than one), toggle days of the week, set a
 * start/end time, and a "repeats until" end date. Lets the student verify
 * and correct the parsed meeting pattern before it drives the calendar's
 * recurring chips — a syllabus can misparse a day or a room, and there's no
 * single "due date" to review it against like a normal assignment row.
 */
export const ClassScheduleEditor: React.FC<ClassScheduleEditorProps> = ({ options, value, onChange }) => {
  const handleSectionChange = (section: string) => {
    const chosen = options.find((o) => o.section === section);
    if (!chosen) return;
    // Keep whatever start/end date the student already set — that's a
    // property of the term, not of which section they're in.
    onChange({ ...chosen, startsOn: value?.startsOn ?? chosen.startsOn, until: value?.until ?? chosen.until });
  };

  const toggleDay = (day: number) => {
    if (!value) return;
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day].sort((a, b) => a - b);
    onChange({ ...value, days });
  };

  const update = (patch: Partial<ClassSchedule>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(options[0] || BLANK_SCHEDULE)}
        className="flex items-center gap-1.5 text-xs font-bold text-vibrant-purpleText hover:underline transition-colors font-heading"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add recurring class schedule</span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Section</label>
          <select
            value={value.section || ''}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
          >
            {options.map((o) => (
              <option key={o.section} value={o.section || ''}>
                Section {o.section}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Repeats on</label>
        <div className="mt-1 flex gap-1.5">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              title={DAY_NAMES[day]}
              aria-pressed={value.days.includes(day)}
              className={`h-7 w-7 rounded-full text-[11px] font-extrabold transition-colors ${
                value.days.includes(day)
                  ? 'bg-caplen-navy text-white'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Start time</label>
          <input
            type="time"
            value={value.startTime || ''}
            onChange={(e) => update({ startTime: e.target.value || null })}
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none number-display"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">End time</label>
          <input
            type="time"
            value={value.endTime || ''}
            onChange={(e) => update({ endTime: e.target.value || null })}
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none number-display"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Location</label>
        <input
          type="text"
          value={value.location || ''}
          onChange={(e) => update({ location: e.target.value || null })}
          placeholder="Room / building"
          className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            Starts on
          </label>
          <input
            type="date"
            value={value.startsOn || ''}
            onChange={(e) => update({ startsOn: e.target.value || null })}
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none number-display"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            Repeats until
          </label>
          <input
            type="date"
            value={value.until || ''}
            onChange={(e) => update({ until: e.target.value || null })}
            className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy focus:outline-none number-display"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
      >
        <X className="h-3 w-3" />
        <span>Remove recurring schedule</span>
      </button>
    </div>
  );
};
