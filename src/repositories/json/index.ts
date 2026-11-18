import { RepositoryBundle } from '../types';
import { JsonAttemptRepository } from './attemptRepository';
import { JsonGroupRepository } from './groupRepository';
import { JsonHistoryRepository } from './historyRepository';
import { resolveJsonStorePaths } from './jsonStorage';
import { JsonProgressRepository } from './progressRepository';
import { JsonQuestionRepository } from './questionRepository';
import { JsonRateLimitRepository } from './rateLimitRepository';
import { JsonSessionRepository } from './sessionRepository';
import { JsonUserRepository } from './userRepository';

export function createJsonRepositories(dataDir?: string): RepositoryBundle {
  const paths = resolveJsonStorePaths(dataDir);
  return {
    backend: 'json',
    users: new JsonUserRepository(paths.usersFile),
    sessions: new JsonSessionRepository(paths.sessionsFile),
    attempts: new JsonAttemptRepository(
      paths.attemptsFile,
      paths.progressFile,
      paths.historyFile
    ),
    progress: new JsonProgressRepository(paths.progressFile, paths.attemptsFile),
    history: new JsonHistoryRepository(paths.historyFile),
    groups: new JsonGroupRepository(paths.groupsFile),
    questions: new JsonQuestionRepository(paths.questionsFile),
    rateLimits: new JsonRateLimitRepository()
  };
}
