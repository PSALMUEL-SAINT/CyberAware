import { normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { IRateLimitRepository } from '../types';

export class JsonRateLimitRepository implements IRateLimitRepository {
  private readonly windows = new Map<string, number[]>();

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
    const key = `${params.route}:${normalizeEmailIdentity(params.userId)}`;
    const timestamps = this.windows.get(key) || [];
    const active = timestamps.filter(ts => now - ts < params.windowMs);

    if (active.length >= params.maxRequests) {
      const oldest = active[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + params.windowMs - now) / 1000)
      );
      this.windows.set(key, active);
      return {
        allowed: false,
        retryAfterSeconds,
        currentUsage: active.length
      };
    }

    active.push(now);
    this.windows.set(key, active);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      currentUsage: active.length
    };
  }
}
