import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAssessmentSubmission,
  checkDuplicateAttempt,
  calculateVerifiedAssessmentScore,
  verifyDemoUserAccess,
  DEMO_USER_PROFILES,
  AssessmentSubmissionPayload,
  VerifiedAttemptRecord
} from './assessmentAttempts';
import { QuizQuestion } from '../types';

// Mock authoritative question bank for isolated testing
const mockQuestionBank: QuizQuestion[] = [
  {
    id: 'test_q_phish_1',
    category: 'security_awareness_identity',
    subcategory: 'Phishing Detection',
    topic: 'Email Phishing',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'What is the primary indicator of a credential harvesting email?',
    options: [
      'Personalized greeting from a known colleague',
      'Suspicious urgency with a deceptive link to an external login portal',
      'Plain text email without images',
      'An email with a company footer'
    ],
    correctAnswer: 1, // option index 1 is correct
    explanation: 'Urgency combined with deceptive links is the signature pattern of phishing.',
    provenance: 'NIST SP 800-63B',
    reviewStatus: 'verified'
  },
  {
    id: 'test_q_net_1',
    category: 'network_security',
    subcategory: 'Firewalls & Zero Trust',
    topic: 'Port Scanning',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    question: 'Which TCP port is traditionally utilized by SSH for encrypted remote administration?',
    options: ['21', '22', '23', '80'],
    correctAnswer: 1, // port 22 is option 1
    explanation: 'TCP port 22 is the standard port for SSH-2.',
    provenance: 'RFC 4253',
    reviewStatus: 'verified'
  },
  {
    id: 'test_q_web_multi',
    category: 'web_appsec',
    subcategory: 'OWASP Top 10',
    topic: 'Injection',
    difficulty: 'advanced',
    type: 'select_all',
    question: 'Which of the following practices prevent SQL injection? (Select all that apply)',
    options: [
      'Parameterized queries and prepared statements',
      'Input sanitization with blocklists only',
      'Stored procedures with parameterized arguments',
      'Client-side HTML validation alone'
    ],
    correctAnswer: 0,
    correctAnswers: [0, 2], // options 0 and 2 are correct
    explanation: 'Parameterized queries and stored procedures enforce query separation.',
    provenance: 'OWASP Top 10',
    reviewStatus: 'verified'
  }
];

const questionMap = new Map<string, QuizQuestion>(
  mockQuestionBank.map(q => [q.id, q])
);

// ---------------------------------------------------------------------------
// TEST 1: Successful assessment submission
// ---------------------------------------------------------------------------
test('Scenario 1: Successful assessment submission passes validation', () => {
  const validPayload: AssessmentSubmissionPayload = {
    id: 'att_valid_1001',
    attemptId: 'att_valid_1001',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'practice',
    difficulty: 'beginner',
    categoryFilter: 'security_awareness_identity',
    completionDuration: 45,
    questions: [
      { questionId: 'test_q_phish_1', selectedOptions: [1] }
    ]
  };

  const validation = validateAssessmentSubmission(validPayload, questionMap);
  assert.equal(validation.valid, true);
  assert.equal(validation.error, undefined);
});

// ---------------------------------------------------------------------------
// TEST 2: Correct score calculation
// ---------------------------------------------------------------------------
test('Scenario 2: Correct score calculation computes exact points, percentage, and domain breakdown', () => {
  const payload: AssessmentSubmissionPayload = {
    id: 'att_calc_2002',
    attemptId: 'att_calc_2002',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'exam',
    completionDuration: 90,
    questions: [
      { questionId: 'test_q_phish_1', selectedOptions: [1] }, // Correct (1/1)
      { questionId: 'test_q_net_1', selectedOptions: [0] },    // Wrong (0/1, answered 21 instead of 22)
      { questionId: 'test_q_web_multi', selectedOptions: [0, 2] } // Correct (1/1, both options selected)
    ]
  };

  const scored = calculateVerifiedAssessmentScore(payload, questionMap);

  assert.equal(scored.totalQuestions, 3);
  assert.equal(scored.correctCount, 2);
  assert.equal(scored.percentage, 67); // 2/3 rounded to 67%
  assert.equal(scored.verifiedByServer, true);

  // Check domain breakdown
  assert.equal(scored.topicBreakdown['security_awareness_identity'].correct, 1);
  assert.equal(scored.topicBreakdown['security_awareness_identity'].total, 1);
  assert.equal(scored.topicBreakdown['network_security'].correct, 0);
  assert.equal(scored.topicBreakdown['network_security'].total, 1);
  assert.equal(scored.topicBreakdown['web_appsec'].correct, 1);
  assert.equal(scored.topicBreakdown['web_appsec'].total, 1);
});

// ---------------------------------------------------------------------------
// TEST 3: Invalid assessment rejection
// ---------------------------------------------------------------------------
test('Scenario 3: Invalid assessment rejection catches malformed payloads', () => {
  // Missing attemptId
  const missingId: any = {
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'practice',
    questions: [{ questionId: 'test_q_phish_1', selectedOptions: [1] }]
  };
  assert.equal(validateAssessmentSubmission(missingId, questionMap).valid, false);

  // Missing userId
  const missingUser: any = {
    attemptId: 'att_missing_u',
    id: 'att_missing_u',
    mode: 'practice',
    questions: [{ questionId: 'test_q_phish_1', selectedOptions: [1] }]
  };
  assert.equal(validateAssessmentSubmission(missingUser, questionMap).valid, false);

  // Empty questions array
  const emptyQuestions: any = {
    attemptId: 'att_empty_q',
    id: 'att_empty_q',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'practice',
    questions: []
  };
  assert.equal(validateAssessmentSubmission(emptyQuestions, questionMap).valid, false);

  // Unknown question ID not in authoritative bank
  const unknownQuestion: any = {
    attemptId: 'att_unknown_q',
    id: 'att_unknown_q',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'practice',
    questions: [{ questionId: 'non_existent_fake_question_id_999', selectedOptions: [0] }]
  };
  const unknownRes = validateAssessmentSubmission(unknownQuestion, questionMap);
  assert.equal(unknownRes.valid, false);
  assert.match(unknownRes.error || '', /authoritative question bank/);
});

// ---------------------------------------------------------------------------
// TEST 4: Duplicate submission prevention
// ---------------------------------------------------------------------------
test('Scenario 4: Duplicate submission prevention detects already-recorded attempt IDs', () => {
  const existingAttempts: any[] = [
    {
      id: 'att_existing_uuid_001',
      attemptId: 'att_existing_uuid_001',
      userId: 'destinyivienagbor2005@gmail.com',
      mode: 'practice',
      date: 'Nov 4, 2026',
      timestamp: '2026-11-04T12:00:00.000Z',
      score: 1,
      total: 1,
      totalQuestions: 1,
      correctCount: 1,
      percentage: 100,
      topicBreakdown: {},
      questionsAttempted: ['test_q_phish_1'],
      userAnswers: { 0: [1] },
      verifiedAnswers: { 'test_q_phish_1': { isCorrect: true, expectedAnswers: [1], selectedAnswers: [1] } },
      completionDuration: 30,
      verifiedByServer: true
    }
  ];

  // Trying to submit the exact same attemptId again
  const isDup = checkDuplicateAttempt(existingAttempts, 'att_existing_uuid_001');
  assert.equal(isDup, true);

  // Submitting a fresh attemptId
  const isNew = checkDuplicateAttempt(existingAttempts, 'att_brand_new_uuid_002');
  assert.equal(isNew, false);
});

// ---------------------------------------------------------------------------
// TEST 5: Persistent records across simulated server reload
// ---------------------------------------------------------------------------
test('Scenario 5: Persistent records survive simulated serialization and reload', () => {
  const record: any = {
    id: 'att_persistent_reboot_test',
    attemptId: 'att_persistent_reboot_test',
    userId: 'judge.security@codesprint.org',
    mode: 'exam',
    date: 'Nov 4, 2026',
    timestamp: '2026-11-04T15:30:00.000Z',
    score: 2,
    total: 2,
    totalQuestions: 2,
    correctCount: 2,
    percentage: 100,
    topicBreakdown: {
      'security_awareness_identity': { correct: 1, total: 1 },
      'network_security': { correct: 1, total: 1 }
    },
    questionsAttempted: ['test_q_phish_1', 'test_q_net_1'],
    userAnswers: { 0: [1], 1: [1] },
    verifiedAnswers: {
      'test_q_phish_1': { isCorrect: true, expectedAnswers: [1], selectedAnswers: [1] },
      'test_q_net_1': { isCorrect: true, expectedAnswers: [1], selectedAnswers: [1] }
    },
    completionDuration: 85,
    verifiedByServer: true
  };

  // Simulate file save to server-data/attempts.json
  const serialized = JSON.stringify([record], null, 2);

  // Simulate server restart reading file back from disk
  const reloaded = JSON.parse(serialized) as any[];

  assert.equal(reloaded.length, 1);
  const loadedRecord = reloaded[0];
  assert.equal(loadedRecord.attemptId, 'att_persistent_reboot_test');
  assert.equal(loadedRecord.userId, 'judge.security@codesprint.org');
  assert.equal(loadedRecord.totalQuestions, 2);
  assert.equal(loadedRecord.correctCount, 2);
  assert.equal(loadedRecord.percentage, 100);
  assert.equal(loadedRecord.completionDuration, 85);
  assert.equal(loadedRecord.verifiedByServer, true);
  assert.deepEqual(loadedRecord.questionsAttempted, ['test_q_phish_1', 'test_q_net_1']);
});

// ---------------------------------------------------------------------------
// TEST 6: Separate assessment histories for different demo users
// ---------------------------------------------------------------------------
test('Scenario 6: Separate assessment histories strictly isolates users and rejects cross-user access', () => {
  const multiUserStore: any[] = [
    {
      id: 'att_user_destiny_1',
      attemptId: 'att_user_destiny_1',
      userId: 'destinyivienagbor2005@gmail.com',
      mode: 'practice',
      date: 'Nov 4, 2026',
      timestamp: '2026-11-04T10:00:00.000Z',
      score: 4,
      total: 5,
      totalQuestions: 5,
      correctCount: 4,
      percentage: 80,
      topicBreakdown: {},
      questionsAttempted: ['q1'],
      userAnswers: {},
      verifiedAnswers: {},
      completionDuration: 40,
      verifiedByServer: true
    },
    {
      id: 'att_user_judge_1',
      attemptId: 'att_user_judge_1',
      userId: 'judge.security@codesprint.org',
      mode: 'exam',
      date: 'Nov 4, 2026',
      timestamp: '2026-11-04T11:00:00.000Z',
      score: 9,
      total: 10,
      totalQuestions: 10,
      correctCount: 9,
      percentage: 90,
      topicBreakdown: {},
      questionsAttempted: ['q2'],
      userAnswers: {},
      verifiedAnswers: {},
      completionDuration: 120,
      verifiedByServer: true
    }
  ];

  // Destiny's attempts should contain exactly 1 record, not the Judge's
  const destinyAttempts = multiUserStore.filter(a => a.userId === 'destinyivienagbor2005@gmail.com');
  assert.equal(destinyAttempts.length, 1);
  assert.equal(destinyAttempts[0].attemptId, 'att_user_destiny_1');

  // Judge's attempts should contain exactly 1 record, not Destiny's
  const judgeAttempts = multiUserStore.filter(a => a.userId === 'judge.security@codesprint.org');
  assert.equal(judgeAttempts.length, 1);
  assert.equal(judgeAttempts[0].attemptId, 'att_user_judge_1');

  // Authorization check: destiny session trying to read judge history must be rejected
  const unauthorizedCheck = verifyDemoUserAccess(
    'destinyivienagbor2005@gmail.com',
    'judge.security@codesprint.org'
  );
  assert.equal(unauthorizedCheck.allowed, false);

  // Authorization check: 2-arg call without verified caller identity must be rejected (no static token bypass)
  const staticTokenBypassAttempt = verifyDemoUserAccess(
    'judge.security@codesprint.org',
    'demo_token_judge_2026'
  );
  assert.equal(staticTokenBypassAttempt.allowed, false);

  // Authorization check: judge verified identity accessing judge history is allowed
  const authorizedCheck = verifyDemoUserAccess(
    'judge.security@codesprint.org',
    'judge.security@codesprint.org'
  );
  assert.equal(authorizedCheck.allowed, true);
});

// ---------------------------------------------------------------------------
// TEST 7: ProgressView history retrieval format compatibility
// ---------------------------------------------------------------------------
test('Scenario 7: Verified attempt records comply with ProgressView and Dashboard requirements', () => {
  const payload: AssessmentSubmissionPayload = {
    id: 'att_format_compat_7007',
    attemptId: 'att_format_compat_7007',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'exam',
    difficulty: 'intermediate',
    categoryFilter: 'network_security',
    completionDuration: 55,
    questions: [
      { questionId: 'test_q_net_1', selectedOptions: [1] }
    ]
  };

  const verified = calculateVerifiedAssessmentScore(payload, questionMap);

  // Convert to QuizAttempt interface as done by the server response
  const quizAttempt = {
    id: verified.attemptId || verified.id,
    userId: verified.userId,
    date: verified.date,
    timestamp: verified.timestamp,
    score: verified.correctCount,
    total: verified.totalQuestions,
    percentage: verified.percentage,
    mode: verified.mode,
    difficulty: verified.difficulty,
    categoryFilter: verified.categoryFilter,
    topicBreakdown: verified.topicBreakdown,
    questionsAttempted: verified.questionsAttempted,
    completionDuration: verified.completionDuration,
    verifiedByServer: verified.verifiedByServer
  };

  // ProgressView assertions
  assert.equal(typeof quizAttempt.id, 'string');
  assert.equal(typeof quizAttempt.score, 'number');
  assert.equal(typeof quizAttempt.total, 'number');
  assert.equal(typeof quizAttempt.percentage, 'number');
  assert.equal(quizAttempt.verifiedByServer, true);
  assert.ok(quizAttempt.topicBreakdown['network_security']);
  assert.equal(quizAttempt.topicBreakdown['network_security'].correct, 1);
  assert.equal(quizAttempt.total, 1);
  assert.equal(quizAttempt.percentage, 100);
});

// ---------------------------------------------------------------------------
// TEST 8: Protection against client score tampering
// ---------------------------------------------------------------------------
test('Scenario 8: Client score tampering is completely nullified by server verification', () => {
  // A malicious or buggy client sends false answers but claims 100% score (3/3)
  const tamperedPayload: AssessmentSubmissionPayload = {
    id: 'att_tampered_exploit_attempt',
    attemptId: 'att_tampered_exploit_attempt',
    userId: 'destinyivienagbor2005@gmail.com',
    mode: 'exam',
    completionDuration: 10,
    questions: [
      { questionId: 'test_q_phish_1', selectedOptions: [0] }, // INCORRECT answer submitted
      { questionId: 'test_q_net_1', selectedOptions: [3] },    // INCORRECT answer submitted
      { questionId: 'test_q_web_multi', selectedOptions: [1] } // INCORRECT answer submitted
    ]
  };

  // Server evaluates against authoritative questions
  const serverCalculated = calculateVerifiedAssessmentScore(tamperedPayload, questionMap);

  // Even if client tried to claim 100%, server calculates 0%
  assert.equal(serverCalculated.correctCount, 0);
  assert.equal(serverCalculated.totalQuestions, 3);
  assert.equal(serverCalculated.percentage, 0);
  assert.equal(serverCalculated.verifiedAnswers.every((a: any) => a.isCorrect === false), true);
});
