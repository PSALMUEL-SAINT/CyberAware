import { UserProgressState, QuizAttempt } from '../types';
import { evaluateBadges } from './scoring';

export const BASE_STORAGE_PREFIX = 'cyberaware_user_progress_v3';

export const CLEAN_EMPTY_PROGRESS: UserProgressState = {
  completedLessons: [],
  completedChecklists: {},
  quizAttempts: [],
  solvedScenarios: [],
  earnedBadges: [],
  streakDays: 0,
  lastVisitDate: new Date().toISOString().split('T')[0]
};

export const DEFAULT_DEMO_PROGRESS: UserProgressState = {
  completedLessons: ['phishing_101'],
  completedChecklists: {
    phishing_101: ['chk_hover_links', 'chk_sender_domain']
  },
  quizAttempts: [
    {
      id: 'demo_init_attempt',
      date: new Date(Date.now() - 86400000 * 2).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      score: 8,
      total: 10,
      percentage: 80,
      mode: 'practice',
      topicBreakdown: {
        'Phishing': { correct: 3, total: 3 },
        'Password Security': { correct: 2, total: 2 },
        'Multi-Factor Authentication': { correct: 1, total: 2 },
        'Social Engineering': { correct: 1, total: 2 },
        'Safe Browsing': { correct: 1, total: 1 }
      }
    }
  ],
  solvedScenarios: ['scenario_delivery_sms'],
  earnedBadges: ['first_step', 'quiz_starter', 'quiz_high_scorer'],
  streakDays: 3,
  lastVisitDate: new Date().toISOString().split('T')[0]
};

// Backwards compatibility alias for existing imports
export const DEFAULT_PROGRESS = DEFAULT_DEMO_PROGRESS;

/**
 * Returns a user-scoped storage key to ensure complete client-side data isolation
 */
export function getUserStorageKey(userId?: string): string {
  const safeId = (resolveActiveUserId(userId)).toLowerCase().trim();
  return `${BASE_STORAGE_PREFIX}_${safeId}`;
}

export function resolveActiveUserId(userId?: string): string {
  if (userId && typeof userId === 'string' && userId.trim() !== '') {
    return userId.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('cyberaware_auth_user_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed.id;
      }
    } catch {
      // fallback
    }
  }
  return '';
}

/**
 * Loads learning progress scoped strictly to the given user ID.
 * Newly registered users start completely clean with 0 progress.
 */
export function loadUserProgress(userId?: string): UserProgressState {
  if (typeof window === 'undefined') {
    return CLEAN_EMPTY_PROGRESS;
  }

  const effectiveId = resolveActiveUserId(userId);
  if (!effectiveId) {
    return CLEAN_EMPTY_PROGRESS;
  }
  const key = getUserStorageKey(effectiveId);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Destiny maintains initial seed progress for backwards compatibility
      if (effectiveId === 'destinyivienagbor2005@gmail.com') {
        saveUserProgress(DEFAULT_DEMO_PROGRESS, effectiveId);
        return DEFAULT_DEMO_PROGRESS;
      }
      // Any other user begins with a completely fresh, empty state
      saveUserProgress(CLEAN_EMPTY_PROGRESS, effectiveId);
      return CLEAN_EMPTY_PROGRESS;
    }

    const parsed = JSON.parse(raw) as UserProgressState;
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedChecklists: parsed.completedChecklists && typeof parsed.completedChecklists === 'object' ? parsed.completedChecklists : {},
      quizAttempts: Array.isArray(parsed.quizAttempts) ? parsed.quizAttempts : [],
      solvedScenarios: Array.isArray(parsed.solvedScenarios) ? parsed.solvedScenarios : [],
      earnedBadges: Array.isArray(parsed.earnedBadges) ? parsed.earnedBadges : [],
      streakDays: typeof parsed.streakDays === 'number' ? parsed.streakDays : 0,
      lastVisitDate: parsed.lastVisitDate || new Date().toISOString().split('T')[0]
    };
  } catch (err) {
    console.error(`Error reading progress for user ${effectiveId}:`, err);
    return effectiveId === 'destinyivienagbor2005@gmail.com' ? DEFAULT_DEMO_PROGRESS : CLEAN_EMPTY_PROGRESS;
  }
}

/**
 * Saves user progress scoped strictly to the target user's isolated storage key.
 */
export function saveUserProgress(state: UserProgressState, userId?: string): void {
  if (typeof window === 'undefined') return;
  const effectiveId = resolveActiveUserId(userId);
  if (!effectiveId) return;
  const key = getUserStorageKey(effectiveId);

  try {
    // Automatically recalculate badges
    const updatedBadges = evaluateBadges(state);
    const updatedState = { ...state, earnedBadges: updatedBadges };
    localStorage.setItem(key, JSON.stringify(updatedState));
  } catch (err) {
    console.error(`Error writing user progress for ${effectiveId}:`, err);
  }
}

export function toggleLessonCompletion(lessonId: string, userId?: string): UserProgressState {
  const current = loadUserProgress(userId);
  const exists = current.completedLessons.includes(lessonId);
  const updatedLessons = exists
    ? current.completedLessons.filter(id => id !== lessonId)
    : [...current.completedLessons, lessonId];

  const updated: UserProgressState = {
    ...current,
    completedLessons: updatedLessons
  };
  saveUserProgress(updated, userId);
  return loadUserProgress(userId);
}

export function toggleChecklist(lessonId: string, itemId: string, userId?: string): UserProgressState {
  const current = loadUserProgress(userId);
  const existingItems = current.completedChecklists[lessonId] || [];
  const exists = existingItems.includes(itemId);
  const updatedItems = exists
    ? existingItems.filter(id => id !== itemId)
    : [...existingItems, itemId];

  const updated: UserProgressState = {
    ...current,
    completedChecklists: {
      ...current.completedChecklists,
      [lessonId]: updatedItems
    }
  };
  saveUserProgress(updated, userId);
  return loadUserProgress(userId);
}

export function recordQuizAttempt(attempt: QuizAttempt, userId?: string): UserProgressState {
  const current = loadUserProgress(userId);
  // Filter out any previous version of this same attempt ID to prevent duplicates
  const filtered = current.quizAttempts.filter(a => a.id !== attempt.id);
  const updatedAttempts = [attempt, ...filtered];
  const updated: UserProgressState = {
    ...current,
    quizAttempts: updatedAttempts
  };
  saveUserProgress(updated, userId);
  return loadUserProgress(userId);
}

/**
 * Synchronizes the frontend state and local cache with server-authoritative attempts for a user.
 */
export function syncCachedQuizAttempts(attempts: QuizAttempt[], userId?: string): UserProgressState {
  const current = loadUserProgress(userId);
  const updated: UserProgressState = {
    ...current,
    quizAttempts: attempts
  };
  saveUserProgress(updated, userId);
  return loadUserProgress(userId);
}

export function recordSolvedScenario(scenarioId: string, userId?: string): UserProgressState {
  const current = loadUserProgress(userId);
  if (current.solvedScenarios.includes(scenarioId)) {
    return current;
  }
  const updated: UserProgressState = {
    ...current,
    solvedScenarios: [...current.solvedScenarios, scenarioId]
  };
  saveUserProgress(updated, userId);
  return loadUserProgress(userId);
}

export function resetAllProgress(userId?: string): UserProgressState {
  const blankState: UserProgressState = {
    completedLessons: [],
    completedChecklists: {},
    quizAttempts: [],
    solvedScenarios: [],
    earnedBadges: [],
    streakDays: 0,
    lastVisitDate: new Date().toISOString().split('T')[0]
  };
  saveUserProgress(blankState, userId);
  return blankState;
}

/**
 * Clears user-specific cached progress from local storage when logging out
 */
export function clearUserLocalData(userId?: string): void {
  if (typeof window === 'undefined') return;
  const effectiveId = resolveActiveUserId(userId);
  const key = getUserStorageKey(effectiveId);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
