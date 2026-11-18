import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePasswordEntropy,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationPayload,
  isSessionTokenFormatValid,
  isSessionRecordExpired,
  SESSION_TTL_MS
} from './authUtils';

test('Password entropy evaluation detects common passwords', () => {
  const result = evaluatePasswordEntropy('password123');
  assert.strictEqual(result.isCommonWord, true);
  assert.strictEqual(result.score, 0);
  assert.strictEqual(result.label, 'Very Weak');
});

test('Password entropy evaluation rates short passwords as weak', () => {
  const result = evaluatePasswordEntropy('abc12');
  assert.strictEqual(result.hasMinLength, false);
  assert.strictEqual(result.score <= 1, true);
});

test('Password entropy evaluation rates resilient passphrases as Very Strong', () => {
  const result = evaluatePasswordEntropy('Correct-Horse-Battery-Staple-2026!');
  assert.strictEqual(result.hasMinLength, true);
  assert.strictEqual(result.hasUppercase, true);
  assert.strictEqual(result.hasLowercase, true);
  assert.strictEqual(result.hasNumber, true);
  assert.strictEqual(result.hasSpecialChar, true);
  assert.strictEqual(result.score, 4);
  assert.strictEqual(result.label, 'Very Strong');
});

test('hashPassword and verifyPassword correctly authenticate valid password', () => {
  const password = 'SecureCyberAwarePassphrase#2026';
  const { salt, hash } = hashPassword(password);
  
  assert.ok(salt.length >= 16);
  assert.ok(hash.length >= 64);

  const isValid = verifyPassword(password, salt, hash);
  assert.strictEqual(isValid, true);

  const isInvalid = verifyPassword('WrongPassword123!', salt, hash);
  assert.strictEqual(isInvalid, false);
});

test('generateSessionToken produces unique, opaque token with user tag', () => {
  const token1 = generateSessionToken('destiny@gmail.com');
  const token2 = generateSessionToken('destiny@gmail.com');

  assert.ok(token1.startsWith('ca_sec_'));
  assert.ok(token2.startsWith('ca_sec_'));
  assert.notStrictEqual(token1, token2);
});

test('validateRegistrationPayload catches missing or invalid data', () => {
  // Empty name
  const res1 = validateRegistrationPayload({
    name: ' ',
    email: 'test@example.com',
    password: 'GoodPassword123!'
  });
  assert.strictEqual(res1.valid, false);

  // Invalid email
  const res2 = validateRegistrationPayload({
    name: 'Alice Learner',
    email: 'not-an-email',
    password: 'GoodPassword123!'
  });
  assert.strictEqual(res2.valid, false);

  // Short password
  const res3 = validateRegistrationPayload({
    name: 'Alice Learner',
    email: 'alice@cyberaware.edu',
    password: 'short'
  });
  assert.strictEqual(res3.valid, false);

  // Password mismatch
  const res4 = validateRegistrationPayload({
    name: 'Alice Learner',
    email: 'alice@cyberaware.edu',
    password: 'GoodPassword123!',
    confirmPassword: 'DifferentPassword123!'
  });
  assert.strictEqual(res4.valid, false);

  // Valid registration
  const res5 = validateRegistrationPayload({
    name: 'Alice Learner',
    email: 'alice@cyberaware.edu',
    password: 'GoodPassword123!',
    confirmPassword: 'GoodPassword123!'
  });
  assert.strictEqual(res5.valid, true);
});

test('isSessionTokenFormatValid rejects static demo tokens and malformed tokens', () => {
  const realToken = generateSessionToken('learner@cyberaware.edu');
  assert.strictEqual(isSessionTokenFormatValid(realToken), true);
  assert.strictEqual(isSessionTokenFormatValid('demo_token_destiny_2026'), false);
  assert.strictEqual(isSessionTokenFormatValid('demo_token_judge_2026'), false);
  assert.strictEqual(isSessionTokenFormatValid('invalid_short'), false);
  assert.strictEqual(isSessionTokenFormatValid('ca_sec_bad token with spaces'), false);
  assert.strictEqual(isSessionTokenFormatValid(null), false);
});

test('isSessionRecordExpired detects expired, missing, and valid session lifetimes', () => {
  const now = 1_700_000_000_000;
  assert.strictEqual(isSessionRecordExpired({ createdAt: now, expiresAt: now + SESSION_TTL_MS }, now + 1000), false);
  assert.strictEqual(isSessionRecordExpired({ createdAt: now, expiresAt: now + 1000 }, now + 1001), true);
  assert.strictEqual(isSessionRecordExpired({ createdAt: now - SESSION_TTL_MS - 1 }, now), true);
  assert.strictEqual(isSessionRecordExpired({}, now), true);
  assert.strictEqual(isSessionRecordExpired(null, now), true);
});
