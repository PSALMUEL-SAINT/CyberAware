import { QUIZ_QUESTIONS } from '../../data/quizData';
import { QuizQuestion } from '../../types';
import { normalizeQuestionRecord, validateQuestion } from '../../utils/questionValidation';
import { IQuestionRepository, QuestionListOptions } from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonQuestionRepository implements IQuestionRepository {
  constructor(private readonly questionsFile: string) {}

  private loadBank(): QuizQuestion[] {
    return readJsonStoreFile<QuizQuestion[]>(this.questionsFile, [...QUIZ_QUESTIONS]);
  }

  async listQuestions(options: QuestionListOptions): Promise<QuizQuestion[]> {
    let list = this.loadBank();
    if (!options.includeDrafts) {
      list = list.filter(q => q.reviewStatus !== 'draft');
    }
    if (options.status) {
      list = list.filter(q => q.reviewStatus === options.status);
    }
    return list;
  }

  async getById(id: string): Promise<QuizQuestion | null> {
    return this.loadBank().find(q => q.id === id) || null;
  }

  async createQuestionsBatch(
    questions: QuizQuestion[],
    options?: { forceDraft?: boolean }
  ): Promise<QuizQuestion[]> {
    const bank = this.loadBank();
    const inserted: QuizQuestion[] = [];
    for (const q of questions) {
      const normalized = normalizeQuestionRecord(q);
      if (options?.forceDraft) {
        normalized.reviewStatus = 'draft';
      }
      const validation = validateQuestion(normalized);
      if (!validation.isValid) {
        throw new Error(`Invalid question '${normalized.id}': ${validation.errors.join('; ')}`);
      }
      bank.unshift(normalized);
      inserted.push(normalized);
    }
    writeJsonStoreFile(this.questionsFile, bank);
    return inserted;
  }

  async upsertQuestion(
    question: QuizQuestion,
    options?: { isReviewer?: boolean }
  ): Promise<QuizQuestion> {
    const bank = this.loadBank();
    const normalized = normalizeQuestionRecord(question);
    if (options && options.isReviewer === false) {
      normalized.reviewStatus = 'draft';
    }
    const validation = validateQuestion(normalized);
    if (!validation.isValid) {
      throw new Error(`Invalid question '${normalized.id}': ${validation.errors.join('; ')}`);
    }

    const idx = bank.findIndex(q => q.id === normalized.id);
    if (idx >= 0) {
      bank[idx] = normalized;
    } else {
      bank.unshift(normalized);
    }
    writeJsonStoreFile(this.questionsFile, bank);
    return normalized;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const bank = this.loadBank();
    const idx = bank.findIndex(q => q.id === id);
    if (idx === -1) return false;
    bank.splice(idx, 1);
    writeJsonStoreFile(this.questionsFile, bank);
    return true;
  }
}
