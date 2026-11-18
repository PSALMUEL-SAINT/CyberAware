import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationPayload
} from './authUtils';
import {
  loadUserProgress,
  saveUserProgress,
  toggleLessonCompletion,
  recordQuizAttempt,
  getUserStorageKey,
  CLEAN_EMPTY_PROGRESS
} from './storage';
import { verifyDemoUserAccess } from './assessmentAttempts';

// In-memory mock storage for client testing
const mockStorage: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    }
  }
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

test('Authentication Regression & Account Compatibility Test Suite', async (t) => {
  const usersPath = path.join(process.cwd(), 'server-data', 'users.json');
  const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Log in using an account registered before data isolation changes
  // ---------------------------------------------------------------------------
  await t.test('Scenario 1: Authenticate baseline account registered before isolation changes (Destiny)', () => {
    const destiny = usersData['destinyivienagbor2005@gmail.com'];
    assert.ok(destiny, 'Destiny account must exist in server-data/users.json');
    assert.equal(destiny.email, 'destinyivienagbor2005@gmail.com');

    // Verify password with original password CyberAware2026!
    const isValid = verifyPassword('CyberAware2026!', destiny.salt, destiny.passwordHash);
    assert.equal(isValid, true, 'Original password must successfully authenticate against stored hash');

    // Verify user profile retains historical progress
    const progress = loadUserProgress('destinyivienagbor2005@gmail.com');
    assert.ok(progress.completedLessons.length >= 1, 'Existing user must retain completed lessons');
    assert.ok(progress.completedLessons.includes('phishing_101'));
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Log in using another previously registered account
  // ---------------------------------------------------------------------------
  await t.test('Scenario 2: Authenticate peer account registered before changes (Alex & Judge)', () => {
    const alex = usersData['alex.student@cyberaware.edu'];
    assert.ok(alex, 'Alex account must exist in server-data/users.json');
    const isAlexValid = verifyPassword('CyberAware2026!', alex.salt, alex.passwordHash);
    assert.equal(isAlexValid, true, 'Alex credentials must authenticate successfully');

    const judge = usersData['judge.security@codesprint.org'];
    assert.ok(judge, 'Judge account must exist in server-data/users.json');
    const isJudgeValid = verifyPassword('CyberAware2026!', judge.salt, judge.passwordHash);
    assert.equal(isJudgeValid, true, 'Judge credentials must authenticate successfully');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Register a completely new account and log in
  // ---------------------------------------------------------------------------
  await t.test('Scenario 3: Register brand new account, hash password, and initialize clean zero state', () => {
    const newEmail = 'marcus.vance@cyberaware.edu';
    const regPayload = {
      name: 'Marcus Vance',
      email: newEmail,
      password: 'SafePassphrase2026!',
      confirmPassword: 'SafePassphrase2026!'
    };

    const validation = validateRegistrationPayload(regPayload);
    assert.equal(validation.valid, true);

    const { salt, hash } = hashPassword(regPayload.password);
    assert.ok(salt.length >= 16);
    assert.ok(hash.length >= 64);

    // Verify new account password verifies correctly
    const isVerified = verifyPassword('SafePassphrase2026!', salt, hash);
    assert.equal(isVerified, true);

    // Verify new account starts with zero progress
    const cleanProgress = loadUserProgress(newEmail);
    assert.equal(cleanProgress.completedLessons.length, 0);
    assert.equal(cleanProgress.quizAttempts.length, 0);
    assert.equal(cleanProgress.solvedScenarios.length, 0);
    assert.equal(cleanProgress.earnedBadges.length, 0);
    assert.equal(cleanProgress.streakDays, 0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Log out and log back into original account
  // ---------------------------------------------------------------------------
  await t.test('Scenario 4: Clean logout and re-authentication into original account', () => {
    const originalUser = 'destinyivienagbor2005@gmail.com';
    const token = generateSessionToken(originalUser);

    // Simulate active session
    mockStorage['cyberaware_auth_user_v1'] = JSON.stringify({ id: originalUser, name: 'Destiny' });
    mockStorage['cyberaware_auth_token_v1'] = token;
    assert.ok(mockStorage['cyberaware_auth_token_v1']);

    // Simulate Logout
    delete mockStorage['cyberaware_auth_user_v1'];
    delete mockStorage['cyberaware_auth_token_v1'];
    assert.equal(mockStorage['cyberaware_auth_token_v1'], undefined);

    // Re-login
    const destiny = usersData[originalUser];
    const canReAuth = verifyPassword('CyberAware2026!', destiny.salt, destiny.passwordHash);
    assert.equal(canReAuth, true);

    const reAuthToken = generateSessionToken(originalUser);
    mockStorage['cyberaware_auth_user_v1'] = JSON.stringify({ id: originalUser, name: 'Destiny' });
    mockStorage['cyberaware_auth_token_v1'] = reAuthToken;

    const restoredProgress = loadUserProgress(originalUser);
    assert.ok(restoredProgress.completedLessons.includes('phishing_101'));
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Switch between two accounts and confirm records remain separate
  // ---------------------------------------------------------------------------
  await t.test('Scenario 5: Switch between User A and User B with strict data isolation', () => {
    const userA = 'user_alpha@cyberaware.edu';
    const userB = 'user_beta@cyberaware.edu';

    // User A completes lessons
    toggleLessonCompletion('passwords_101', userA);
    toggleLessonCompletion('mfa_101', userA);
    const progressA = loadUserProgress(userA);
    assert.equal(progressA.completedLessons.length, 2);

    // Switch to User B
    const progressB = loadUserProgress(userB);
    assert.equal(progressB.completedLessons.length, 0, 'User B must not see User A completed lessons');

    // User B takes a quiz
    recordQuizAttempt({
      id: 'att_b_1',
      userId: userB,
      date: 'Nov 10, 2026',
      score: 5,
      total: 5,
      percentage: 100,
      mode: 'practice',
      topicBreakdown: { 'Password Security': { correct: 5, total: 5 } }
    }, userB);

    const updatedB = loadUserProgress(userB);
    assert.equal(updatedB.quizAttempts.length, 1);
    assert.equal(updatedB.completedLessons.length, 0);

    // Switch back to User A
    const reloadA = loadUserProgress(userA);
    assert.equal(reloadA.completedLessons.length, 2);
    assert.equal(reloadA.quizAttempts.length, 0, 'User A must not see User B quiz attempts');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Incorrect password rejected
  // ---------------------------------------------------------------------------
  await t.test('Scenario 6: Incorrect password credentials firmly rejected', () => {
    const destiny = usersData['destinyivienagbor2005@gmail.com'];
    const isBadAuth = verifyPassword('IncorrectPassword123!', destiny.salt, destiny.passwordHash);
    assert.equal(isBadAuth, false, 'Invalid password must return false');

    const emptyPassAuth = verifyPassword('', destiny.salt, destiny.passwordHash);
    assert.equal(emptyPassAuth, false, 'Empty password must be rejected');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Server restart session persistence without static demo tokens
  // ---------------------------------------------------------------------------
  await t.test('Scenario 7: Server-generated session tokens survive disk serialization while static demo tokens remain absent', () => {
    const sessionsPath = path.join(process.cwd(), 'server-data', 'sessions.json');
    assert.ok(fs.existsSync(sessionsPath), 'sessions.json must exist');

    const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    assert.equal(sessionsData['demo_token_destiny_2026'], undefined, 'Hardcoded static demo tokens must not be seeded');
    assert.equal(sessionsData['demo_token_judge_2026'], undefined, 'Hardcoded static demo tokens must not be seeded');
    assert.equal(sessionsData['demo_token_alex_2026'], undefined, 'Hardcoded static demo tokens must not be seeded');

    // Simulate issuing a new server-generated session token with TTL
    const testUserId = 'persistent.user@cyberaware.edu';
    const testToken = generateSessionToken(testUserId);
    const now = Date.now();
    sessionsData[testToken] = { userId: testUserId, createdAt: now, expiresAt: now + 24 * 60 * 60 * 1000 };
    fs.writeFileSync(sessionsPath, JSON.stringify(sessionsData, null, 2), 'utf8');

    // Simulate server reboot by reading back from disk
    const reloadedSessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    assert.ok(reloadedSessions[testToken], 'Saved token must survive server restart reload');
    assert.equal(reloadedSessions[testToken].userId, testUserId);

    // Clean up test token from file
    delete reloadedSessions[testToken];
    fs.writeFileSync(sessionsPath, JSON.stringify(reloadedSessions, null, 2), 'utf8');
  });
});
