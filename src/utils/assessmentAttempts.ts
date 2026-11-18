import { QuizQuestion, QuizAttempt, QuestionDifficulty } from '../types';
import { evaluateQuestionAnswer } from './scoring';
export { deriveAttemptDocId, validateSafeAttemptId } from './firestoreKeys';

export interface AssessmentSubmissionItem {
  questionId: string;
  selectedOptions: number[];
}

export interface AssessmentSubmissionPayload {
  id?: string;
  attemptId?: string;
  userId: string;
  mode: 'practice' | 'exam';
  difficulty?: QuestionDifficulty | 'mixed';
  categoryFilter?: string;
  timeTakenSeconds?: number;
  completionDuration?: number;
  questions: AssessmentSubmissionItem[];
  claimedScore?: number;
  claimedPercentage?: number;
}

export interface VerifiedAttemptRecord extends QuizAttempt {
  userId: string;
  timestamp: string;
  questionsAttempted: string[];
  questionAnswers: any;
  verifiedAnswers: any;
  completionDuration: number;
  verifiedByServer: true;
  totalQuestions?: number;
  correctCount?: number;
}

export interface ValidationResult {
  isValid: boolean;
  valid: boolean;
  error?: string;
}

export const DEFAULT_DEMO_USER = 'destinyivienagbor2005@gmail.com';

/**
 * Pre-configured Demo User metadata for UI display and test assertions.
 * Static tokens are intentionally omitted; demo users authenticate via POST /api/auth/demo-login.
 */
export const DEMO_USER_PROFILES: Record<string, { name: string; role: string; userId?: string }> = {
  'destinyivienagbor2005@gmail.com': {
    name: 'Destiny (Primary Learner)',
    role: 'Student / Practitioner',
    userId: 'destinyivienagbor2005@gmail.com'
  },
  'judge.security@codesprint.org': {
    name: 'CodeSprint Security Judge',
    role: 'Security Evaluator',
    userId: 'judge.security@codesprint.org'
  },
  'alex.student@cyberaware.edu': {
    name: 'Alex Rivera (Peer Learner)',
    role: 'Student',
    userId: 'alex.student@cyberaware.edu'
  }
};


/**
 * Validates that a verified session identity matches the target user identifier.
 * Static demo tokens are never accepted as standalone credentials.
 */
export function verifyDemoUserAccess(
  authorizedUserId: string | null,
  targetUserId?: string | null,
  _providedToken?: string | null
): { allowed: boolean; reason?: string } {
  if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim() === '') {
    return { allowed: false, reason: 'Target user identifier is required.' };
  }

  if (authorizedUserId && typeof authorizedUserId === 'string' && authorizedUserId.trim() !== '') {
    if (authorizedUserId.toLowerCase().trim() === targetUserId.toLowerCase().trim()) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Access denied: Authenticated identity '${authorizedUserId}' is not permitted to access or modify records for '${targetUserId}'. Client-side identifier manipulation prevented.`
    };
  }

  return {
    allowed: false,
    reason: `Access denied: Unauthenticated request cannot access assessment records for '${targetUserId}'.`
  };
}

/**
 * Validates an incoming assessment submission payload.
 */
export function validateAssessmentSubmission(
  payload: any,
  questionBank: QuizQuestion[] | Map<string, QuizQuestion>
): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, valid: false, error: 'Invalid assessment submission: Request body must be a JSON object.' };
  }

  const attemptId = payload.id || payload.attemptId;
  if (!attemptId || typeof attemptId !== 'string' || attemptId.trim() === '') {
    return { isValid: false, valid: false, error: 'Invalid assessment submission: Missing unique attempt ID.' };
  }

  if (!payload.userId || typeof payload.userId !== 'string' || payload.userId.trim() === '') {
    return { isValid: false, valid: false, error: 'Invalid assessment submission: Missing user identifier.' };
  }

  if (payload.mode !== 'practice' && payload.mode !== 'exam') {
    return { isValid: false, valid: false, error: "Invalid assessment submission: Mode must be 'practice' or 'exam'." };
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return { isValid: false, valid: false, error: 'Invalid assessment submission: At least one question must be submitted.' };
  }

  // Create quick lookup for question bank
  const questionMap = questionBank instanceof Map
    ? questionBank
    : new Map<string, QuizQuestion>(questionBank.map(q => [q.id, q]));

  for (let i = 0; i < payload.questions.length; i++) {
    const item = payload.questions[i];
    if (!item || typeof item !== 'object') {
      return { isValid: false, valid: false, error: `Invalid assessment submission: Question item at index ${i} is malformed.` };
    }

    if (!item.questionId || typeof item.questionId !== 'string') {
      return { isValid: false, valid: false, error: `Invalid assessment submission: Missing questionId at index ${i}.` };
    }

    if (!questionMap.has(item.questionId)) {
      return {
        isValid: false,
        valid: false,
        error: `Invalid assessment submission: Question ID '${item.questionId}' does not exist in authoritative question bank.`
      };
    }

    if (!Array.isArray(item.selectedOptions)) {
      return {
        isValid: false,
        valid: false,
        error: `Invalid assessment submission: selectedOptions for '${item.questionId}' must be an array of numbers.`
      };
    }
  }

  return { isValid: true, valid: true };
}

/**
 * Checks whether an attempt ID already exists in storage.
 */
export function checkDuplicateAttempt(
  attemptIdOrStore: string | Record<string, QuizAttempt[]> | any[],
  storeOrAttemptId: any
): boolean {
  let id = '';
  let store: any = null;

  if (typeof attemptIdOrStore === 'string') {
    id = attemptIdOrStore;
    store = storeOrAttemptId;
  } else {
    store = attemptIdOrStore;
    id = typeof storeOrAttemptId === 'string' ? storeOrAttemptId : '';
  }

  if (!id) return false;
  if (!store) return false;

  if (Array.isArray(store)) {
    return store.some((a: any) => a && (a.id === id || a.attemptId === id));
  }

  if (typeof store === 'object') {
    for (const val of Object.values(store)) {
      if (Array.isArray(val) && val.some((a: any) => a && (a.id === id || a.attemptId === id))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Server-authoritatively calculates scores from the question bank.
 * Ignores any client-submitted score manipulation and guarantees authentic evaluation.
 */
export function calculateVerifiedAssessmentScore(
  payload: AssessmentSubmissionPayload,
  questionBank: QuizQuestion[] | Map<string, QuizQuestion>
): any {
  const questionMap = questionBank instanceof Map
    ? questionBank
    : new Map<string, QuizQuestion>(questionBank.map(q => [q.id, q]));

  const attemptId = payload.id || payload.attemptId || `attempt_${Date.now()}`;
  const questionsAttempted: string[] = [];
  const questionAnswers: Record<string, number[]> = {};
  const userAnswersByIndex: Record<number, number[]> = {};
  const verifiedAnswersMap: Record<string, {
    isCorrect: boolean;
    expectedAnswers: number[];
    selectedAnswers: number[];
  }> = {};
  const verifiedAnswersList: Array<{
    questionId: string;
    isCorrect: boolean;
    expectedOptions: number[];
    selectedOptions: number[];
  }> = [];

  const topicBreakdown: Record<string, { correct: number; total: number; percentage?: number }> = {};
  let totalCorrect = 0;

  payload.questions.forEach((item, index) => {
    const q = questionMap.get(item.questionId);
    if (!q) return;

    questionsAttempted.push(q.id);
    questionAnswers[q.id] = [...item.selectedOptions];
    userAnswersByIndex[index] = [...item.selectedOptions];

    const evaluation = evaluateQuestionAnswer(q, item.selectedOptions);
    const expected = q.correctAnswers && q.correctAnswers.length > 0 ? q.correctAnswers : [q.correctAnswer];

    verifiedAnswersMap[q.id] = {
      isCorrect: evaluation.isCorrect,
      expectedAnswers: expected,
      selectedAnswers: [...item.selectedOptions]
    };
    verifiedAnswersList.push({
      questionId: q.id,
      isCorrect: evaluation.isCorrect,
      expectedOptions: expected,
      selectedOptions: [...item.selectedOptions]
    });

    if (evaluation.isCorrect) {
      totalCorrect++;
    }

    // Domain breakdown grouping
    const domainKey = q.category || q.topic || 'General Security';
    if (!topicBreakdown[domainKey]) {
      topicBreakdown[domainKey] = { correct: 0, total: 0 };
    }
    topicBreakdown[domainKey].total += 1;
    if (evaluation.isCorrect) {
      topicBreakdown[domainKey].correct += 1;
    }
  });

  // Calculate percentage for each domain
  Object.keys(topicBreakdown).forEach(k => {
    const d = topicBreakdown[k];
    d.percentage = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
  });

  const total = payload.questions.length;
  const percentage = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;
  const duration = typeof payload.completionDuration === 'number' && payload.completionDuration >= 0
    ? payload.completionDuration
    : (typeof payload.timeTakenSeconds === 'number' && payload.timeTakenSeconds >= 0 ? payload.timeTakenSeconds : 0);

  const now = new Date();

  return {
    id: attemptId,
    attemptId,
    userId: payload.userId,
    mode: payload.mode,
    date: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    timestamp: now.toISOString(),
    total,
    totalQuestions: total,
    score: totalCorrect,
    correctCount: totalCorrect,
    percentage,
    difficulty: payload.difficulty || 'mixed',
    categoryFilter: payload.categoryFilter || 'all',
    topicBreakdown,
    questionsAttempted,
    userAnswers: userAnswersByIndex,
    questionAnswers,
    verifiedAnswers: verifiedAnswersList,
    verifiedAnswersMap,
    timeTakenSeconds: duration,
    completionDuration: duration,
    verifiedByServer: true
  };
}
