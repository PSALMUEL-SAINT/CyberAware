import type { Firestore } from '@google-cloud/firestore';
import { UserAccount } from '../../utils/authUtils';
import { deriveUserDocKey, normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { IUserRepository } from '../types';

export class FirestoreUserRepository implements IUserRepository {
  constructor(private readonly db: Firestore) {}

  private collection() {
    return this.db.collection('users');
  }

  async findByEmailOrId(identifier: string): Promise<UserAccount | null> {
    const normalized = normalizeEmailIdentity(identifier);
    if (!normalized) return null;

    const userKey = deriveUserDocKey(normalized);
    const snap = await this.collection().doc(userKey).get();
    if (snap.exists) {
      return snap.data() as UserAccount;
    }

    // Defensive query fallback in case a record was indexed by email field directly
    const qSnap = await this.collection().where('email', '==', normalized).limit(1).get();
    if (!qSnap.empty) {
      return qSnap.docs[0].data() as UserAccount;
    }

    return null;
  }

  async listDemoUsers(): Promise<UserAccount[]> {
    const snap = await this.collection().where('isDemoUser', '==', true).get();
    return snap.docs.map(d => d.data() as UserAccount);
  }

  async createUser(user: UserAccount): Promise<void> {
    const normalized = normalizeEmailIdentity(user.email || user.id);
    if (!normalized) {
      throw new Error('User email or id is required.');
    }
    const userKey = deriveUserDocKey(normalized);
    const docRef = this.collection().doc(userKey);

    await this.db.runTransaction(async tx => {
      const existing = await tx.get(docRef);
      if (existing.exists) {
        throw new Error(`User '${normalized}' already exists.`);
      }
      const record: UserAccount = {
        ...user,
        id: normalized,
        email: normalized,
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        lockedUntil: user.lockedUntil ?? null
      };
      tx.create(docRef, record);
    });
  }

  async recordLoginSuccess(userId: string, lastLoginAt: string): Promise<void> {
    const userKey = deriveUserDocKey(userId);
    const docRef = this.collection().doc(userKey);

    await this.db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;
      tx.update(docRef, {
        lastLoginAt,
        failedLoginAttempts: 0,
        lockedUntil: null
      });
    });
  }

  async recordLoginFailureAtomic(
    userId: string,
    nowMs: number = Date.now()
  ): Promise<{ failedLoginAttempts: number; lockedUntil: string | null }> {
    const userKey = deriveUserDocKey(userId);
    const docRef = this.collection().doc(userKey);

    return this.db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        return { failedLoginAttempts: 0, lockedUntil: null };
      }

      const data = snap.data() as UserAccount;
      let currentFailures = data.failedLoginAttempts || 0;
      if (data.lockedUntil && new Date(data.lockedUntil).getTime() <= nowMs) {
        currentFailures = 0;
      }

      const nextFailures = currentFailures + 1;
      const lockedUntil =
        nextFailures >= 5 ? new Date(nowMs + 5 * 60 * 1000).toISOString() : null;

      tx.update(docRef, {
        failedLoginAttempts: nextFailures,
        lockedUntil
      });

      return { failedLoginAttempts: nextFailures, lockedUntil };
    });
  }
}
