import type { Firestore } from '@google-cloud/firestore';
import {
  assertWithinFirestoreDocLimit,
  deriveUserDocKey,
  FIRESTORE_SAFE_DOC_LIMIT_BYTES,
  normalizeEmailIdentity
} from '../../utils/firestoreKeys';
import {
  buildEmptyUserStats,
  createCleanStoredProgress,
  IProgressRepository,
  StoredUserProgress,
  UserStatsRecord
} from '../types';

export class FirestoreProgressRepository implements IProgressRepository {
  constructor(
    private readonly db: Firestore,
    private readonly docBudgetBytes: number = FIRESTORE_SAFE_DOC_LIMIT_BYTES
  ) {}

  private progressRef(userId: string) {
    return this.db.collection('userProgress').doc(deriveUserDocKey(userId));
  }

  private statsRef(userId: string) {
    return this.db.collection('userStats').doc(deriveUserDocKey(userId));
  }

  private sanitize(next: Partial<StoredUserProgress>): StoredUserProgress {
    return {
      completedLessons: Array.isArray(next.completedLessons) ? [...next.completedLessons] : [],
      completedChecklists:
        typeof next.completedChecklists === 'object' && next.completedChecklists
          ? { ...next.completedChecklists }
          : {},
      solvedScenarios: Array.isArray(next.solvedScenarios) ? [...next.solvedScenarios] : [],
      earnedBadges: Array.isArray(next.earnedBadges) ? [...next.earnedBadges] : [],
      streakDays: typeof next.streakDays === 'number' ? next.streakDays : 0,
      lastVisitDate: next.lastVisitDate || new Date().toISOString().split('T')[0]
    };
  }

  async getOrInit(
    userId: string,
    defaultFactory?: () => StoredUserProgress
  ): Promise<StoredUserProgress> {
    const normalized = normalizeEmailIdentity(userId);
    const ref = this.progressRef(normalized);
    const existing = await ref.get();
    if (existing.exists) {
      return this.sanitize(existing.data() as StoredUserProgress);
    }

    const initial = this.sanitize(
      defaultFactory ? defaultFactory() : createCleanStoredProgress()
    );
    assertWithinFirestoreDocLimit('userProgress', initial, this.docBudgetBytes);

    await this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, { ...initial, userId: normalized });
      }
    });

    const created = await ref.get();
    return created.exists
      ? this.sanitize(created.data() as StoredUserProgress)
      : initial;
  }

  async saveProgress(
    userId: string,
    next: StoredUserProgress,
    evaluateBadgesFromSummary: (
      progress: StoredUserProgress,
      stats: UserStatsRecord
    ) => string[]
  ): Promise<StoredUserProgress> {
    const normalized = normalizeEmailIdentity(userId);
    const pRef = this.progressRef(normalized);
    const sRef = this.statsRef(normalized);
    const base = this.sanitize(next);

    assertWithinFirestoreDocLimit('userProgress', base, this.docBudgetBytes);

    return this.db.runTransaction(async tx => {
      const statsSnap = await tx.get(sRef);
      const stats: UserStatsRecord = statsSnap.exists
        ? (statsSnap.data() as UserStatsRecord)
        : buildEmptyUserStats(normalized);

      const finalProgress: StoredUserProgress = {
        ...base,
        earnedBadges: evaluateBadgesFromSummary(base, stats)
      };

      assertWithinFirestoreDocLimit('userProgress', finalProgress, this.docBudgetBytes);
      tx.set(pRef, { ...finalProgress, userId: normalized });
      return finalProgress;
    });
  }
}
