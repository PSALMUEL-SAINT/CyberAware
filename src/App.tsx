import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { ActiveTab, UserProgressState, QuizAttempt } from './types';
import { 
  loadUserProgress, 
  saveUserProgress,
  toggleLessonCompletion, 
  toggleChecklist, 
  recordQuizAttempt, 
  recordSolvedScenario, 
  resetAllProgress,
  syncCachedQuizAttempts,
  CLEAN_EMPTY_PROGRESS
} from './utils/storage';
import { 
  CURRENT_DEFAULT_USER, 
  fetchUserAttempts, 
  submitUserAttempt,
  fetchUserProgressFromServer,
  saveUserProgressToServer
} from './services/assessmentApi';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { LearningCenterView } from './components/LearningCenterView';
import { QuizView } from './components/QuizView';
import { PhishingDetectiveView } from './components/PhishingDetectiveView';
import { ProgressView } from './components/ProgressView';
import { GroupsView } from './components/GroupsView';
import { LeaderboardView } from './components/LeaderboardView';
import { AboutView } from './components/AboutView';
import { LandingView } from './components/LandingView';
import { getStoredUser } from './services/authApi';

function CyberAwareApp() {
  const { user, isAuthModalOpen, closeAuthModal, authModalMode, logout, switchUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab | null;
      const stored = getStoredUser();
      if (stored) {
        if (tabParam && ['dashboard', 'learning', 'lessons', 'quiz', 'detective', 'progress', 'groups', 'leaderboard', 'about', 'landing'].includes(tabParam)) {
          return tabParam;
        }
        return 'dashboard';
      } else {
        if (tabParam && ['learning', 'lessons', 'quiz', 'detective', 'groups', 'leaderboard', 'about'].includes(tabParam)) {
          return tabParam;
        }
        return 'landing';
      }
    }
    return 'landing';
  });
  const [learningSubTarget, setLearningSubTarget] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string>(() => user?.id || '');
  const [progress, setProgress] = useState<UserProgressState>(() => user?.id ? loadUserProgress(user.id) : CLEAN_EMPTY_PROGRESS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Synchronize state when authenticated user identity changes or logs out
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
      loadAndSyncUserData(user.id);
      setActiveTab(prev => (prev === 'landing' ? 'dashboard' : prev));
    } else {
      // User logged out: clear in-memory state and ensure no previous user data remains visible
      setCurrentUserId('');
      setProgress(CLEAN_EMPTY_PROGRESS);
      setActiveTab(prev => {
        const protectedTabs: ActiveTab[] = ['dashboard', 'progress', 'profile', 'settings'];
        if (protectedTabs.includes(prev)) {
          return 'landing';
        }
        return prev;
      });
    }
  }, [user?.id]);

  // Load user progress and server attempts with strict identity isolation
  const loadAndSyncUserData = async (userId: string) => {
    if (!userId) return;
    setIsSyncing(true);

    // 1. Immediately load user-scoped local progress for instant responsiveness
    const local = loadUserProgress(userId);
    setProgress(local);

    // 2. Fetch server-authoritative progress and attempts in parallel
    try {
      const [serverProg, serverAttempts] = await Promise.all([
        fetchUserProgressFromServer(userId),
        fetchUserAttempts(userId)
      ]);

      let merged: UserProgressState = { ...local };
      if (serverProg) {
        merged = {
          completedLessons: Array.isArray(serverProg.completedLessons) ? serverProg.completedLessons : local.completedLessons,
          completedChecklists: serverProg.completedChecklists || local.completedChecklists,
          quizAttempts: serverAttempts || serverProg.quizAttempts || local.quizAttempts,
          solvedScenarios: Array.isArray(serverProg.solvedScenarios) ? serverProg.solvedScenarios : local.solvedScenarios,
          earnedBadges: Array.isArray(serverProg.earnedBadges) ? serverProg.earnedBadges : local.earnedBadges,
          streakDays: typeof serverProg.streakDays === 'number' ? serverProg.streakDays : local.streakDays,
          lastVisitDate: serverProg.lastVisitDate || local.lastVisitDate
        };
      } else if (serverAttempts) {
        merged = {
          ...local,
          quizAttempts: serverAttempts
        };
      }

      saveUserProgress(merged, userId);
      setProgress(merged);
    } catch (e) {
      console.warn('Error syncing user progress from backend:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Check URL params for quick navigation if present (e.g. ?tab=quiz or ?autostart=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab | null;
      if (tabParam) {
        const protectedTabs: ActiveTab[] = ['dashboard', 'progress', 'profile', 'settings'];
        if (!user && protectedTabs.includes(tabParam)) {
          setActiveTab('landing');
        } else if (['landing', 'dashboard', 'learning', 'lessons', 'quiz', 'detective', 'progress', 'groups', 'leaderboard', 'about'].includes(tabParam)) {
          setActiveTab(tabParam);
        }
      }
    }
  }, [user]);

  const handleNavigate = (tab: ActiveTab, subTarget?: string) => {
    const protectedTabs: ActiveTab[] = ['dashboard', 'progress', 'profile', 'settings'];
    if (!user && protectedTabs.includes(tab)) {
      setActiveTab('landing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setActiveTab(tab);
    setLearningSubTarget(subTarget);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if ((tab === 'progress' || tab === 'dashboard') && currentUserId) {
      loadAndSyncUserData(currentUserId);
    }
  };

  const handleToggleLesson = async (lessonId: string) => {
    if (!currentUserId) return;
    const updated = toggleLessonCompletion(lessonId, currentUserId);
    setProgress(updated);
    await saveUserProgressToServer(currentUserId, updated);
  };

  const handleToggleChecklist = async (lessonId: string, itemId: string) => {
    if (!currentUserId) return;
    const updated = toggleChecklist(lessonId, itemId, currentUserId);
    setProgress(updated);
    await saveUserProgressToServer(currentUserId, updated);
  };

  const handleSaveQuizAttempt = async (attempt: QuizAttempt) => {
    if (!currentUserId) return;
    // 1. Save optimistic client state scoped to current user
    const optimisticAttempt: QuizAttempt = {
      ...attempt,
      userId: currentUserId
    };
    const updated = recordQuizAttempt(optimisticAttempt, currentUserId);
    setProgress(updated);

    // 2. Persist to server backend (server-data/attempts.json)
    try {
      const rawAnswers = attempt.questionAnswers;
      const questionsPayload: Array<{ questionId: string; selectedOptions: number[] }> = Array.isArray(rawAnswers)
        ? rawAnswers
        : rawAnswers
        ? Object.entries(rawAnswers).map(([questionId, selectedOptions]) => ({ questionId, selectedOptions }))
        : [];

      const submission = {
        id: attempt.id,
        attemptId: attempt.id,
        userId: currentUserId,
        mode: attempt.mode === 'exam' ? ('exam' as const) : ('practice' as const),
        difficulty: attempt.difficulty,
        categoryFilter: attempt.categoryFilter,
        completionDuration: attempt.completionDuration || 60,
        questions: questionsPayload
      };

      const result = await submitUserAttempt(submission);
      if (result.success && result.attempt) {
        // Replace optimistic record with server-verified record
        const serverSynced = recordQuizAttempt(result.attempt, currentUserId);
        setProgress(serverSynced);
        await saveUserProgressToServer(currentUserId, serverSynced);
      } else if (result.isDuplicate) {
        console.warn('Attempt already recorded on server.');
      } else if (result.error) {
        console.error('Server attempt validation error:', result.error);
      }
    } catch (err) {
      console.warn('Backend attempt submission network failure:', err);
    }
  };

  const handleSolveScenario = async (scenarioId: string) => {
    if (!currentUserId) return;
    const updated = recordSolvedScenario(scenarioId, currentUserId);
    setProgress(updated);
    await saveUserProgressToServer(currentUserId, updated);
  };

  const handleResetProgress = async () => {
    if (!currentUserId) return;
    const reset = resetAllProgress(currentUserId);
    setProgress(reset);
    await saveUserProgressToServer(currentUserId, reset);
  };

  if (activeTab === 'landing') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B132B]">
        <LandingView onNavigate={handleNavigate} />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors">
      {/* Left Sidebar on Desktop & Mobile Header/Drawer */}
      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={handleNavigate} 
        progress={progress} 
        currentUserId={currentUserId}
        onChangeUser={switchUser}
        onLogout={() => {
          handleNavigate('landing');
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView 
              progress={progress} 
              onNavigate={handleNavigate} 
              currentUserId={currentUserId}
            />
          )}

          {(activeTab === 'learning' || activeTab === 'lessons') && (
            <LearningCenterView 
              progress={progress}
              initialLessonId={learningSubTarget}
              onToggleLesson={handleToggleLesson}
              onToggleChecklist={handleToggleChecklist}
              onGoToDetective={() => handleNavigate('detective')}
              onGoToQuiz={() => handleNavigate('quiz')}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizView 
              onSaveAttempt={handleSaveQuizAttempt}
              onGoToLearning={(lessonId) => handleNavigate('learning', lessonId)}
              quizAttempts={progress.quizAttempts}
              currentUserId={currentUserId}
              onChangeUser={switchUser}
            />
          )}

          {activeTab === 'detective' && (
            <PhishingDetectiveView 
              solvedScenarios={progress.solvedScenarios}
              onSolveScenario={handleSolveScenario}
            />
          )}

          {(activeTab === 'progress' || activeTab === 'profile' || activeTab === 'settings') && (
            <ProgressView 
              progress={progress}
              onResetProgress={handleResetProgress}
              onNavigate={handleNavigate}
              currentUserId={currentUserId}
              onChangeUser={switchUser}
              onRefreshAttempts={() => loadAndSyncUserData(currentUserId)}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsView 
              currentUserId={currentUserId}
              onChangeUser={switchUser}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'leaderboard' && (
            <LeaderboardView 
              currentUserId={currentUserId}
              onChangeUser={switchUser}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'about' && (
            <AboutView 
              onNavigate={handleNavigate}
            />
          )}
        </main>

        {/* Clean, Non-intrusive Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center space-x-2">
              <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>CyberAware Educational Awareness Platform</span>
            </div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={() => handleNavigate('about')} 
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                About & Educational Disclaimer
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Complete Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CyberAwareApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
