import type { Firestore } from '@google-cloud/firestore';
import { QuizAttempt } from '../../types';
import { VerifiedAttemptRecord } from '../../utils/assessmentAttempts';
import {
  assertWithinFirestoreDocLimit,
  deriveAttemptDocId,
  deriveUserDocKey,
  FIRESTORE_SAFE_DOC_LIMIT_BYTES,
  normalizeEmailIdentity,
  validateSafeAttemptId
} from '../../utils/firestoreKeys';
import {
  applyAttemptToUserStats,
  buildEmptyUserStats,
  createCleanStoredProgress,
  IAttemptRepository,
  StoredUserProgress,
  UserStatsRecord
} from '../types';
import {
  applyHistoryWritePlanInTx,
  buildSafeHistoryWritePlan,
  createEmptyFirestoreHistory,
  FirestoreHistoryDocument,
  mergeHistoryEvents
} from './historyStorageUtils';

export class FirestoreAttemptRepository implements IAttemptRepository {
  constructor(
    private readonly db: Firestore,
    private readonly docBudgetBytes: number = FIRESTORE_SAFE_DOC_LIMIT_BYTES
  ) {}

  async listByUser(userId: string): Promise<QuizAttempt[]> {
    const normalized = normalizeEmailIdentity(userId);
    if (!normalized) return [];
    const snap = await this.db
      .collection('assessmentAttempts')
      .where('userId', '==', normalized)
      .orderBy('timestamp', 'desc')
      .get();

    return snap.docs.map(d => d.data() as QuizAttempt);
  }

  async getStatsByUser(userId: string): Promise<UserStatsRecord> {
    const normalized = normalizeEmailIdentity(userId);
    if (!normalized) return buildEmptyUserStats('');
    const snap = await this.db
      .collection('userStats')
      .doc(deriveUserDocKey(normalized))
      .get();
    return snap.exists
      ? (snap.data() as UserStatsRecord)
      : buildEmptyUserStats(normalized);
  }

  async getStatsForUsers(userIds: string[]): Promise<Record<string, UserStatsRecord>> {
    const uniqueUsers = Array.from(
      new Set(userIds.map(id => normalizeEmailIdentity(id)).filter(Boolean))
    );
    const result: Record<string, UserStatsRecord> = {};
    for (const uid of uniqueUsers) {
      result[uid] = buildEmptyUserStats(uid);
    }
    if (uniqueUsers.length === 0) return result;

    // Batch point reads using db.getAll() in chunks of 100
    for (let i = 0; i < uniqueUsers.length; i += 100) {
      const chunk = uniqueUsers.slice(i, i + 100);
      const refs = chunk.map(uid =>
        this.db.collection('userStats').doc(deriveUserDocKey(uid))
      );
      const snaps = await this.db.getAll(...refs);
      snaps.forEach((snap, idx) => {
        const uid = chunk[idx];
        if (snap.exists) {
          result[uid] = snap.data() as UserStatsRecord;
        }
      });
    }

    return result;
  }

  /**
   * Executes atomic attempt submission with strict O(1) document reads (all reads before writes):
   * Reads: attemptRef, statsRef, progressRef, historyRef.
   * Writes: attemptRef, statsRef, progressRef, historyRef (+ optional shard).
   */
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
    const normalizedUser = normalizeEmailIdentity(params.userId);
    const idCheck = validateSafeAttemptId(params.clientAttemptId);
    if (!idCheck.valid || !idCheck.normalized) {
      throw new Error(idCheck.error || 'Invalid attempt ID.');
    }

    const clientId = idCheck.normalized;
    const attemptDocId = deriveAttemptDocId(normalizedUser, clientId);
    const userKey = deriveUserDocKey(normalizedUser);

    const attemptRef = this.db.collection('assessmentAttempts').doc(attemptDocId);
    const statsRef = this.db.collection('userStats').doc(userKey);
    const progressRef = this.db.collection('userProgress').doc(userKey);
    const historyRef = this.db.collection('userHistory').doc(userKey);

    return this.db.runTransaction(async tx => {
      // 1. ALL READS FIRST
      const [attemptSnap, statsSnap, progressSnap, historySnap] = await Promise.all([
        tx.get(attemptRef),
        tx.get(statsRef),
        tx.get(progressRef),
        tx.get(historyRef)
      ]);

      const currentStats: UserStatsRecord = statsSnap.exists
        ? (statsSnap.data() as UserStatsRecord)
        : buildEmptyUserStats(normalizedUser);

      const rawProgress = progressSnap.exists
        ? (progressSnap.data() as Partial<StoredUserProgress>)
        : createCleanStoredProgress();

      const currentProgress: StoredUserProgress = {
        completedLessons: Array.isArray(rawProgress.completedLessons)
          ? rawProgress.completedLessons
          : [],
        completedChecklists:
          typeof rawProgress.completedChecklists === 'object' &&
          rawProgress.completedChecklists
            ? rawProgress.completedChecklists
            : {},
        solvedScenarios: Array.isArray(rawProgress.solvedScenarios)
          ? rawProgress.solvedScenarios
          : [],
        earnedBadges: Array.isArray(rawProgress.earnedBadges)
          ? rawProgress.earnedBadges
          : [],
        streakDays: typeof rawProgress.streakDays === 'number' ? rawProgress.streakDays : 0,
        lastVisitDate:
          rawProgress.lastVisitDate || new Date().toISOString().split('T')[0]
      };

      // 2. Duplicate check strictly scoped to authenticated user's deterministic doc ID
      if (attemptSnap.exists) {
        return {
          created: false,
          attempt: attemptSnap.data() as VerifiedAttemptRecord,
          stats: currentStats,
          earnedBadges: currentProgress.earnedBadges
        };
      }

      // 3. Prepare writes preserving client-visible id and attemptId
      const storedAttempt: VerifiedAttemptRecord = {
        ...params.attempt,
        id: clientId,
        attemptId: clientId,
        userId: normalizedUser,
        verifiedByServer: true
      };

      const nextStats = applyAttemptToUserStats(currentStats, storedAttempt);
      const nextBadges = params.evaluateBadgesFromSummary(currentProgress, nextStats);
      const nextProgress: StoredUserProgress = {
        ...currentProgress,
        earnedBadges: nextBadges
      };

      assertWithinFirestoreDocLimit('assessmentAttempt', storedAttempt, this.docBudgetBytes);
      assertWithinFirestoreDocLimit('userProgress', nextProgress, this.docBudgetBytes);

      const currentHistory: FirestoreHistoryDocument = historySnap.exists
        ? (historySnap.data() as FirestoreHistoryDocument)
        : createEmptyFirestoreHistory(normalizedUser);

      const answeredUpdates: Record<
        string,
        { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
      > = {};
      for (const qId of storedAttempt.questionsAttempted || []) {
        const verified = storedAttempt.verifiedAnswers?.[qId];
        if (verified) {
          answeredUpdates[qId] = {
            isCorrect: Boolean(verified.isCorrect),
            selectedOptions: Array.isArray(verified.selectedAnswers)
              ? verified.selectedAnswers
              : [],
            timestamp: storedAttempt.timestamp
          };
        }
      }

      const mergedHistory = mergeHistoryEvents(currentHistory, {
        presentedIds: storedAttempt.questionsAttempted || [],
        answeredUpdates
      });
      const historyPlan = buildSafeHistoryWritePlan(
        normalizedUser,
        mergedHistory,
        currentHistory.overflowShardCount || 0,
        this.docBudgetBytes
      );

      // 4. ALL WRITES AFTER READS
      tx.create(attemptRef, { ...storedAttempt, attemptDocId });
      tx.set(statsRef, nextStats);
      tx.set(progressRef, { ...nextProgress, userId: normalizedUser });
      applyHistoryWritePlanInTx(tx, historyRef, historyPlan);

      return {
        created: true,
        attempt: storedAttempt,
        stats: nextStats,
        earnedBadges: nextBadges
      };
    });
  }
}
