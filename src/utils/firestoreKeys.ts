import crypto from 'crypto';

/**
 * Firestore enforces a 1 MiB (1,048,576 bytes) maximum document size.
 * We maintain a conservative safe threshold below 1 MiB so metadata overhead
 * never triggers write rejections and oversized history spills to shards.
 */
export const FIRESTORE_HARD_DOC_LIMIT_BYTES = 1_048_576;
export const FIRESTORE_SAFE_DOC_LIMIT_BYTES = 800_000;

/**
 * Normalizes an email or user identifier to canonical lowercase form
 * while keeping the logical email identity unchanged in document fields.
 */
export function normalizeEmailIdentity(emailOrId: string): string {
  if (typeof emailOrId !== 'string') {
    return '';
  }
  return emailOrId.trim().toLowerCase();
}

/**
 * Derives a deterministic, path-safe Firestore document key (64-char hex SHA-256)
 * from a normalized user email/ID. Safely handles '/', '.', '@', and mixed casing
 * without altering the stored user.id or user.email fields.
 */
export function deriveUserDocKey(emailOrId: string): string {
  const normalized = normalizeEmailIdentity(emailOrId);
  if (!normalized) {
    throw new Error('Cannot derive Firestore user document key from empty identifier.');
  }
  return crypto.createHash('sha256').update(`user:${normalized}`).digest('hex');
}

/**
 * Derives a deterministic SHA-256 document ID for an active opaque session token
 * so raw bearer tokens never appear in Firestore paths or logs.
 */
export function deriveSessionDocId(rawToken: string): string {
  const clean = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!clean) {
    throw new Error('Cannot derive Firestore session document ID from empty token.');
  }
  return crypto.createHash('sha256').update(`session:${clean}`).digest('hex');
}

/**
 * Derives a deterministic SHA-256 document ID for shared rate-limit tracking.
 */
export function deriveRateLimitDocId(route: string, userId: string): string {
  const cleanRoute = (route || '').trim();
  const normalizedUser = normalizeEmailIdentity(userId);
  if (!cleanRoute || !normalizedUser) {
    throw new Error('Route and userId are required to derive rate-limit document ID.');
  }
  return crypto.createHash('sha256').update(`ratelimit:${cleanRoute}:${normalizedUser}`).digest('hex');
}

/**
 * Validates that a client-supplied assessment attempt ID is safe for storage
 * and free of path traversal or separator characters.
 */
export function validateSafeAttemptId(clientAttemptId: unknown): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (typeof clientAttemptId !== 'string') {
    return { valid: false, error: 'Attempt ID must be a string.' };
  }
  const trimmed = clientAttemptId.trim();
  if (trimmed.length < 3 || trimmed.length > 128) {
    return { valid: false, error: 'Attempt ID must be between 3 and 128 characters.' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Attempt ID must contain only alphanumeric characters, underscores, or hyphens.'
    };
  }
  return { valid: true, normalized: trimmed };
}

/**
 * Derives a globally unique, user-scoped Firestore document ID for an assessment attempt.
 * Scoping by normalized userId guarantees User B cannot overwrite or probe User A's attempt IDs,
 * while preserving deterministic retry deduplication for the same user.
 */
export function deriveAttemptDocId(userId: string, clientAttemptId: string): string {
  const normalizedUser = normalizeEmailIdentity(userId);
  if (!normalizedUser) {
    throw new Error('Authenticated userId is required to derive attempt document ID.');
  }
  const validation = validateSafeAttemptId(clientAttemptId);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.error || 'Invalid clientAttemptId.');
  }
  return crypto
    .createHash('sha256')
    .update(`attempt:${normalizedUser}:${validation.normalized}`)
    .digest('hex');
}

/**
 * Estimates serialized UTF-8 payload size in bytes for Firestore 1 MiB safeguard checks.
 */
export function estimateFirestoreDocBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
}

/**
 * Verifies a serialized document fits comfortably below Firestore's 1 MiB ceiling.
 */
export function assertWithinFirestoreDocLimit(
  label: string,
  value: unknown,
  limitBytes: number = FIRESTORE_SAFE_DOC_LIMIT_BYTES
): number {
  const bytes = estimateFirestoreDocBytes(value);
  if (bytes > limitBytes) {
    throw new Error(
      `${label} serialized size (${bytes} bytes) exceeds safe Firestore document budget (${limitBytes} bytes).`
    );
  }
  return bytes;
}
