import React, { useState } from 'react';
import { Assignment, Course } from '../types';
import {
  BookOpen,
  CheckSquare,
  Square,
  Trash2,
  ListChecks,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import {
  format,
  parseISO,
  isBefore,
  startOfDay,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths
} from 'date-fns';

const formatDueDate = (dueDate: string, fmt: string): string => {
  if (!dueDate) return 'Date TBD';
  try {
    return format(parseISO(dueDate), fmt);
  } catch {
    return 'Date TBD';
  }
};

interface DashboardTimelineProps {
  assignments: Assignment[];
  courses: Course[];
  onToggleComplete: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onNavigateToUpload: () => void;
  onNavigateToCalendar: () => void;
  onDeleteCourse?: (courseId: string) => void;
  onOpenCourse?: (courseId: string) => void;
  searchQuery: string;
}

export const DashboardTimeline: React.FC<DashboardTimelineProps> = ({
  assignments,
  courses,
  onToggleComplete,
  onDeleteAssignment,
  onNavigateToUpload,
  onNavigateToCalendar,
  onDeleteCourse,
  onOpenCourse,
  searchQuery
}) => {
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date());
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredAssignments = assignments.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCourse = item.courseName.toLowerCase().includes(q);
      if (!matchTitle && !matchCourse) return false;
    }
    return true;
  });

  const todayStart = startOfDay(new Date());
  const completedCount = assignments.filter((a) => a.completed).length;
  const overdueCount = assignments.filter((a) => {
    if (a.completed) return false;
    try {
      return isBefore(startOfDay(parseISO(a.dueDate)), todayStart);
    } catch {
      return false;
    }
  }).length;

  const miniMonthStart = startOfMonth(miniCalendarMonth);
  const miniMonthEnd = endOfMonth(miniMonthStart);
  const miniDays = eachDayOfInterval({
    start: startOfWeek(miniMonthStart, { weekStartsOn: 0 }),
    end: endOfWeek(miniMonthEnd, { weekStartsOn: 0 })
  });

  const hasAssignmentsOn = (day: Date) =>
    assignments.some((item) => {
      try {
        return isSameDay(parseISO(item.dueDate), day);
      } catch {
        return false;
      }
    });

  // Solid, high-contrast vibrant card palettes for max readability
  const courseCardThemes = [
    { bg: '#F3E8FF', border: '#C084FC', text: '#3B0764', badge: '01' },
    { bg: '#FEF3C7', border: '#FBBF24', text: '#78350F', badge: '02' },
    { bg: '#ECFCCB', border: '#A3E635', text: '#1A2E05', badge: '03' },
    { bg: '#CFFAFE', border: '#22D3EE', text: '#164E63', badge: '04' },
  ];

  const confirmDeleteCourse = () => {
    if (courseToDelete && onDeleteCourse) {
      onDeleteCourse(courseToDelete.id);
      setCourseToDelete(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. TOP SECTION: "My progress" & Hero Banner */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-2xl font-extrabold text-caplen-navy">
            My Progress
          </h2>
          <button
            onClick={onNavigateToUpload}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-extrabold text-caplen-navy shadow-xs border border-slate-300 hover:border-caplen-navy transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-caplen-navy" />
            <span>Import Syllabus</span>
          </button>
        </div>

        {/* Hero Banner Box */}
        <div className="caplen-navy-card p-8 text-white relative shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center overflow-hidden">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-vibrant-purpleAccent/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-vibrant-cyanAccent/20 blur-3xl pointer-events-none" />

          {/* Left Text */}
          <div className="lg:col-span-5 space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold backdrop-blur-md text-white border border-white/20">
              <span>Academic Dashboard</span>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold leading-tight text-white tracking-tight">
              You have completed <span className="text-vibrant-limeAccent number-display">{completedCount}</span> coursework task{completedCount === 1 ? '' : 's'}!
            </h1>
            <button
              onClick={onNavigateToUpload}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-extrabold text-caplen-navy hover:bg-slate-100 transition-all shadow-md font-heading tracking-wide"
            >
              <span>ADD COURSE SYLLABUS</span>
              <ArrowUpRight className="h-4 w-4 text-caplen-navy" />
            </button>
          </div>

          {/* Right High-Contrast Course Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
            {courses.map((course, index) => {
              const theme = courseCardThemes[index % courseCardThemes.length];
              const courseItems = assignments.filter((a) => a.courseId === course.id || a.courseName === course.name || a.courseName === course.code);
              const courseDone = courseItems.filter((a) => a.completed).length;
              const pct = courseItems.length > 0 ? Math.round((courseDone / courseItems.length) * 100) : 0;

              return (
                <div
                  key={course.id}
                  role={onOpenCourse ? 'button' : undefined}
                  tabIndex={onOpenCourse ? 0 : undefined}
                  onClick={() => onOpenCourse?.(course.id)}
                  style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
                  className="border-2 rounded-3xl p-5 flex flex-col justify-between h-52 shadow-md relative group hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-extrabold">
                    <span className="number-display" style={{ color: theme.text }}>{theme.badge}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCourseToDelete({ id: course.id, name: course.name });
                      }}
                      title={`Remove ${course.name}`}
                      aria-label={`Remove course ${course.name}`}
                      className="p-1 rounded-full bg-black/10 hover:bg-rose-600 hover:text-white transition-all text-caplen-navy"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="h-9 w-9 rounded-2xl bg-black/10 border border-black/15 flex items-center justify-center mb-3">
                      <BookOpen className="h-4.5 w-4.5" style={{ color: theme.text }} />
                    </div>
                    <h4 className="font-heading text-base font-extrabold leading-snug line-clamp-2" style={{ color: theme.text }}>
                      {course.name}
                    </h4>
                    <p className="text-[11px] font-extrabold opacity-90 mt-1 number-display" style={{ color: theme.text }}>
                      {courseItems.length} items | {pct}% completed
                    </p>
                  </div>

                  <div className="w-full bg-black/15 rounded-full h-2 overflow-hidden border border-black/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: theme.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Course Deletion Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <button
                onClick={() => setCourseToDelete(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <h3 className="font-heading text-lg font-extrabold text-caplen-navy">Remove Course?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Are you sure you want to remove <strong className="text-caplen-navy">{courseToDelete.name}</strong> and all of its associated assignments from your dashboard?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setCourseToDelete(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-200 transition-colors font-heading"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCourse}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700 transition-colors shadow-sm font-heading"
              >
                Yes, Remove Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MIDDLE SECTION: "Statistics" */}
      <div>
        <h2 className="font-heading text-2xl font-extrabold text-caplen-navy mb-4">
          Statistics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="caplen-card p-6 flex flex-col justify-between border border-slate-200">
            <span className="font-heading text-4xl font-extrabold text-caplen-navy number-display">
              {assignments.length}
            </span>
            <span className="text-xs font-extrabold text-slate-700 mt-2">
              Total Course Deadlines
            </span>
          </div>

          <div className="caplen-card p-6 flex flex-col justify-between border border-slate-200">
            <span className={`font-heading text-4xl font-extrabold number-display ${overdueCount > 0 ? 'text-rose-600' : 'text-caplen-navy'}`}>
              {overdueCount}
            </span>
            <span className="text-xs font-extrabold text-slate-700 mt-2">
              Overdue Assignments
            </span>
          </div>

          <div className="caplen-card p-6 flex items-center justify-between border border-slate-200">
            <div>
              <span className="font-heading text-4xl font-extrabold text-caplen-navy number-display">
                {completedCount}
              </span>
              <span className="text-xs font-extrabold text-slate-700 block mt-2">
                Completed Tasks
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-vibrant-lime flex items-center justify-center text-caplen-navy shrink-0 border border-vibrant-limeBorder shadow-xs">
              <ListChecks className="h-6 w-6 text-caplen-navy" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. BOTTOM SECTION: "My Assignments" & Mini Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left List: My Assignments */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-extrabold text-caplen-navy">
              My Assignments ({filteredAssignments.length})
            </h2>
            {filteredAssignments.length > 6 && (
              <button
                onClick={() => setShowAllAssignments((v) => !v)}
                className="text-xs font-extrabold text-caplen-navy hover:bg-slate-200 transition-colors bg-vibrant-purple px-3 py-1 rounded-full border border-vibrant-purpleBorder"
              >
                {showAllAssignments ? 'Show less' : 'View all'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(showAllAssignments ? filteredAssignments : filteredAssignments.slice(0, 6)).map((item, idx) => {
              const bgColors = ['bg-vibrant-purple', 'bg-vibrant-peach', 'bg-vibrant-lime', 'bg-vibrant-cyan'];

              return (
                <div
                  key={item.id}
                  className="caplen-card p-4 flex items-center justify-between gap-4 border border-slate-200 hover:border-caplen-navy hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => onToggleComplete(item.id)}
                      aria-label={item.completed ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
                      className="text-caplen-navy hover:text-emerald-600 transition-colors shrink-0"
                    >
                      {item.completed ? (
                        <CheckSquare className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Square className="h-5 w-5 text-caplen-navy" />
                      )}
                    </button>

                    <div className={`h-11 w-11 rounded-2xl ${bgColors[idx % bgColors.length]} flex items-center justify-center shrink-0 text-caplen-navy border border-black/10`}>
                      <BookOpen className="h-5 w-5 text-caplen-navy" />
                    </div>

                    <div>
                      <h4 className={`text-sm font-extrabold ${item.completed ? 'line-through text-slate-500 font-medium' : 'text-caplen-navy'}`}>
                        {item.title}
                      </h4>
                      <p className="text-xs font-extrabold text-slate-700">
                        {item.courseName} • <span className="capitalize font-extrabold">{item.type}</span>
                        {item.weightPercent ? ` • ${item.weightPercent}%` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-extrabold text-caplen-navy number-display bg-slate-100 border border-slate-300 px-3 py-1 rounded-full shadow-2xs">
                      {formatDueDate(item.dueDate, 'd MMM, yyyy')}
                    </span>
                    <button
                      onClick={() => onDeleteAssignment(item.id)}
                      aria-label={`Delete "${item.title}"`}
                      className="text-caplen-navy hover:text-rose-600 p-1 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Mini Calendar Grid */}
        <div className="lg:col-span-5 space-y-6">
          <div className="caplen-card p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-extrabold text-caplen-navy">
                {format(miniCalendarMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMiniCalendarMonth((m) => subMonths(m, 1))}
                  aria-label="Previous month"
                  className="p-1 rounded-lg hover:bg-slate-100 text-caplen-navy"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setMiniCalendarMonth((m) => addMonths(m, 1))}
                  aria-label="Next month"
                  className="p-1 rounded-lg hover:bg-slate-100 text-caplen-navy"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-extrabold text-slate-700 uppercase">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold">
              {miniDays.map((day, i) => {
                const isTodayActive = isToday(day);
                const isCurrentMonth = isSameMonth(day, miniCalendarMonth);
                const hasItems = hasAssignmentsOn(day);

                return (
                  <button
                    key={i}
                    onClick={onNavigateToCalendar}
                    className={`h-9 w-full rounded-xl flex flex-col items-center justify-center relative transition-all ${
                      !isCurrentMonth
                        ? 'text-slate-300'
                        : isTodayActive
                        ? 'bg-caplen-navy text-white font-extrabold shadow-sm'
                        : 'text-caplen-navy hover:bg-slate-100'
                    }`}
                  >
                    <span>{format(day, 'd')}</span>
                    {hasItems && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full absolute bottom-1 ${
                          isTodayActive ? 'bg-vibrant-limeAccent' : 'bg-caplen-navy'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
