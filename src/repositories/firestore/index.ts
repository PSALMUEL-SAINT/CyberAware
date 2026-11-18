import type { Firestore } from '@google-cloud/firestore';
import { RepositoryBundle } from '../types';
import { FirestoreAttemptRepository } from './attemptRepository';
import { getFirestoreClient, resetFirestoreClientForTests } from './client';
export { getFirestoreClient, resetFirestoreClientForTests };
import { FirestoreGroupRepository } from './groupRepository';
import { FirestoreHistoryRepository } from './historyRepository';
import { FirestoreProgressRepository } from './progressRepository';
import { FirestoreQuestionRepository } from './questionRepository';
import { FirestoreRateLimitRepository } from './rateLimitRepository';
import { FirestoreSessionRepository } from './sessionRepository';
import { FirestoreUserRepository } from './userRepository';

export interface FirestoreRepositoryOptions {
  db?: Firestore;
  projectId?: string;
  databaseId?: string;
  docBudgetBytes?: number;
}

export function createFirestoreRepositories(
  options: FirestoreRepositoryOptions = {}
): RepositoryBundle {
  const db =
    options.db ||
    getFirestoreClient({
      projectId: options.projectId,
      databaseId: options.databaseId
    });

  return {
    backend: 'firestore',
    users: new FirestoreUserRepository(db),
    sessions: new FirestoreSessionRepository(db),
    attempts: new FirestoreAttemptRepository(db, options.docBudgetBytes),
    progress: new FirestoreProgressRepository(db, options.docBudgetBytes),
    history: new FirestoreHistoryRepository(db, options.docBudgetBytes),
    groups: new FirestoreGroupRepository(db),
    questions: new FirestoreQuestionRepository(db),
    rateLimits: new FirestoreRateLimitRepository(db)
  };
}
