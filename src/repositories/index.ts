import { createFirestoreRepositories, FirestoreRepositoryOptions } from './firestore';
import { createJsonRepositories } from './json';
import { RepositoryBundle, resolveStorageBackend, StorageBackend } from './types';

export * from './types';
export { createJsonRepositories } from './json';
export { createFirestoreRepositories } from './firestore';
export { getFirestoreClient, resetFirestoreClientForTests } from './firestore/client';

export interface CreateRepositoriesOptions {
  backend?: string | null;
  jsonDataDir?: string;
  firestore?: FirestoreRepositoryOptions;
}

/**
 * Centralized, validated backend selector for repository instantiation.
 * Defaults strictly to 'json' unless STORAGE_BACKEND='firestore' is explicitly configured.
 */
export function createRepositories(
  options: CreateRepositoriesOptions = {}
): RepositoryBundle {
  const rawBackend =
    options.backend !== undefined ? options.backend : process.env.STORAGE_BACKEND;
  const backend: StorageBackend = resolveStorageBackend(rawBackend);

  if (backend === 'firestore') {
    return createFirestoreRepositories(options.firestore);
  }

  return createJsonRepositories(options.jsonDataDir);
}
