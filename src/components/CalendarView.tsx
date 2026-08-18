import React, { useEffect, useRef, useState } from 'react';
import { Assignment } from '../types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle } from 'lucide-react';

interface CalendarViewProps {
  assignments: Assignment[];
}

type ViewMode = 'month' | 'week';

const HOUR_HEIGHT = 56; // px per hour row in week view
const WEEK_START_HOUR_SCROLL = 7; // auto-scroll week view to 7am on open
const DEFAULT_BLOCK_MINUTES = 60; // assumed duration for a timed deadline block

export const CalendarView: React.FC<CalendarViewProps> = ({ assignments }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const weekScrollRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end: endOfWeek(currentDate, { weekStartsOn: 0 })
  });

  const goNext = () => setCurrentDate((d) => (viewMode === 'month' ? addMonths(d, 1) : addWeeks(d, 1)));
  const goPrev = () => setCurrentDate((d) => (viewMode === 'month' ? subMonths(d, 1) : subWeeks(d, 1)));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const getAssignmentsForDay = (day: Date) => {
    return assignments.filter((item) => {
      try {
        return isSameDay(parseISO(item.dueDate), day);
      } catch (e) {
        return false;
      }
    });
  };

  useEffect(() => {
    if (viewMode === 'week' && weekScrollRef.current) {
      weekScrollRef.current.scrollTop = WEEK_START_HOUR_SCROLL * HOUR_HEIGHT;
    }
  }, [viewMode]);

  const selectedDayAssignments = selectedDay ? getAssignmentsForDay(selectedDay) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-caplen-navy flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-vibrant-purpleText" />
            <span>Coursework Schedule</span>
          </h1>
          <p className="text-xs text-caplen-muted mt-1 font-medium">
            Time-blocked view of every exam, assignment, and reading deadline — switch to Week to see the day laid out hour by hour.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / Week Switcher */}
          <div className="flex items-center rounded-full bg-white border border-slate-200 p-1 shadow-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`rounded-full px-3.5 py-1 text-xs font-extrabold transition-all font-heading ${
                viewMode === 'month' ? 'bg-caplen-navy text-white shadow-xs' : 'text-slate-500 hover:text-caplen-navy'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-full px-3.5 py-1 text-xs font-extrabold transition-all font-heading ${
                viewMode === 'week' ? 'bg-caplen-navy text-white shadow-xs' : 'text-slate-500 hover:text-caplen-navy'
              }`}
            >
              Week
            </button>
          </div>

          <button
            onClick={goToToday}
            className="rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs font-bold text-caplen-navy hover:bg-slate-50 transition-colors shadow-xs"
          >
            Today
          </button>
          <div className="flex items-center rounded-full bg-white border border-slate-200 p-1 shadow-xs">
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="rounded-full p-1 text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-bold font-mono text-caplen-navy whitespace-nowrap number-display">
              {viewMode === 'month'
                ? format(currentDate, 'MMMM yyyy')
                : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`}
            </span>
            <button
              onClick={goNext}
              aria-label="Next"
              className="rounded-full p-1 text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Month Grid */}
          <div className="lg:col-span-2 caplen-card p-6">
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 uppercase mb-3">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((day, idx) => {
                const dayAssignments = getAssignmentsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrentMonth
                        ? 'bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                        : 'bg-slate-100/30 border-slate-100 opacity-40'
                    } ${isSelected ? 'border-caplen-navy bg-white ring-2 ring-caplen-navy/10 shadow-md' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold number-display ${
                          isDayToday
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-caplen-navy text-white shadow-xs'
                            : isCurrentMonth
                            ? 'text-caplen-navy'
                            : 'text-slate-400'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayAssignments.length > 0 && (
                        <span className="text-[10px] font-bold text-vibrant-purpleText bg-vibrant-purple px-1.5 rounded-full border border-vibrant-purpleBorder number-display">
                          {dayAssignments.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1 overflow-hidden max-h-[50px]">
                      {dayAssignments.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="truncate text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-vibrant-peach text-vibrant-peachText border border-vibrant-peachBorder"
                        >
                          {item.title}
                        </div>
                      ))}
                      {dayAssignments.length > 2 && (
                        <div className="text-[9px] text-slate-400 font-semibold pl-1">
                          +{dayAssignments.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda */}
          <div className="caplen-card p-6 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-heading text-base font-extrabold text-caplen-navy flex items-center gap-2">
                  <Clock className="h-4 w-4 text-vibrant-purpleText" />
                  <span>
                    {selectedDay ? format(selectedDay, 'EEEE, MMMM d') : 'Select a date'}
                  </span>
                </h3>
                <p className="text-xs text-caplen-muted mt-0.5">
                  {selectedDayAssignments.length} task(s) scheduled
                </p>
              </div>

              {selectedDayAssignments.length > 0 ? (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {selectedDayAssignments.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase text-caplen-navy">
                          {item.courseName}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-vibrant-purpleText bg-vibrant-purple border border-vibrant-purpleBorder px-2 py-0.5 rounded-full">
                          {item.type}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-caplen-navy mb-1">{item.title}</h5>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono number-display">
                        <span>{item.dueTime ? `Time: ${item.dueTime}` : 'All Day'}</span>
                        {item.weightPercent !== null && (
                          <span>Weight: {item.weightPercent}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-medium">No deadlines scheduled for this date!</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-caplen-muted font-medium">
              💡 Click any date on the calendar grid to view scheduled coursework.
            </div>
          </div>
        </div>
      ) : (
        <WeekTimeGrid
          weekDays={weekDays}
          assignments={assignments}
          scrollRef={weekScrollRef}
        />
      )}
    </div>
  );
};

interface WeekTimeGridProps {
  weekDays: Date[];
  assignments: Assignment[];
  scrollRef: React.RefObject<HTMLDivElement>;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => h);

const formatHourLabel = (h: number) => {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const WeekTimeGrid: React.FC<WeekTimeGridProps> = ({ weekDays, assignments, scrollRef }) => {
  const getAssignmentsForDay = (day: Date) =>
    assignments.filter((item) => {
      try {
        return isSameDay(parseISO(item.dueDate), day);
      } catch {
        return false;
      }
    });

  return (
    <div className="caplen-card overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
        <div />
        {weekDays.map((day) => {
          const isDayToday = isToday(day);
          return (
            <div key={day.toISOString()} className="py-3 text-center border-l border-slate-100">
              <div className="text-[10px] font-bold uppercase text-slate-400">{format(day, 'EEE')}</div>
              <div
                className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold number-display ${
                  isDayToday ? 'bg-caplen-navy text-white font-extrabold' : 'text-caplen-navy'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day deadlines row */}
      <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
        <div className="py-2 pr-2 text-right text-[10px] font-bold text-slate-400 uppercase">All day</div>
        {weekDays.map((day) => {
          const allDayItems = getAssignmentsForDay(day).filter((item) => !item.dueTime);
          return (
            <div key={day.toISOString()} className="border-l border-slate-100 p-1 space-y-1 min-h-[36px]">
              {allDayItems.map((item) => (
                <div
                  key={item.id}
                  title={`${item.courseName}: ${item.title}`}
                  className={`truncate rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-caplen-navy ${
                    item.completed ? 'opacity-50 line-through' : ''
                  }`}
                  style={{ backgroundColor: item.color }}
                >
                  {item.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollRef} className="relative overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="grid" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
          {/* Hour gutter */}
          <div>
            {HOUR_LABELS.map((h) => (
              <div
                key={h}
                className="pr-2 text-right text-[10px] font-bold text-slate-400 number-display"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-1.5">{formatHourLabel(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const timedItems = getAssignmentsForDay(day).filter((item) => item.dueTime);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`relative border-l border-slate-100 ${isDayToday ? 'bg-caplen-navy/[0.03]' : ''}`}
              >
                {/* Hour gridlines */}
                {HOUR_LABELS.map((h) => (
                  <div key={h} className="border-t border-slate-100" style={{ height: HOUR_HEIGHT }} />
                ))}

                {/* Time blocks */}
                {timedItems.map((item) => {
                  const [hStr, mStr] = (item.dueTime as string).split(':');
                  const hour = parseInt(hStr, 10) || 0;
                  const minute = parseInt(mStr, 10) || 0;
                  const top = hour * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
                  const height = (DEFAULT_BLOCK_MINUTES / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={item.id}
                      title={`${item.courseName}: ${item.title} — ${item.dueTime}`}
                      className={`absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden shadow-xs border border-black/10 ${
                        item.completed ? 'opacity-50 line-through' : ''
                      }`}
                      style={{ top, height: Math.max(height, 24), backgroundColor: item.color }}
                    >
                      <div className="text-[10px] font-extrabold text-caplen-navy truncate leading-tight font-heading">
                        {item.title}
                      </div>
                      <div className="text-[9px] font-bold text-caplen-navy/80 truncate number-display">
                        {item.dueTime} · {item.courseName}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
