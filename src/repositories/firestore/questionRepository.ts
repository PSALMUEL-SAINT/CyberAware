import type { Firestore } from '@google-cloud/firestore';
import { QuizQuestion } from '../../types';
import { normalizeQuestionRecord, validateQuestion } from '../../utils/questionValidation';
import { IQuestionRepository, QuestionListOptions } from '../types';
import { FIRESTORE_SAFE_BATCH_LIMIT } from './sessionRepository';

export class FirestoreQuestionRepository implements IQuestionRepository {
  constructor(private readonly db: Firestore) {}

  private collection() {
    return this.db.collection('questionBank');
  }

  async listQuestions(options: QuestionListOptions): Promise<QuizQuestion[]> {
    if (!options.includeDrafts && options.status === 'draft') {
      return [];
    }

    const snap = options.status
      ? await this.collection().where('reviewStatus', '==', options.status).get()
      : await this.collection().get();

    let list = snap.docs.map(d => d.data() as QuizQuestion);
    if (!options.includeDrafts) {
      list = list.filter(q => q.reviewStatus !== 'draft');
    }
    return list;
  }

  async getById(id: string): Promise<QuizQuestion | null> {
    if (!id || id.includes('/')) return null;
    const snap = await this.collection().doc(id).get();
    return snap.exists ? (snap.data() as QuizQuestion) : null;
  }

  async createQuestionsBatch(
    questions: QuizQuestion[],
    options?: { forceDraft?: boolean }
  ): Promise<QuizQuestion[]> {
    const prepared: QuizQuestion[] = [];
    for (const q of questions) {
      const normalized = normalizeQuestionRecord(q);
      if (options?.forceDraft) {
        normalized.reviewStatus = 'draft';
      }
      const validation = validateQuestion(normalized);
      if (!validation.isValid) {
        throw new Error(`Invalid question '${normalized.id}': ${validation.errors.join('; ')}`);
      }
      prepared.push(normalized);
    }

    for (let i = 0; i < prepared.length; i += FIRESTORE_SAFE_BATCH_LIMIT) {
      const chunk = prepared.slice(i, i + FIRESTORE_SAFE_BATCH_LIMIT);
      const batch = this.db.batch();
      for (const q of chunk) {
        batch.set(this.collection().doc(q.id), q);
      }
      await batch.commit();
    }

    return prepared;
  }

  async upsertQuestion(
    question: QuizQuestion,
    options?: { isReviewer?: boolean }
  ): Promise<QuizQuestion> {
    const normalized = normalizeQuestionRecord(question);
    if (options && options.isReviewer === false) {
      normalized.reviewStatus = 'draft';
    }
    const validation = validateQuestion(normalized);
    if (!validation.isValid) {
      throw new Error(`Invalid question '${normalized.id}': ${validation.errors.join('; ')}`);
    }

    await this.collection().doc(normalized.id).set(normalized);
    return normalized;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    if (!id || id.includes('/')) return false;
    const ref = this.collection().doc(id);
    return this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      tx.delete(ref);
      return true;
    });
  }
}
