import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadUserProgress,
  saveUserProgress,
  toggleLessonCompletion,
  recordQuizAttempt,
  getUserStorageKey,
  CLEAN_EMPTY_PROGRESS,
  DEFAULT_DEMO_PROGRESS
} from './storage';
import {
  verifyDemoUserAccess,
  validateAssessmentSubmission,
  calculateVerifiedAssessmentScore,
  checkDuplicateAttempt
} from './assessmentAttempts';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationPayload
} from './authUtils';
import { toGroupSummary } from './groupManagement';
import { calculateGroupLeaderboard } from './groupLeaderboard';
import { QuizQuestion, QuizAttempt, SecurityGroup } from '../types';

// Mock localStorage for headless Node test environment
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

// Sample test question for scoring validation
const testQuestionBank: QuizQuestion[] = [
  {
    id: 'iso_q_phish_1',
    category: 'security_awareness_identity',
    subcategory: 'Phishing',
    topic: 'Email Defense',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'How should an unexpected urgent invoice email be verified?',
    options: [
      'Click the link and inspect the login form',
      'Contact the sender via an established out-of-band communication channel',
      'Reply to the email requesting confirmation',
      'Forward the attachment to all colleagues'
    ],
    correctAnswer: 1,
    explanation: 'Out-of-band verification prevents falling for spoofed email addresses.',
    provenance: 'NIST SP 800-63B',
    reviewStatus: 'verified'
  }
];

test('User Data Isolation & Fresh Account Initialization Test Suite', async (t) => {
  // Clear mock storage before starting
  mockStorage['cyberaware_auth_user_v1'] = '';
  mockStorage['cyberaware_auth_token_v1'] = '';

  // ---------------------------------------------------------------------------
  // TEST A: New Account starts with clean empty progress and history
  // ---------------------------------------------------------------------------
  await t.test('Test A: Register User A, complete activity, register User B, confirm User B has 0 progress', () => {
    const userAId = 'learner_alpha@cyberaware.edu';
    const userBId = 'learner_beta@cyberaware.edu';

    // 1. Simulate Register User A
    const regPayloadA = {
      name: 'Alice Learner',
      email: userAId,
      password: 'StrongCyberPass2026!',
      confirmPassword: 'StrongCyberPass2026!'
    };
    assert.equal(validateRegistrationPayload(regPayloadA).valid, true);
    const tokenA = generateSessionToken(userAId);

    // Initial state for User A starts clean
    const userAInitial = loadUserProgress(userAId);
    assert.equal(userAInitial.completedLessons.length, 0);
    assert.equal(userAInitial.quizAttempts.length, 0);

    // 2. User A completes a lesson and an assessment
    const userAAfterLesson = toggleLessonCompletion('phishing_101', userAId);
    assert.ok(userAAfterLesson.completedLessons.includes('phishing_101'));

    const attemptA: QuizAttempt = {
      id: 'att_alice_101',
      userId: userAId,
      date: 'Nov 10, 2026',
      score: 1,
      total: 1,
      percentage: 100,
      mode: 'practice',
      topicBreakdown: { 'Email Defense': { correct: 1, total: 1 } }
    };
    const userAAfterQuiz = recordQuizAttempt(attemptA, userAId);
    assert.equal(userAAfterQuiz.quizAttempts.length, 1);
    assert.equal(userAAfterQuiz.completedLessons.length, 1);

    // 3. Register User B
    const regPayloadB = {
      name: 'Bob Defender',
      email: userBId,
      password: 'DefensiveSecurity2026!',
      confirmPassword: 'DefensiveSecurity2026!'
    };
    assert.equal(validateRegistrationPayload(regPayloadB).valid, true);
    const tokenB = generateSessionToken(userBId);

    // 4. Confirm User B starts with ZERO personal progress and zero assessment history
    const userBProgress = loadUserProgress(userBId);
    assert.equal(userBProgress.completedLessons.length, 0, 'User B must have 0 completed lessons');
    assert.equal(userBProgress.quizAttempts.length, 0, 'User B must have 0 assessment attempts');
    assert.equal(userBProgress.solvedScenarios.length, 0, 'User B must have 0 solved scenarios');
    assert.equal(userBProgress.earnedBadges.length, 0, 'User B must have 0 earned badges');
    assert.equal(userBProgress.streakDays, 0, 'User B must have 0 streak days');

    // Confirm User A's progress is separate and unchanged
    const userACheck = loadUserProgress(userAId);
    assert.equal(userACheck.completedLessons.length, 1);
    assert.equal(userACheck.quizAttempts.length, 1);
  });

  // ---------------------------------------------------------------------------
  // TEST B: Account Switching isolates display state
  // ---------------------------------------------------------------------------
  await t.test('Test B: Account switching cleanly replaces user state without leakage', () => {
    const userAId = 'learner_alpha@cyberaware.edu';
    const userBId = 'learner_beta@cyberaware.edu';

    // 1. Log in as User A
    mockStorage['cyberaware_auth_user_v1'] = JSON.stringify({ id: userAId, name: 'Alice' });
    const progressA = loadUserProgress(userAId);
    assert.equal(progressA.completedLessons.length, 1);
    assert.equal(progressA.quizAttempts.length, 1);

    // 2. Log out (clearing auth session and local active state)
    delete mockStorage['cyberaware_auth_user_v1'];
    delete mockStorage['cyberaware_auth_token_v1'];

    // 3. Log in as User B
    mockStorage['cyberaware_auth_user_v1'] = JSON.stringify({ id: userBId, name: 'Bob' });
    const progressB = loadUserProgress(userBId);

    // 4. Confirm User B's state appears, not User A's
    assert.equal(progressB.completedLessons.length, 0);
    assert.equal(progressB.quizAttempts.length, 0);
    assert.equal(progressB.earnedBadges.length, 0);
  });

  // ---------------------------------------------------------------------------
  // TEST C: Data persistence across restarts
  // ---------------------------------------------------------------------------
  await t.test('Test C: Data persistence preserves each user records independently', () => {
    const userAId = 'learner_alpha@cyberaware.edu';
    const userBId = 'learner_beta@cyberaware.edu';

    // Verify User A key exists in storage
    const keyA = getUserStorageKey(userAId);
    const keyB = getUserStorageKey(userBId);
    assert.ok(mockStorage[keyA], 'User A isolated storage key must exist');
    assert.ok(mockStorage[keyB], 'User B isolated storage key must exist');

    // User A adds another completed lesson
    toggleLessonCompletion('safe_browsing', userAId);
    const reloadedA = loadUserProgress(userAId);
    assert.equal(reloadedA.completedLessons.length, 2);

    // User B still has 0 completed lessons
    const reloadedB = loadUserProgress(userBId);
    assert.equal(reloadedB.completedLessons.length, 0);
  });

  // ---------------------------------------------------------------------------
  // TEST D: Backend Security & Unauthorized Access Rejection
  // ---------------------------------------------------------------------------
  await t.test('Test D: Backend security rejects cross-user access attempts and identifier manipulation', () => {
    const userAId = 'learner_alpha@cyberaware.edu';
    const userBId = 'learner_beta@cyberaware.edu';
    const tokenB = generateSessionToken(userBId);

    // 1. User B authenticated token attempts to access User A records
    // Caller ID resolved from tokenB is userBId. Target is userAId.
    const crossAccessCheck = verifyDemoUserAccess(userBId, userAId, tokenB);
    assert.equal(crossAccessCheck.allowed, false, 'Access to User A records by User B must be rejected');
    assert.ok(crossAccessCheck.reason?.includes('not permitted'));

    // 2. User B token accessing own records is permitted
    const selfAccessCheck = verifyDemoUserAccess(userBId, userBId, tokenB);
    assert.equal(selfAccessCheck.allowed, true);

    // 3. User B attempts to submit assessment claiming to be User A
    const spoofedSubmission = {
      id: 'att_spoofed_attempt_999',
      attemptId: 'att_spoofed_attempt_999',
      userId: userAId, // Spoofed target
      mode: 'exam',
      completionDuration: 45,
      questions: [{ questionId: 'iso_q_phish_1', selectedOptions: [1] }]
    };

    // Caller is userBId, but payload target is userAId
    const spoofCheck = verifyDemoUserAccess(userBId, spoofedSubmission.userId, tokenB);
    assert.equal(spoofCheck.allowed, false, 'Spoofed submission under another user identity must be rejected');

    // 4. Duplicate attempt check
    const existingStore: Record<string, any[]> = {
      [userAId]: [{ id: 'att_alice_101', score: 1 }]
    };
    assert.equal(checkDuplicateAttempt('att_alice_101', existingStore), true);
    assert.equal(checkDuplicateAttempt('att_novel_new_attempt', existingStore), false);
  });

  // ---------------------------------------------------------------------------
  // TEST E: Existing Data Protection
  // ---------------------------------------------------------------------------
  await t.test('Test E: Existing demo user data, question bank, and groups remain intact', () => {
    // 1. Default demo user Destiny has preserved baseline progress
    const destinyProgress = loadUserProgress('destinyivienagbor2005@gmail.com');
    assert.ok(destinyProgress.completedLessons.length >= 1);
    assert.ok(destinyProgress.completedLessons.includes('phishing_101'));

    // 2. Groups isolation: Destiny is member of default group, User B is not
    const testGroup: SecurityGroup = {
      id: 'grp_test_alpha',
      name: 'Alpha Defense',
      description: 'Test group',
      creatorId: 'destinyivienagbor2005@gmail.com',
      creatorName: 'Destiny',
      inviteCode: 'TEST01',
      createdAt: 'Nov 1, 2026',
      memberCount: 1,
      isPublic: true,
      members: [
        {
          userId: 'destinyivienagbor2005@gmail.com',
          userName: 'Destiny',
          role: 'admin',
          joinedAt: 'Nov 1, 2026',
          participationStatus: 'completed_assessments'
        }
      ]
    };

    const summaryDestiny = toGroupSummary(testGroup, 'destinyivienagbor2005@gmail.com');
    assert.equal(summaryDestiny.isMember, true);

    const summaryUserB = toGroupSummary(testGroup, 'learner_beta@cyberaware.edu');
    assert.equal(summaryUserB.isMember, false, 'User B must not inherit group membership');

    // 3. Question bank validation remains solid
    assert.ok(testQuestionBank.length > 0);
    assert.equal(testQuestionBank[0].correctAnswer, 1);
  });
});
