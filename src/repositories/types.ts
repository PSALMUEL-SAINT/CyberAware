import { QuizAttempt, QuizQuestion, SecurityGroup, UserProgressState } from '../types';
import { UserAccount } from '../utils/authUtils';
import { VerifiedAttemptRecord } from '../utils/assessmentAttempts';
import { UserAssessmentHistory } from '../utils/assessmentSelection';
import { BadgeSummaryStats } from '../utils/scoring';
import { normalizeEmailIdentity } from '../utils/firestoreKeys';

export type StorageBackend = 'json' | 'firestore';

export const DEFAULT_STORAGE_BACKEND: StorageBackend = 'json';
export const DEFAULT_MAX_GROUP_MEMBERS = 500;

export class RateLimiterUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(message = 'Shared AI rate limiter is temporarily unavailable.') {
    super(message);
    this.name = 'RateLimiterUnavailableError';
  }
}

/**
 * Validates and resolves the active storage backend from configuration.
 * Strictly defaults to 'json' when unset/blank and rejects unknown values.
 */
export function resolveStorageBackend(rawValue?: string | null): StorageBackend {
  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_STORAGE_BACKEND;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === '') {
    return DEFAULT_STORAGE_BACKEND;
  }
  if (normalized === 'json' || normalized === 'firestore') {
    return normalized;
  }
  throw new Error(
    `Invalid STORAGE_BACKEND '${rawValue}'. Expected 'json' or 'firestore'.`
  );
}

export interface StoredSessionData {
  userId: string;
  userKey?: string;
  createdAt: number;
  expiresAt: number;
}

export interface UserStatsRecord extends BadgeSummaryStats {
  userId: string;
  totalCorrectAnswers: number;
  totalQuestions: number;
  sumPercentage: number;
  averagePercentage: number;
  latestAttemptTimestamp: string | null;
  latestAttemptDate: string | null;
}

export function buildEmptyUserStats(userId: string): UserStatsRecord {
  return {
    userId: normalizeEmailIdentity(userId),
    totalAttempts: 0,
    bestPercentage: 0,
    averagePercentage: 0,
    sumPercentage: 0,
    totalCorrectAnswers: 0,
    totalQuestions: 0,
    latestAttemptTimestamp: null,
    latestAttemptDate: null,
    seenTopics: [],
    qualifiedDomainSpecialist: false,
    qualifiedGrandArchitect: false
  };
}

export function applyAttemptToUserStats(
  prev: UserStatsRecord,
  attempt: Pick<
    QuizAttempt,
    'score' | 'total' | 'percentage' | 'timestamp' | 'date' | 'topicBreakdown'
  >
): UserStatsRecord {
  const attemptScore = typeof attempt.score === 'number' ? attempt.score : 0;
  const attemptTotal = typeof attempt.total === 'number' ? attempt.total : 0;
  const attemptPct = typeof attempt.percentage === 'number' ? attempt.percentage : 0;

  const totalAttempts = prev.totalAttempts + 1;
  const totalCorrectAnswers = prev.totalCorrectAnswers + attemptScore;
  const totalQuestions = prev.totalQuestions + attemptTotal;
  const sumPercentage = prev.sumPercentage + attemptPct;
  const averagePercentage = totalAttempts > 0 ? Math.round(sumPercentage / totalAttempts) : 0;
  const bestPercentage = Math.max(prev.bestPercentage, attemptPct);

  const prevTs = prev.latestAttemptTimestamp ? Date.parse(prev.latestAttemptTimestamp) : 0;
  const nextTs = attempt.timestamp ? Date.parse(attempt.timestamp) : 0;
  const useNewLatest = nextTs >= prevTs;

  const seenTopics = Array.from(
    new Set([
      ...(prev.seenTopics || []),
      ...Object.keys(attempt.topicBreakdown || {})
    ])
  );

  return {
    userId: prev.userId,
    totalAttempts,
    bestPercentage,
    averagePercentage,
    sumPercentage,
    totalCorrectAnswers,
    totalQuestions,
    latestAttemptTimestamp: useNewLatest
      ? (attempt.timestamp || prev.latestAttemptTimestamp)
      : prev.latestAttemptTimestamp,
    latestAttemptDate: useNewLatest
      ? (attempt.date || prev.latestAttemptDate)
      : prev.latestAttemptDate,
    seenTopics,
    qualifiedDomainSpecialist:
      prev.qualifiedDomainSpecialist || (attemptPct >= 80 && attemptTotal >= 8),
    qualifiedGrandArchitect:
      prev.qualifiedGrandArchitect || (attemptPct >= 90 && attemptTotal >= 10)
  };
}

export type StoredUserProgress = Omit<UserProgressState, 'quizAttempts'>;

export function createCleanStoredProgress(nowDate?: string): StoredUserProgress {
  return {
    completedLessons: [],
    completedChecklists: {},
    solvedScenarios: [],
    earnedBadges: [],
    streakDays: 0,
    lastVisitDate: nowDate || new Date().toISOString().split('T')[0]
  };
}

export interface IUserRepository {
  findByEmailOrId(identifier: string): Promise<UserAccount | null>;
  listDemoUsers(): Promise<UserAccount[]>;
  createUser(user: UserAccount): Promise<void>;
  recordLoginSuccess(userId: string, lastLoginAt: string): Promise<void>;
  recordLoginFailureAtomic(
    userId: string,
    nowMs?: number
  ): Promise<{ failedLoginAttempts: number; lockedUntil: string | null }>;
}

export interface ISessionRepository {
  createSession(
    token: string,
    userId: string,
    createdAtMs?: number,
    expiresAtMs?: number
  ): Promise<void>;
  getSessionByToken(token: string): Promise<StoredSessionData | null>;
  deleteSessionByToken(token: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<number>;
}

export interface IAttemptRepository {
  listByUser(userId: string): Promise<QuizAttempt[]>;
  getStatsByUser(userId: string): Promise<UserStatsRecord>;
  getStatsForUsers(userIds: string[]): Promise<Record<string, UserStatsRecord>>;
  submitAttemptAtomic(params: {
    userId: string;
    clientAttemptId: string;
    attempt: VerifiedAttemptRecord;
    evaluateBadgesFromSummary: (
      progress: StoredUserProgress,
      nextStats: UserStatsRecord
    ) => string[];
  }): Promise<{
    created: boolean;
    attempt: VerifiedAttemptRecord;
    stats: UserStatsRecord;
    earnedBadges: string[];
  }>;
}

export interface IProgressRepository {
  getOrInit(
    userId: string,
    defaultFactory?: () => StoredUserProgress
  ): Promise<StoredUserProgress>;
  saveProgress(
    userId: string,
    next: StoredUserProgress,
    evaluateBadgesFromSummary: (
      progress: StoredUserProgress,
      stats: UserStatsRecord
    ) => string[]
  ): Promise<StoredUserProgress>;
}

export interface IHistoryRepository {
  getOrInit(userId: string): Promise<UserAssessmentHistory>;
  recordEvents(
    userId: string,
    update: {
      presentedIds?: string[];
      answeredUpdates?: Record<
        string,
        { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
      >;
      flaggedIds?: string[];
    }
  ): Promise<UserAssessmentHistory>;
}

export interface IGroupRepository {
  listPublicSummaries(): Promise<SecurityGroup[]>;
  findGroupsForMember(userId: string): Promise<SecurityGroup[]>;
  getGroupWithMembers(groupId: string): Promise<SecurityGroup | null>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  createGroupAtomic(
    group: SecurityGroup,
    maxMembers?: number
  ): Promise<SecurityGroup>;
  joinGroupAtomic(params: {
    groupId?: string;
    inviteCode?: string;
    userId: string;
    userName?: string;
    maxMembers?: number;
  }): Promise<{ status: number; group?: SecurityGroup; error?: string }>;
  removeMemberAtomic(
    groupId: string,
    targetUserId: string,
    requestingUserId: string
  ): Promise<{ status: number; group?: SecurityGroup; error?: string }>;
}

export interface QuestionListOptions {
  status?: string;
  includeDrafts: boolean;
}

export interface IQuestionRepository {
  listQuestions(options: QuestionListOptions): Promise<QuizQuestion[]>;
  getById(id: string): Promise<QuizQuestion | null>;
  createQuestionsBatch(
    questions: QuizQuestion[],
    options?: { forceDraft?: boolean }
  ): Promise<QuizQuestion[]>;
  upsertQuestion(
    question: QuizQuestion,
    options?: { isReviewer?: boolean }
  ): Promise<QuizQuestion>;
  deleteQuestion(id: string): Promise<boolean>;
}

export interface IRateLimitRepository {
  consumeSlidingWindowSlot(params: {
    userId: string;
    route: string;
    maxRequests: number;
    windowMs: number;
    nowMs?: number;
  }): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
    currentUsage: number;
  }>;
}

export interface RepositoryBundle {
  backend: StorageBackend;
  users: IUserRepository;
  sessions: ISessionRepository;
  attempts: IAttemptRepository;
  progress: IProgressRepository;
  history: IHistoryRepository;
  groups: IGroupRepository;
  questions: IQuestionRepository;
  rateLimits: IRateLimitRepository;
}
