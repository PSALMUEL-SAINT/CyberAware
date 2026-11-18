import { UserAccount } from '../../utils/authUtils';
import { normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { IUserRepository } from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonUserRepository implements IUserRepository {
  constructor(private readonly usersFile: string) {}

  private loadStore(): Record<string, UserAccount> {
    return readJsonStoreFile<Record<string, UserAccount>>(this.usersFile, {});
  }

  private findKeyAndUser(
    store: Record<string, UserAccount>,
    identifier: string
  ): { key: string; user: UserAccount } | null {
    const clean = normalizeEmailIdentity(identifier);
    if (!clean) return null;

    if (store[clean]) {
      return { key: clean, user: store[clean] };
    }
    const trimmed = identifier.trim();
    if (store[trimmed]) {
      return { key: trimmed, user: store[trimmed] };
    }

    for (const [k, u] of Object.entries(store)) {
      if (
        (u.email && normalizeEmailIdentity(u.email) === clean) ||
        (u.id && normalizeEmailIdentity(u.id) === clean)
      ) {
        return { key: k, user: u };
      }
    }
    return null;
  }

  async findByEmailOrId(identifier: string): Promise<UserAccount | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const store = this.loadStore();
    return this.findKeyAndUser(store, identifier)?.user ?? null;
  }

  async listDemoUsers(): Promise<UserAccount[]> {
    const store = this.loadStore();
    return Object.values(store).filter(u => u.isDemoUser === true);
  }

  async createUser(user: UserAccount): Promise<void> {
    const store = this.loadStore();
    const key = normalizeEmailIdentity(user.email || user.id);
    if (!key) {
      throw new Error('User email or id is required.');
    }
    if (this.findKeyAndUser(store, key)) {
      throw new Error(`User '${key}' already exists.`);
    }
    store[key] = { ...user, id: key, email: key };
    writeJsonStoreFile(this.usersFile, store);
  }

  async recordLoginSuccess(userId: string, lastLoginAt: string): Promise<void> {
    const store = this.loadStore();
    const match = this.findKeyAndUser(store, userId);
    if (!match) return;
    store[match.key] = {
      ...match.user,
      lastLoginAt,
      failedLoginAttempts: 0,
      lockedUntil: null
    };
    writeJsonStoreFile(this.usersFile, store);
  }

  async recordLoginFailureAtomic(
    userId: string,
    nowMs: number = Date.now()
  ): Promise<{ failedLoginAttempts: number; lockedUntil: string | null }> {
    const store = this.loadStore();
    const match = this.findKeyAndUser(store, userId);
    if (!match) {
      return { failedLoginAttempts: 0, lockedUntil: null };
    }

    const user = match.user;
    let currentFailures = user.failedLoginAttempts || 0;
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() <= nowMs) {
      currentFailures = 0;
    }

    const nextFailures = currentFailures + 1;
    const lockedUntil =
      nextFailures >= 5 ? new Date(nowMs + 5 * 60 * 1000).toISOString() : null;

    store[match.key] = {
      ...user,
      failedLoginAttempts: nextFailures,
      lockedUntil
    };
    writeJsonStoreFile(this.usersFile, store);

    return { failedLoginAttempts: nextFailures, lockedUntil };
  }
}
