import { UserAssessmentHistory } from '../../utils/assessmentSelection';
import { normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { IHistoryRepository } from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonHistoryRepository implements IHistoryRepository {
  constructor(private readonly historyFile: string) {}

  async getOrInit(userId: string): Promise<UserAssessmentHistory> {
    const key = normalizeEmailIdentity(userId);
    const store = readJsonStoreFile<Record<string, UserAssessmentHistory>>(this.historyFile, {});
    let history = store[key] || store[userId];
    if (!history) {
      history = {
        userId: key,
        seenQuestionIds: [],
        answeredQuestionIds: [],
        answeredResults: {},
        flaggedQuestionIds: []
      };
      store[key] = history;
      writeJsonStoreFile(this.historyFile, store);
    }
    return history;
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
    const key = normalizeEmailIdentity(userId);
    const store = readJsonStoreFile<Record<string, UserAssessmentHistory>>(this.historyFile, {});
    const history: UserAssessmentHistory = store[key] ||
      store[userId] || {
        userId: key,
        seenQuestionIds: [],
        answeredQuestionIds: [],
        answeredResults: {},
        flaggedQuestionIds: []
      };

    for (const id of update.presentedIds || []) {
      if (!history.seenQuestionIds.includes(id)) {
        history.seenQuestionIds.push(id);
      }
    }

    for (const [qId, result] of Object.entries(update.answeredUpdates || {})) {
      if (!history.answeredQuestionIds.includes(qId)) {
        history.answeredQuestionIds.push(qId);
      }
      history.answeredResults[qId] = result;
    }

    if (Array.isArray(update.flaggedIds) && update.flaggedIds.length > 0) {
      history.flaggedQuestionIds = Array.from(
        new Set([...history.flaggedQuestionIds, ...update.flaggedIds])
      );
    }

    store[key] = history;
    writeJsonStoreFile(this.historyFile, store);
    return history;
  }
}
