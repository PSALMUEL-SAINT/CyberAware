import { Timestamp } from '@google-cloud/firestore';
import type { Firestore } from '@google-cloud/firestore';
import {
  isSessionRecordExpired,
  isSessionTokenFormatValid,
  SESSION_TTL_MS
} from '../../utils/authUtils';
import {
  deriveSessionDocId,
  deriveUserDocKey,
  normalizeEmailIdentity
} from '../../utils/firestoreKeys';
import { ISessionRepository, StoredSessionData } from '../types';

export const FIRESTORE_SAFE_BATCH_LIMIT = 450;

function toEpochMillis(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof (val as any).toMillis === 'function') {
    return (val as any).toMillis();
  }
  if (val instanceof Date) return val.getTime();
  return 0;
}

export class FirestoreSessionRepository implements ISessionRepository {
  constructor(private readonly db: Firestore) {}

  private collection() {
    return this.db.collection('sessions');
  }

  async createSession(
    token: string,
    userId: string,
    createdAtMs: number = Date.now(),
    expiresAtMs: number = createdAtMs + SESSION_TTL_MS
  ): Promise<void> {
    if (!isSessionTokenFormatValid(token)) {
      throw new Error('Refusing to persist malformed session token.');
    }
    const normalizedUser = normalizeEmailIdentity(userId);
    const sessionDocId = deriveSessionDocId(token);

    await this.collection().doc(sessionDocId).set({
      userId: normalizedUser,
      userKey: deriveUserDocKey(normalizedUser),
      createdAt: Timestamp.fromMillis(createdAtMs),
      expiresAt: Timestamp.fromMillis(expiresAtMs)
    });
  }

  async getSessionByToken(token: string): Promise<StoredSessionData | null> {
    if (!isSessionTokenFormatValid(token)) {
      return null;
    }

    const sessionDocId = deriveSessionDocId(token);
    const docRef = this.collection().doc(sessionDocId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return null;
    }

    const raw = snap.data() as Record<string, unknown>;
    const createdAt = toEpochMillis(raw.createdAt);
    const expiresAt = toEpochMillis(raw.expiresAt);
    const userId = typeof raw.userId === 'string' ? raw.userId : '';

    if (
      !userId ||
      isSessionRecordExpired({ createdAt, expiresAt: expiresAt || undefined })
    ) {
      // Request-time expiration enforcement (never rely solely on async Firestore TTL)
      await docRef.delete().catch(() => undefined);
      return null;
    }

    return {
      userId,
      userKey:
        typeof raw.userKey === 'string' ? raw.userKey : deriveUserDocKey(userId),
      createdAt,
      expiresAt: expiresAt || createdAt + SESSION_TTL_MS
    };
  }

  async deleteSessionByToken(token: string): Promise<void> {
    if (!token || !isSessionTokenFormatValid(token)) return;
    const sessionDocId = deriveSessionDocId(token);
    await this.collection().doc(sessionDocId).delete();
  }

  /**
   * Deletes all sessions belonging to a user in batches strictly bounded
   * below Firestore's 500-operation WriteBatch limit.
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const normalized = normalizeEmailIdentity(userId);
    if (!normalized) return 0;

    const userKey = deriveUserDocKey(normalized);
    const snap = await this.collection().where('userKey', '==', userKey).get();
    if (snap.empty) {
      return 0;
    }

    let totalDeleted = 0;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += FIRESTORE_SAFE_BATCH_LIMIT) {
      const chunk = docs.slice(i, i + FIRESTORE_SAFE_BATCH_LIMIT);
      const batch = this.db.batch();
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
      totalDeleted += chunk.length;
    }

    return totalDeleted;
  }
}
