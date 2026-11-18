import {
  isSessionRecordExpired,
  isSessionTokenFormatValid,
  SESSION_TTL_MS
} from '../../utils/authUtils';
import { deriveUserDocKey, normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { ISessionRepository, StoredSessionData } from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

interface RawJsonSessionRecord {
  userId: string;
  createdAt: number;
  expiresAt?: number;
}

export class JsonSessionRepository implements ISessionRepository {
  constructor(private readonly sessionsFile: string) {}

  private loadPruned(): {
    sessions: Record<string, RawJsonSessionRecord>;
    changed: boolean;
  } {
    const sessions = readJsonStoreFile<Record<string, RawJsonSessionRecord>>(
      this.sessionsFile,
      {}
    );
    let changed = false;
    const now = Date.now();
    for (const [tok, rec] of Object.entries(sessions)) {
      if (!isSessionTokenFormatValid(tok) || isSessionRecordExpired(rec, now)) {
        delete sessions[tok];
        changed = true;
      }
    }
    return { sessions, changed };
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
    const { sessions } = this.loadPruned();
    sessions[token] = {
      userId: normalizeEmailIdentity(userId),
      createdAt: createdAtMs,
      expiresAt: expiresAtMs
    };
    writeJsonStoreFile(this.sessionsFile, sessions);
  }

  async getSessionByToken(token: string): Promise<StoredSessionData | null> {
    if (!isSessionTokenFormatValid(token)) {
      return null;
    }
    const sessions = readJsonStoreFile<Record<string, RawJsonSessionRecord>>(
      this.sessionsFile,
      {}
    );
    const rec = sessions[token];
    if (!rec || !rec.userId) {
      return null;
    }
    if (isSessionRecordExpired(rec)) {
      delete sessions[token];
      writeJsonStoreFile(this.sessionsFile, sessions);
      return null;
    }
    return {
      userId: rec.userId,
      userKey: deriveUserDocKey(rec.userId),
      createdAt: rec.createdAt,
      expiresAt: rec.expiresAt ?? rec.createdAt + SESSION_TTL_MS
    };
  }

  async deleteSessionByToken(token: string): Promise<void> {
    if (!token || !isSessionTokenFormatValid(token)) return;
    const sessions = readJsonStoreFile<Record<string, RawJsonSessionRecord>>(
      this.sessionsFile,
      {}
    );
    if (sessions[token]) {
      delete sessions[token];
      writeJsonStoreFile(this.sessionsFile, sessions);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const target = normalizeEmailIdentity(userId);
    if (!target) return 0;
    const sessions = readJsonStoreFile<Record<string, RawJsonSessionRecord>>(
      this.sessionsFile,
      {}
    );
    let revokedCount = 0;
    for (const [tok, rec] of Object.entries(sessions)) {
      if (rec?.userId && normalizeEmailIdentity(rec.userId) === target) {
        delete sessions[tok];
        revokedCount++;
      }
    }
    if (revokedCount > 0) {
      writeJsonStoreFile(this.sessionsFile, sessions);
    }
    return revokedCount;
  }
}
