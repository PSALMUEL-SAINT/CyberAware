import type { Firestore } from '@google-cloud/firestore';
import { UserAssessmentHistory } from '../../utils/assessmentSelection';
import {
  deriveUserDocKey,
  FIRESTORE_SAFE_DOC_LIMIT_BYTES,
  normalizeEmailIdentity
} from '../../utils/firestoreKeys';
import { IHistoryRepository } from '../types';
import {
  applyHistoryWritePlanInTx,
  buildSafeHistoryWritePlan,
  createEmptyFirestoreHistory,
  FirestoreHistoryDocument,
  mergeHistoryEvents,
  readFullHistoryDoc
} from './historyStorageUtils';

export class FirestoreHistoryRepository implements IHistoryRepository {
  constructor(
    private readonly db: Firestore,
    private readonly docBudgetBytes: number = FIRESTORE_SAFE_DOC_LIMIT_BYTES
  ) {}

  private docRef(userId: string) {
    return this.db.collection('userHistory').doc(deriveUserDocKey(userId));
  }

  async getOrInit(userId: string): Promise<UserAssessmentHistory> {
    const normalized = normalizeEmailIdentity(userId);
    const ref = this.docRef(normalized);
    const { fullHistory } = await readFullHistoryDoc(this.db, ref);
    if (fullHistory) {
      return fullHistory;
    }

    const empty = createEmptyFirestoreHistory(normalized);
    await this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, empty);
      }
    });

    const { fullHistory: created } = await readFullHistoryDoc(this.db, ref);
    return (
      created || {
        userId: normalized,
        seenQuestionIds: [],
        answeredQuestionIds: [],
        answeredResults: {},
        flaggedQuestionIds: []
      }
    );
  }

  async recordEvents(
    userId: string,
    update: {
      presentedIds?: string[];
      answeredUpdates?: Record<
        string,
        { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
      >;
      flaggedIds?: string[];
    }
  ): Promise<UserAssessmentHistory> {
    const normalized = normalizeEmailIdentity(userId);
    const ref = this.docRef(normalized);

    await this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const currentParent: FirestoreHistoryDocument = snap.exists
        ? (snap.data() as FirestoreHistoryDocument)
        : createEmptyFirestoreHistory(normalized);

      const mergedInline = mergeHistoryEvents(currentParent, update);
      const plan = buildSafeHistoryWritePlan(
        normalized,
        mergedInline,
        currentParent.overflowShardCount || 0,
        this.docBudgetBytes
      );
      applyHistoryWritePlanInTx(tx, ref, plan);
    });

    const { fullHistory } = await readFullHistoryDoc(this.db, ref);
    return (
      fullHistory || {
        userId: normalized,
        seenQuestionIds: [],
        answeredQuestionIds: [],
        answeredResults: {},
        flaggedQuestionIds: []
      }
    );
  }
}
