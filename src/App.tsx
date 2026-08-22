import React, { useState, useEffect } from 'react';
import { Course, Assignment, TabType, StreakState, ExtractionResult, ExtractedAssignment, CoursePolicies } from './types';
import {
  getStoredCourses,
  saveCourses,
  getStoredAssignments,
  saveAssignments,
  getStoredStreak,
  recordStreakActivity
} from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { SyllabusUploader } from './components/SyllabusUploader';
import { ReviewModal } from './components/ReviewModal';
import { DashboardTimeline } from './components/DashboardTimeline';
import { CalendarView } from './components/CalendarView';
import { GradeCalculator } from './components/GradeCalculator';
import { CalendarSyncModal } from './components/CalendarSyncModal';
import { CourseDetailModal } from './components/CourseDetailModal';
import { exchangeCodeForTokens } from './utils/googleAuth';
import { saveGoogleCalendarAuth, getGoogleCalendarAuth } from './utils/storage';
import { fetchGoogleAccountProfile, saveGoogleUser } from './utils/googleCalendarLive';
import { deleteAssignmentsFromGoogleCalendar } from './utils/googleCalendarApi';

export const App: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [streak, setStreak] = useState<StreakState>({
    currentStreak: 1,
    bestStreak: 1,
    lastActiveDate: '',
    activeDates: []
  });
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Extraction Review Modal state
  const [activeExtraction, setActiveExtraction] = useState<ExtractionResult | null>(null);
  const [extractionColor, setExtractionColor] = useState<string>('#B5A6F8');

  // Calendar Sync Modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [googleOAuthError, setGoogleOAuthError] = useState<string | null>(null);
  const [googleConnectTick, setGoogleConnectTick] = useState(0);

  // Load initial data from localStorage
  useEffect(() => {
    const loadedCourses = getStoredCourses();
    setCourses(loadedCourses);

    getStoredAssignments().then((loadedAssignments) => {
      setAssignments(loadedAssignments);
    });

    const loadedStreak = getStoredStreak();
    setStreak(loadedStreak);
  }, []);

  // Handle Google OAuth redirect back to the app (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const redirectUri = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', redirectUri);
    setIsSyncModalOpen(true);

    exchangeCodeForTokens(code, redirectUri)
      .then(async ({ accessToken, refreshToken, expiresAt }) => {
        saveGoogleCalendarAuth({ accessToken, refreshToken, expiresAt, calendarId: null, events: {} });
        try {
          const profile = await fetchGoogleAccountProfile(accessToken);
          saveGoogleUser({ name: profile.name, email: profile.email, accessToken, expiresAt });
        } catch {
          // Identity display is best-effort; the real connection above already succeeded.
        }
        setGoogleConnectTick((tick) => tick + 1);
      })
      .catch((err) => {
        setGoogleOAuthError(err instanceof Error ? err.message : 'Failed to connect Google Calendar');
      });
  }, []);

  const updateCourses = (newCourses: Course[]) => {
    setCourses(newCourses);
    saveCourses(newCourses);
  };

  const refreshCoursesFromStorage = () => {
    setCourses(getStoredCourses());
  };

  const updateAssignments = (newAssignments: Assignment[]) => {
    setAssignments(newAssignments);
    saveAssignments(newAssignments);
  };

  const handleExtractionComplete = (result: ExtractionResult, color: string) => {
    setActiveExtraction(result);
    setExtractionColor(color);
  };

  const handleSaveExtractedCourse = (
    courseName: string,
    courseCode: string,
    color: string,
    instructor: string,
    semester: string,
    extractedItems: ExtractedAssignment[],
    policies: CoursePolicies
  ) => {
    const courseId = `c_${Date.now()}`;
    const newCourse: Course = {
      id: courseId,
      name: courseName,
      code: courseCode || 'COURSE',
      color: color,
      instructor: instructor,
      semester: semester,
      createdAt: new Date().toISOString(),
      policies
    };

    const newAssignments: Assignment[] = extractedItems.map((item, idx) => ({
      id: `a_${courseId}_${idx}`,
      courseId: courseId,
      courseName: courseCode || courseName,
      title: item.title,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      type: item.type,
      weightPercent: item.weightPercent,
      completed: false,
      color: color
    }));

    updateCourses([...courses, newCourse]);
    updateAssignments([...assignments, ...newAssignments]);

    const updatedStreak = recordStreakActivity();
    setStreak(updatedStreak);

    setActiveExtraction(null);
    setActiveTab('timeline');
  };

  const handleToggleComplete = (id: string) => {
    const updated = assignments.map((a) => {
      if (a.id === id) {
        return { ...a, completed: !a.completed };
      }
      return a;
    });
    updateAssignments(updated);

    const updatedStreak = recordStreakActivity();
    setStreak(updatedStreak);
  };

  const handleDeleteAssignment = (id: string) => {
    const updated = assignments.filter((a) => a.id !== id);
    updateAssignments(updated);
  };

  const handleDeleteCourse = async (courseId: string) => {
    const removedAssignmentIds = assignments.filter((a) => a.courseId === courseId).map((a) => a.id);
    const updatedCourses = courses.filter((c) => c.id !== courseId);
    const updatedAssignments = assignments.filter((a) => a.courseId !== courseId);
    updateCourses(updatedCourses);
    updateAssignments(updatedAssignments);

    // Best-effort: remove the corresponding events from Google Calendar right away.
    // If this fails (offline, revoked access, etc.) the deletion above already stuck —
    // the stale event records self-heal on the next manual "Sync now".
    if (getGoogleCalendarAuth() !== null && removedAssignmentIds.length > 0) {
      try {
        await deleteAssignmentsFromGoogleCalendar(removedAssignmentIds);
      } catch (err) {
        console.error('Failed to remove syllabus events from Google Calendar', err);
      }
    }
  };

  const handleUpdateScore = (assignmentId: string, score: number | null) => {
    const updated = assignments.map((a) => {
      if (a.id === assignmentId) {
        return { ...a, score };
      }
      return a;
    });
    updateAssignments(updated);
  };

  const handleUpdateWeight = (assignmentId: string, weightPercent: number | null) => {
    const updated = assignments.map((a) => {
      if (a.id === assignmentId) {
        return { ...a, weightPercent };
      }
      return a;
    });
    updateAssignments(updated);
  };

  const handleUpdateCoursePolicies = (courseId: string, policies: CoursePolicies) => {
    const updated = courses.map((c) => (c.id === courseId ? { ...c, policies } : c));
    updateCourses(updated);
  };

  return (
    <div className="min-h-screen flex bg-caplen-bg">
      {/* Caplen Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        streak={streak}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} refreshSignal={googleConnectTick} />

        <main className="flex-1 px-8 py-4 overflow-y-auto">
          {activeTab === 'timeline' && (
            <DashboardTimeline
              assignments={assignments}
              courses={courses}
              onToggleComplete={handleToggleComplete}
              onDeleteAssignment={handleDeleteAssignment}
              onNavigateToUpload={() => setActiveTab('upload')}
              onNavigateToCalendar={() => setActiveTab('calendar')}
              onDeleteCourse={handleDeleteCourse}
              onOpenCourse={(courseId) => setSelectedCourseId(courseId)}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView assignments={assignments} />
          )}

          {activeTab === 'upload' && (
            <SyllabusUploader onExtractionComplete={handleExtractionComplete} />
          )}

          {activeTab === 'calculator' && (
            <GradeCalculator
              courses={courses}
              assignments={assignments}
              onUpdateScore={handleUpdateScore}
              onUpdateWeight={handleUpdateWeight}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {activeExtraction && (
        <ReviewModal
          extraction={activeExtraction}
          color={extractionColor}
          onClose={() => setActiveExtraction(null)}
          onSave={handleSaveExtractedCourse}
        />
      )}

      {selectedCourseId && (
        <CourseDetailModal
          course={courses.find((c) => c.id === selectedCourseId)!}
          assignments={assignments.filter(
            (a) =>
              a.courseId === selectedCourseId ||
              a.courseName === courses.find((c) => c.id === selectedCourseId)?.name ||
              a.courseName === courses.find((c) => c.id === selectedCourseId)?.code
          )}
          onClose={() => setSelectedCourseId(null)}
          onToggleComplete={handleToggleComplete}
          onSavePolicies={(policies: CoursePolicies) => handleUpdateCoursePolicies(selectedCourseId, policies)}
        />
      )}

      {isSyncModalOpen && (
        <CalendarSyncModal
          assignments={assignments}
          onClose={() => {
            setIsSyncModalOpen(false);
            setGoogleOAuthError(null);
          }}
          oauthError={googleOAuthError}
          connectTick={googleConnectTick}
          onAssignmentsChanged={updateAssignments}
          onCoursesChanged={refreshCoursesFromStorage}
        />
      )}
    </div>
  );
};

export default App;
