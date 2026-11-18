import { Timestamp } from '@google-cloud/firestore';
import type { Firestore } from '@google-cloud/firestore';
import {
  deriveRateLimitDocId,
  normalizeEmailIdentity
} from '../../utils/firestoreKeys';
import { IRateLimitRepository, RateLimiterUnavailableError } from '../types';

export class FirestoreRateLimitRepository implements IRateLimitRepository {
  constructor(private readonly db: Firestore) {}

  async consumeSlidingWindowSlot(params: {
    userId: string;
    route: string;
    maxRequests: number;
    windowMs: number;
    nowMs?: number;
  }): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
    currentUsage: number;
  }> {
    const now = params.nowMs ?? Date.now();
    const docId = deriveRateLimitDocId(params.route, params.userId);
    const limitRef = this.db.collection('rateLimits').doc(docId);

    try {
      return await this.db.runTransaction(async tx => {
        // ALL READS FIRST
        const snap = await tx.get(limitRef);
        const existingTimestamps: number[] = snap.exists
          ? ((snap.data()?.timestamps as number[]) || [])
          : [];

        const activeTimestamps = existingTimestamps
          .filter(ts => typeof ts === 'number' && now - ts < params.windowMs)
          .sort((a, b) => a - b);

        if (activeTimestamps.length >= params.maxRequests) {
          const oldest = activeTimestamps[0];
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((oldest + params.windowMs - now) / 1000)
          );
          return {
            allowed: false,
            retryAfterSeconds,
            currentUsage: activeTimestamps.length
          };
        }

        const nextTimestamps = [...activeTimestamps, now];
        const expiresAt = Timestamp.fromMillis(now + Math.max(params.windowMs * 5, 300_000));

        // WRITE ONLY AFTER READ
        tx.set(limitRef, {
          userId: normalizeEmailIdentity(params.userId),
          route: params.route,
          timestamps: nextTimestamps,
          updatedAt: Timestamp.fromMillis(now),
          expiresAt
        });

        return {
          allowed: true,
          retryAfterSeconds: 0,
          currentUsage: nextTimestamps.length
        };
      });
    } catch (err: any) {
      // Fail closed: never allow unlimited AI generation when shared rate limiter fails
      throw new RateLimiterUnavailableError(
        `Shared rate limiter unavailable: ${err?.message || 'Firestore error'}`
      );
    }
  }
}
