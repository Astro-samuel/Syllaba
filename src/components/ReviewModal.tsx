import React, { useState } from 'react';
import { ExtractionResult, ExtractedAssignment, AssignmentType } from '../types';
import { X, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReviewModalProps {
  extraction: ExtractionResult;
  color: string;
  onClose: () => void;
  onSave: (
    courseName: string,
    courseCode: string,
    color: string,
    instructor: string,
    semester: string,
    assignments: ExtractedAssignment[]
  ) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  extraction,
  color: initialColor,
  onClose,
  onSave
}) => {
  const [courseName, setCourseName] = useState(extraction.courseName);
  const [courseCode, setCourseCode] = useState(extraction.courseCode);
  const [instructor, setInstructor] = useState(extraction.instructor || 'Prof.');
  const [semester, setSemester] = useState(extraction.semester || 'Fall 2026');
  const [color, setColor] = useState(initialColor);
  const [items, setItems] = useState<ExtractedAssignment[]>([...extraction.assignments]);

  const handleUpdateItem = (index: number, field: keyof ExtractedAssignment, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const newItem: ExtractedAssignment = {
      title: 'New Assignment',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '23:59',
      type: 'homework',
      weightPercent: 10
    };
    setItems([...items, newItem]);
  };

  const handleConfirmSave = () => {
    if (!courseName.trim()) return;
    onSave(courseName, courseCode, color, instructor, semester, items);
  };

  const totalWeight = items.reduce((acc, curr) => acc + (curr.weightPercent || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-white border border-slate-200/80 p-8 shadow-2xl my-8">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full shadow-xs" style={{ backgroundColor: color }} />
            <div>
              <h2 className="font-heading text-xl font-extrabold text-caplen-navy flex items-center gap-2">
                <span>Review AI Extracted Schedule</span>
                <span className="text-xs bg-vibrant-purple text-vibrant-purpleText font-mono px-2.5 py-0.5 rounded-full font-bold border border-vibrant-purpleBorder number-display">
                  {items.length} Items Extracted
                </span>
              </h2>
              <p className="text-xs text-caplen-muted font-medium">
                Please double-check dates and weight percentages before saving to dashboard.
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

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Course Title</label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Course Code</label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Instructor</label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase font-heading">Semester</label>
            <input
              type="text"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-caplen-navy focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-slate-200 bg-white mb-6">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-400 font-mono font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Title</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Due Date</th>
                <th className="py-3 px-3.5">Time</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Weight %</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-caplen-navy">
              {items.map((item, index) => {
                const hasDate = Boolean(item.dueDate);

                return (
                  <tr key={index} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3.5">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(index, 'title', e.target.value)}
                        className="w-full rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-bold text-caplen-navy focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3.5">
                      {hasDate ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          <CheckCircle2 className="h-3 w-3" /> Exact
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          <AlertCircle className="h-3 w-3" /> Date TBD
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => handleUpdateItem(index, 'dueDate', e.target.value)}
                        className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono text-caplen-navy focus:outline-none number-display"
                      />
                    </td>
                    <td className="py-2.5 px-3.5">
                      <input
                        type="text"
                        placeholder="HH:mm"
                        value={item.dueTime || ''}
                        onChange={(e) => handleUpdateItem(index, 'dueTime', e.target.value || null)}
                        className="w-20 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono text-caplen-navy focus:outline-none number-display"
                      />
                    </td>
                    <td className="py-2.5 px-3.5">
                      <select
                        value={item.type}
                        onChange={(e) => handleUpdateItem(index, 'type', e.target.value as AssignmentType)}
                        className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-bold text-caplen-navy focus:outline-none"
                      >
                        <option value="homework">Homework</option>
                        <option value="exam">Exam</option>
                        <option value="project">Project</option>
                        <option value="quiz">Quiz</option>
                        <option value="reading">Reading</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <input
                        type="number"
                        value={item.weightPercent !== null ? item.weightPercent : ''}
                        onChange={(e) =>
                          handleUpdateItem(
                            index,
                            'weightPercent',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-16 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono text-caplen-navy focus:outline-none number-display"
                      />
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => handleDeleteItem(index)}
                        aria-label={`Remove "${item.title}"`}
                        className="rounded p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-4 text-xs text-caplen-muted font-bold">
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1.5 text-vibrant-purpleText hover:underline transition-colors font-heading"
            >
              <Plus className="h-4 w-4" />
              <span>Add Missing Item</span>
            </button>
            <span>• Allocated Weight: <strong className="text-caplen-navy font-mono number-display">{totalWeight}%</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-full bg-slate-100 px-5 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-200 transition-colors font-heading"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSave}
              className="flex items-center gap-2 rounded-full bg-caplen-navy px-6 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-caplen-navyHover transition-all font-heading tracking-wide"
            >
              <CheckCircle2 className="h-4 w-4 text-vibrant-limeAccent" />
              <span>Confirm & Add Course</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
