import { QuizQuestion, QuestionDifficulty, QuizAttempt } from '../types';
import { 
  selectAssessmentQuestions, 
  UserAssessmentHistory, 
  AssessmentSelectionParams, 
  AssessmentSelectionResult 
} from '../utils/assessmentSelection';
import { 
  AssessmentSubmissionPayload, 
  calculateVerifiedAssessmentScore 
} from '../utils/assessmentAttempts';
import { getAllQuestions, saveQuestion } from './questionDb';
import { getStoredUser } from './authApi';

const LOCAL_USER_HISTORY_KEY = 'cyberaware_user_assessment_history_v1';
const LOCAL_CACHED_ATTEMPTS_KEY = 'cyberaware_cached_attempts_v1';
export const CURRENT_DEFAULT_USER = 'destinyivienagbor2005@gmail.com';

/**
 * Returns authentication headers strictly derived from the active server-issued session token.
 * Never falls back to static demo tokens or synthesized placeholder tokens.
 */
export function getDemoAuthHeaders(userId?: string): Record<string, string> {
  let storedToken: string | null = null;
  let storedUserId: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      storedToken = localStorage.getItem('cyberaware_auth_token_v1');
      const rawUser = localStorage.getItem('cyberaware_auth_user_v1');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.id) storedUserId = parsed.id;
      }
    } catch {
      // ignore storage errors
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (!storedToken) {
    return headers;
  }

  const requestedId = userId ? userId.toLowerCase().trim() : '';
  const activeId = storedUserId ? storedUserId.toLowerCase().trim() : '';

  if (!requestedId || (activeId && requestedId === activeId)) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  return headers;
}

/**
 * Fetches user learning progress from the server (authoritative persistence)
 */
export async function fetchUserProgressFromServer(userId?: string): Promise<any | null> {
  const effectiveUserId = (userId && userId.trim() !== '') ? userId.trim() : (typeof window !== 'undefined' ? (getStoredUser()?.id || '') : '');
  if (!effectiveUserId) return null;

  try {
    const headers = getDemoAuthHeaders(effectiveUserId);
    const res = await fetch(`/api/user/progress?userId=${encodeURIComponent(effectiveUserId)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.progress) {
        return data.progress;
      }
    }
  } catch (err) {
    console.warn('Backend progress API unavailable, using local cache:', err);
  }
  return null;
}

/**
 * Saves user learning progress to the server (authoritative persistence)
 */
export async function saveUserProgressToServer(userId: string, progress: any): Promise<boolean> {
  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch('/api/user/progress', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, progress })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to persist user progress to server:', err);
    return false;
  }
}


/**
 * Gets cached user assessment history from localStorage
 */
export function getLocalUserHistory(userId = CURRENT_DEFAULT_USER): UserAssessmentHistory {
  if (typeof window === 'undefined') {
    return {
      userId,
      seenQuestionIds: [],
      answeredQuestionIds: [],
      answeredResults: {},
      flaggedQuestionIds: []
    };
  }
  try {
    const raw = localStorage.getItem(`${LOCAL_USER_HISTORY_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local user history', e);
  }
  return {
    userId,
    seenQuestionIds: [],
    answeredQuestionIds: [],
    answeredResults: {},
    flaggedQuestionIds: []
  };
}

/**
 * Saves cached user assessment history to localStorage
 */
export function saveLocalUserHistory(history: UserAssessmentHistory): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_USER_HISTORY_KEY}_${history.userId}`, JSON.stringify(history));
  } catch (e) {
    console.warn('Error persisting local user history', e);
  }
}

/**
 * Fetches user question history from server (with localStorage fallback)
 */
export async function fetchUserHistory(userId = CURRENT_DEFAULT_USER): Promise<UserAssessmentHistory> {
  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch(`/api/user/history?userId=${encodeURIComponent(userId)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.history) {
        saveLocalUserHistory(data.history);
        return data.history;
      }
    }
  } catch (err) {
    console.warn('Backend history API unavailable, using local cache:', err);
  }
  return getLocalUserHistory(userId);
}

/**
 * Records newly presented, answered, and flagged questions to server
 */
export async function recordUserAssessmentProgress(
  userId = CURRENT_DEFAULT_USER,
  presentedIds: string[] = [],
  answeredUpdates: Record<string, { isCorrect: boolean; selectedOptions: number[]; timestamp: string }> = {},
  flaggedIds: string[] = []
): Promise<UserAssessmentHistory> {
  // Update local cache first
  const current = getLocalUserHistory(userId);
  for (const id of presentedIds) {
    if (!current.seenQuestionIds.includes(id)) {
      current.seenQuestionIds.push(id);
    }
  }
  for (const [id, res] of Object.entries(answeredUpdates)) {
    if (!current.answeredQuestionIds.includes(id)) {
      current.answeredQuestionIds.push(id);
    }
    current.answeredResults[id] = res;
  }
  if (flaggedIds.length > 0) {
    current.flaggedQuestionIds = Array.from(new Set([...current.flaggedQuestionIds, ...flaggedIds]));
  }
  saveLocalUserHistory(current);

  // Sync with server API
  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch('/api/user/history/record', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, presentedIds, answeredUpdates, flaggedIds })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.history) {
        saveLocalUserHistory(data.history);
        return data.history;
      }
    }
  } catch (e) {
    console.warn('Server sync skipped for assessment progress:', e);
  }

  return current;
}

/**
 * Selects assessment questions from server (or engine fallback)
 */
export async function requestAssessmentSelection(
  params: AssessmentSelectionParams & { userId?: string }
): Promise<AssessmentSelectionResult> {
  const userId = params.userId || CURRENT_DEFAULT_USER;

  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch('/api/assessment/select', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...params, userId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        // Also sync local history with delivered questions
        if (params.mode === 'assessment' && data.result.questions?.length > 0) {
          const presented = data.result.questions.map((q: QuizQuestion) => q.id);
          recordUserAssessmentProgress(userId, presented);
        }
        return data.result;
      }
    }
  } catch (err) {
    console.warn('Backend selection API unavailable, running client engine:', err);
  }

  // Fallback to client selection engine
  const all = await getAllQuestions();
  const history = getLocalUserHistory(userId);
  const result = selectAssessmentQuestions(all, history, params);

  if (params.mode === 'assessment' && result.questions.length > 0) {
    const presented = result.questions.map(q => q.id);
    recordUserAssessmentProgress(userId, presented);
  }

  return result;
}

/**
 * Triggers AI question proposal with duplicate detection and pending review storage
 */
export async function proposeAiQuestions(params: {
  category: string;
  difficulty: QuestionDifficulty;
  count: number;
  focusSubtopic?: string;
}): Promise<{
  success: boolean;
  proposedCount: number;
  proposedQuestions: QuizQuestion[];
  duplicateRejections: Array<{ question: string; reason: string; similarity: number }>;
  error?: string;
}> {
  try {
    const headers = getDemoAuthHeaders();
    const res = await fetch('/api/questions/propose', {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        proposedCount: 0,
        proposedQuestions: [],
        duplicateRejections: [],
        error: data.error || 'Failed to generate questions'
      };
    }

    // Save newly proposed questions locally so UI updates immediately
    if (data.proposedQuestions && Array.isArray(data.proposedQuestions)) {
      for (const q of data.proposedQuestions) {
        await saveQuestion(q);
      }
    }

    return {
      success: true,
      proposedCount: data.proposedCount || 0,
      proposedQuestions: data.proposedQuestions || [],
      duplicateRejections: data.duplicateRejections || []
    };
  } catch (err: any) {
    console.error('Error in proposeAiQuestions:', err);
    return {
      success: false,
      proposedCount: 0,
      proposedQuestions: [],
      duplicateRejections: [],
      error: err?.message || 'Network error connecting to AI question service'
    };
  }
}

/**
 * Reviews pending questions (approves, rejects, or updates)
 */
export async function reviewQuestionAction(
  questionId: string,
  action: 'approve' | 'reject' | 'update',
  updatedData?: Partial<QuizQuestion>
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = getDemoAuthHeaders();
    const res = await fetch('/api/questions/review', {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionId, action, updatedData })
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to review question' };
  }
}

/**
 * Interface for submitUserAttempt response
 */
export interface AssessmentSubmissionResult {
  success: boolean;
  attempt?: QuizAttempt;
  error?: string;
  statusCode?: number;
  isDuplicate?: boolean;
}

/**
 * Fetches all persistent assessment attempts for a user from the backend
 * with authentication isolation headers and local storage fallback.
 */
export async function fetchUserAttempts(userId?: string): Promise<QuizAttempt[]> {
  const effectiveUserId = (userId && userId.trim() !== '') ? userId.trim() : (typeof window !== 'undefined' ? (getStoredUser()?.id || '') : '');
  if (!effectiveUserId) return [];

  try {
    const headers = getDemoAuthHeaders(effectiveUserId);
    const res = await fetch(`/api/user/attempts?userId=${encodeURIComponent(effectiveUserId)}`, {
      headers
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.attempts)) {
        // Cache locally for offline resilience
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`${LOCAL_CACHED_ATTEMPTS_KEY}_${effectiveUserId}`, JSON.stringify(data.attempts));
          } catch (e) {
            console.warn('Failed to cache server attempts locally:', e);
          }
        }
        return data.attempts;
      }
    } else {
      console.warn(`Server responded with ${res.status} when fetching attempts for ${userId}`);
    }
  } catch (err) {
    console.warn('Server attempts API unreachable, falling back to local cache:', err);
  }

  // Fallback to local cache
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`${LOCAL_CACHED_ATTEMPTS_KEY}_${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed reading local cached attempts:', e);
    }
  }

  return [];
}

/**
 * Submits a completed assessment to the backend for authoritative score validation,
 * duplicate prevention, and persistent storage in server-data/attempts.json.
 */
export async function submitUserAttempt(
  payload: AssessmentSubmissionPayload
): Promise<AssessmentSubmissionResult> {
  const userId = payload.userId || CURRENT_DEFAULT_USER;
  const headers = getDemoAuthHeaders(userId);

  try {
    const res = await fetch('/api/user/attempts', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      return {
        success: false,
        statusCode: 409,
        isDuplicate: true,
        error: data.error || 'Duplicate assessment attempt ID detected on server.'
      };
    }

    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        error: data.error || `Server rejected assessment submission (HTTP ${res.status}).`
      };
    }

    return {
      success: true,
      statusCode: 200,
      attempt: data.attempt
    };
  } catch (err: any) {
    console.warn('Network failure during assessment submission, creating offline placeholder:', err);
    return {
      success: false,
      statusCode: 0,
      error: err?.message || 'Network connection failed'
    };
  }
}

