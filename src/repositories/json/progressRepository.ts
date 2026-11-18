import { QuizAttempt, UserProgressState } from '../../types';
import { normalizeEmailIdentity } from '../../utils/firestoreKeys';
import {
  applyAttemptToUserStats,
  buildEmptyUserStats,
  createCleanStoredProgress,
  IProgressRepository,
  StoredUserProgress,
  UserStatsRecord
} from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonProgressRepository implements IProgressRepository {
  constructor(
    private readonly progressFile: string,
    private readonly attemptsFile: string
  ) {}

  async getOrInit(
    userId: string,
    defaultFactory?: () => StoredUserProgress
  ): Promise<StoredUserProgress> {
    const key = normalizeEmailIdentity(userId);
    const store = readJsonStoreFile<Record<string, UserProgressState>>(this.progressFile, {});
    let rec = store[key] || store[userId];

    if (!rec) {
      const initial = defaultFactory ? defaultFactory() : createCleanStoredProgress();
      rec = { ...initial, quizAttempts: [] };
      store[key] = rec;
      writeJsonStoreFile(this.progressFile, store);
    }

    return {
      completedLessons: Array.isArray(rec.completedLessons) ? rec.completedLessons : [],
      completedChecklists:
        typeof rec.completedChecklists === 'object' && rec.completedChecklists
          ? rec.completedChecklists
          : {},
      solvedScenarios: Array.isArray(rec.solvedScenarios) ? rec.solvedScenarios : [],
      earnedBadges: Array.isArray(rec.earnedBadges) ? rec.earnedBadges : [],
      streakDays: typeof rec.streakDays === 'number' ? rec.streakDays : 0,
      lastVisitDate: rec.lastVisitDate || new Date().toISOString().split('T')[0]
    };
  }

  async saveProgress(
    userId: string,
    next: StoredUserProgress,
    evaluateBadgesFromSummary: (
      progress: StoredUserProgress,
      stats: UserStatsRecord
    ) => string[]
  ): Promise<StoredUserProgress> {
    const key = normalizeEmailIdentity(userId);
    const store = readJsonStoreFile<Record<string, UserProgressState>>(this.progressFile, {});
    const attemptsStore = readJsonStoreFile<Record<string, QuizAttempt[]>>(this.attemptsFile, {});
    const userAttempts = attemptsStore[key] || attemptsStore[userId] || [];

    let stats = buildEmptyUserStats(key);
    for (const att of [...userAttempts].reverse()) {
      if (att.verifiedByServer === true) {
        stats = applyAttemptToUserStats(stats, att);
      }
    }

    const sanitized: StoredUserProgress = {
      completedLessons: Array.isArray(next.completedLessons) ? next.completedLessons : [],
      completedChecklists:
        typeof next.completedChecklists === 'object' && next.completedChecklists
          ? next.completedChecklists
          : {},
      solvedScenarios: Array.isArray(next.solvedScenarios) ? next.solvedScenarios : [],
      earnedBadges: Array.isArray(next.earnedBadges) ? next.earnedBadges : [],
      streakDays: typeof next.streakDays === 'number' ? next.streakDays : 0,
      lastVisitDate: next.lastVisitDate || new Date().toISOString().split('T')[0]
    };

    sanitized.earnedBadges = evaluateBadgesFromSummary(sanitized, stats);
    store[key] = { ...sanitized, quizAttempts: userAttempts };
    writeJsonStoreFile(this.progressFile, store);

    return sanitized;
  }
}
