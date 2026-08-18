import { Assignment } from '../types';

export function generateICSContent(assignments: Assignment[], title = 'Syllaba Course Schedule'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Syllaba AI Syllabus Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${title}`
  ];

  assignments.forEach((item) => {
    const cleanDate = item.dueDate.replace(/-/g, ''); // YYYYMMDD
    const timeStr = item.dueTime ? item.dueTime.replace(':', '') + '00' : '235900';
    const startDT = `${cleanDate}T${timeStr}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:syllaba_${item.id}@syllaba.app`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    lines.push(`DTSTART:${startDT}`);
    lines.push(`DTEND:${startDT}`);
    lines.push(`SUMMARY:[${item.courseName}] ${item.title}`);
    lines.push(`DESCRIPTION:${item.courseName} - ${item.type.toUpperCase()} (Weight: ${item.weightPercent ? item.weightPercent + '%' : 'N/A'})`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICSFile(assignments: Assignment[], filename = 'Syllaba_Schedule.ics'): void {
  const content = generateICSContent(assignments);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarUrl(assignment: Assignment): string {
  const cleanDate = assignment.dueDate.replace(/-/g, '');
  const timeStr = assignment.dueTime ? assignment.dueTime.replace(':', '') + '00' : '235900';
  const startDT = `${cleanDate}T${timeStr}`;
  const endDT = `${cleanDate}T${timeStr}`;

  const details = encodeURIComponent(
    `Course: ${assignment.courseName}\nType: ${assignment.type.toUpperCase()}\nWeight: ${assignment.weightPercent || 'N/A'}%`
  );
  const title = encodeURIComponent(`[${assignment.courseName}] ${assignment.title}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDT}/${endDT}&details=${details}`;
}
