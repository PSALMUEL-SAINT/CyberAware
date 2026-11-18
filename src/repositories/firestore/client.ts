import { Firestore } from '@google-cloud/firestore';

export interface FirestoreClientOptions {
  projectId?: string;
  databaseId?: string;
}

const clientsByDbId = new Map<string, Firestore>();

export function resolveFirestoreDatabaseId(rawDbId?: string): string | undefined {
  const value = (rawDbId ?? process.env.FIRESTORE_DATABASE_ID ?? '').trim();
  if (!value || value === '(default)') {
    return undefined;
  }
  return value;
}

/**
 * Returns a reusable singleton Firestore client configured with Application Default
 * Credentials (ADC) or FIRESTORE_EMULATOR_HOST when running in test/emulator mode.
 * Never reads or embeds static service-account keys or secrets.
 */
export function getFirestoreClient(options: FirestoreClientOptions = {}): Firestore {
  const databaseId = resolveFirestoreDatabaseId(options.databaseId);
  const cacheKey = `${options.projectId || 'adc'}::${databaseId || '(default)'}`;

  const existing = clientsByDbId.get(cacheKey);
  if (existing) {
    return existing;
  }

  const settings: FirebaseFirestore.Settings = {
    ignoreUndefinedProperties: true
  };

  if (options.projectId && options.projectId.trim() !== '') {
    settings.projectId = options.projectId.trim();
  }
  if (databaseId) {
    settings.databaseId = databaseId;
  }

  const client = new Firestore(settings);
  clientsByDbId.set(cacheKey, client);
  return client;
}

/**
 * Clears cached Firestore client instances (intended strictly for automated tests).
 */
export async function resetFirestoreClientForTests(): Promise<void> {
  const instances = Array.from(clientsByDbId.values());
  clientsByDbId.clear();
  await Promise.all(
    instances.map(async instance => {
      if (typeof (instance as any).terminate === 'function') {
        try {
          await instance.terminate();
        } catch {
          // ignore termination errors during test teardown
        }
      }
    })
  );
}
