import { QuizAttempt, UserProgressState } from '../../types';
import { checkDuplicateAttempt, VerifiedAttemptRecord } from '../../utils/assessmentAttempts';
import { UserAssessmentHistory } from '../../utils/assessmentSelection';
import { normalizeEmailIdentity, validateSafeAttemptId } from '../../utils/firestoreKeys';
import {
  applyAttemptToUserStats,
  buildEmptyUserStats,
  createCleanStoredProgress,
  IAttemptRepository,
  StoredUserProgress,
  UserStatsRecord
} from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonAttemptRepository implements IAttemptRepository {
  constructor(
    private readonly attemptsFile: string,
    private readonly progressFile: string,
    private readonly historyFile: string
  ) {}

  private loadAttemptsStore(): Record<string, QuizAttempt[]> {
    return readJsonStoreFile<Record<string, QuizAttempt[]>>(this.attemptsFile, {});
  }

  private getAttemptsForUser(
    store: Record<string, QuizAttempt[]>,
    userId: string
  ): QuizAttempt[] {
    const target = normalizeEmailIdentity(userId);
    if (store[userId]) return store[userId];
    if (store[target]) return store[target];
    for (const [k, v] of Object.entries(store)) {
      if (normalizeEmailIdentity(k) === target) return v || [];
    }
    return [];
  }

  async listByUser(userId: string): Promise<QuizAttempt[]> {
    const store = this.loadAttemptsStore();
    return [...this.getAttemptsForUser(store, userId)];
  }

  async getStatsByUser(userId: string): Promise<UserStatsRecord> {
    const attempts = await this.listByUser(userId);
    let stats = buildEmptyUserStats(userId);
    // Preserve verified-only leaderboard semantics for pre-existing verified attempts,
    // while honoring normalized legacy/test attempts marked verifiedByServer === true.
    for (const att of [...attempts].reverse()) {
      if (att.verifiedByServer === true) {
        stats = applyAttemptToUserStats(stats, att);
      }
    }
    return stats;
  }

  async getStatsForUsers(userIds: string[]): Promise<Record<string, UserStatsRecord>> {
    const store = this.loadAttemptsStore();
    const out: Record<string, UserStatsRecord> = {};
    for (const uid of userIds) {
      const normalized = normalizeEmailIdentity(uid);
      const list = this.getAttemptsForUser(store, uid);
      let stats = buildEmptyUserStats(normalized);
      for (const att of [...list].reverse()) {
        if (att.verifiedByServer === true) {
          stats = applyAttemptToUserStats(stats, att);
        }
      }
      out[normalized] = stats;
    }
    return out;
  }

  async submitAttemptAtomic(params: {
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
  }> {
    const idCheck = validateSafeAttemptId(params.clientAttemptId);
    if (!idCheck.valid || !idCheck.normalized) {
      throw new Error(idCheck.error || 'Invalid attempt ID.');
    }

    const userId = normalizeEmailIdentity(params.userId);
    const attemptsStore = this.loadAttemptsStore();
    const userAttempts = this.getAttemptsForUser(attemptsStore, userId);

    // Stage 2.2 JSON parity: also guard against global duplicate IDs in JSON mode
    if (checkDuplicateAttempt(idCheck.normalized, attemptsStore)) {
      const existingStats = await this.getStatsByUser(userId);
      const progressStore = readJsonStoreFile<Record<string, UserProgressState>>(
        this.progressFile,
        {}
      );
      return {
        created: false,
        attempt: params.attempt,
        stats: existingStats,
        earnedBadges: progressStore[userId]?.earnedBadges || []
      };
    }

    const storedAttempt: VerifiedAttemptRecord = {
      ...params.attempt,
      id: idCheck.normalized,
      attemptId: idCheck.normalized,
      userId
    };

    const nextUserAttempts = [storedAttempt, ...userAttempts];
    attemptsStore[userId] = nextUserAttempts;
    writeJsonStoreFile(this.attemptsFile, attemptsStore);

    // Synchronize user_history.json
    const histories = readJsonStoreFile<Record<string, UserAssessmentHistory>>(
      this.historyFile,
      {}
    );
    const history: UserAssessmentHistory = histories[userId] || {
      userId,
      seenQuestionIds: [],
      answeredQuestionIds: [],
      answeredResults: {},
      flaggedQuestionIds: []
    };
    for (const qId of storedAttempt.questionsAttempted || []) {
      if (!history.seenQuestionIds.includes(qId)) {
        history.seenQuestionIds.push(qId);
      }
      if (!history.answeredQuestionIds.includes(qId)) {
        history.answeredQuestionIds.push(qId);
      }
      const verified = storedAttempt.verifiedAnswers?.[qId];
      if (verified) {
        history.answeredResults[qId] = {
          isCorrect: verified.isCorrect,
          selectedOptions: verified.selectedAnswers,
          timestamp: storedAttempt.timestamp
        };
      }
    }
    histories[userId] = history;
    writeJsonStoreFile(this.historyFile, histories);

    // Compute stats & synchronize progress.json
    let stats = buildEmptyUserStats(userId);
    for (const att of [...nextUserAttempts].reverse()) {
      if (att.verifiedByServer === true) {
        stats = applyAttemptToUserStats(stats, att);
      }
    }

    const progressStore = readJsonStoreFile<Record<string, UserProgressState>>(
      this.progressFile,
      {}
    );
    const currentProgress = progressStore[userId] || {
      ...createCleanStoredProgress(),
      quizAttempts: []
    };
    const badges = params.evaluateBadgesFromSummary(
      {
        completedLessons: currentProgress.completedLessons || [],
        completedChecklists: currentProgress.completedChecklists || {},
        solvedScenarios: currentProgress.solvedScenarios || [],
        earnedBadges: currentProgress.earnedBadges || [],
        streakDays: currentProgress.streakDays || 0,
        lastVisitDate: currentProgress.lastVisitDate || new Date().toISOString().split('T')[0]
      },
      stats
    );

    progressStore[userId] = {
      ...currentProgress,
      quizAttempts: nextUserAttempts,
      earnedBadges: badges
    };
    writeJsonStoreFile(this.progressFile, progressStore);

    return {
      created: true,
      attempt: storedAttempt,
      stats,
      earnedBadges: badges
    };
  }
}
