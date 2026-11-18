import crypto from 'crypto';
import { evaluatePasswordEntropy, type PasswordStrengthResult } from './passwordStrength';

export { evaluatePasswordEntropy } from './passwordStrength';
export type { PasswordStrengthResult } from './passwordStrength';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: 'Student / Learner' | 'Security Practitioner' | 'Security Evaluator' | 'Educator / Mentor';
  salt: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  isDemoUser?: boolean;
}

/**
 * Hashes a password using crypto.scrypt or HMAC-SHA256 with a unique salt
 */
export function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

/**
 * Safely compares two hex strings or buffers using timingSafeEqual when lengths match
 */
function safeTimingSafeEqual(aHex: string, bHex: string): boolean {
  try {
    const bufA = Buffer.from(aHex, 'hex');
    const bufB = Buffer.from(bHex, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return aHex === bHex;
  }
}

/**
 * Verifies a candidate password against stored salt and hash.
 * Supports primary scrypt hashing alongside PBKDF2, HMAC-SHA256, and SHA256/512 fallback algorithms
 * to guarantee 100% backward compatibility for all previously registered accounts.
 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !expectedHash) return false;

  // Direct exact match fallback (e.g. initial dev seeds or unhashed inputs)
  if (password === expectedHash) return true;

  const safeSalt = salt || '';

  // 1. Primary standard algorithm: crypto.scrypt (64-byte key)
  try {
    const scryptHash = crypto.scryptSync(password, safeSalt, 64).toString('hex');
    if (safeTimingSafeEqual(scryptHash, expectedHash)) return true;
  } catch {
    // continue fallback checks
  }

  // 2. PBKDF2-HMAC-SHA512 (64 bytes, 1000 and 10,000 iterations)
  try {
    const pbkdf2_1k = crypto.pbkdf2Sync(password, safeSalt, 1000, 64, 'sha512').toString('hex');
    if (safeTimingSafeEqual(pbkdf2_1k, expectedHash)) return true;
    const pbkdf2_10k = crypto.pbkdf2Sync(password, safeSalt, 10000, 64, 'sha512').toString('hex');
    if (safeTimingSafeEqual(pbkdf2_10k, expectedHash)) return true;
  } catch {
    // continue
  }

  // 3. PBKDF2-HMAC-SHA256 (32 bytes)
  try {
    const pbkdf2_sha256 = crypto.pbkdf2Sync(password, safeSalt, 1000, 32, 'sha256').toString('hex');
    if (safeTimingSafeEqual(pbkdf2_sha256, expectedHash)) return true;
  } catch {
    // continue
  }

  // 4. HMAC-SHA256
  try {
    const hmac = crypto.createHmac('sha256', safeSalt).update(password).digest('hex');
    if (safeTimingSafeEqual(hmac, expectedHash)) return true;
  } catch {
    // continue
  }

  // 5. Standard SHA256 (salt + password, password + salt, or standalone password)
  try {
    const sha256_salted1 = crypto.createHash('sha256').update(safeSalt + password).digest('hex');
    if (safeTimingSafeEqual(sha256_salted1, expectedHash)) return true;

    const sha256_salted2 = crypto.createHash('sha256').update(password + safeSalt).digest('hex');
    if (safeTimingSafeEqual(sha256_salted2, expectedHash)) return true;

    const sha256_plain = crypto.createHash('sha256').update(password).digest('hex');
    if (safeTimingSafeEqual(sha256_plain, expectedHash)) return true;
  } catch {
    // continue
  }

  // 6. SHA512 (salt + password)
  try {
    const sha512_salted = crypto.createHash('sha512').update(safeSalt + password).digest('hex');
    if (safeTimingSafeEqual(sha512_salted, expectedHash)) return true;
  } catch {
    // continue
  }

  return false;
}

/**
 * Generates an opaque, high-entropy session token
 */
export function generateSessionToken(userId: string): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now().toString(36);
  return `ca_sec_${Buffer.from(userId).toString('base64url').slice(0, 12)}_${timestamp}_${randomBytes}`;
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PUBLIC_REGISTRATION_ALLOWED_ROLES = ['Student / Learner'] as const;
export const QUESTION_REVIEWER_ROLES = new Set([
  'security evaluator',
  'educator / mentor',
  'admin',
  'moderator'
]);

/**
 * Validates that a session token matches the server-issued opaque token format
 * and is never a hardcoded static demo token.
 */
export function isSessionTokenFormatValid(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed.length < 20 || trimmed.length > 256) return false;
  if (trimmed.toLowerCase().startsWith('demo_token_')) return false;
  // Require server-issued ca_sec_ prefix and safe token charset
  return /^ca_sec_[A-Za-z0-9_.-]+$/.test(trimmed);
}

/**
 * Checks whether a persisted session record is expired or invalid.
 */
export function isSessionRecordExpired(
  session: { createdAt?: unknown; expiresAt?: unknown } | null | undefined,
  nowMs: number = Date.now(),
  ttlMs: number = SESSION_TTL_MS
): boolean {
  if (!session || typeof session !== 'object') return true;
  const createdAt = typeof session.createdAt === 'number' && Number.isFinite(session.createdAt)
    ? session.createdAt
    : 0;
  if (createdAt <= 0) return true;

  const expiresAt = typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt)
    ? session.expiresAt
    : createdAt + ttlMs;

  return nowMs > expiresAt;
}

/**
 * Validates registration input
 */
export function validateRegistrationPayload(data: {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    return { valid: false, error: 'A valid email address is required.' };
  }

  if (!data.password || data.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters in length.' };
  }

  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }

  const entropy = evaluatePasswordEntropy(data.password);
  if (entropy.isCommonWord) {
    return { valid: false, error: 'Password is too common and easily guessed. Please select a stronger passphrase.' };
  }

  return { valid: true };
}
