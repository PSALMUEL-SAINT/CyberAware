import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLessonProgress,
  calculateCyberHygieneScore,
  calculateQuizStats,
  evaluateBadges,
  evaluatePasswordStrength,
  evaluateQuestionAnswer,
  calculateAssessmentDomainBreakdown,
  getProficiencyLevel,
  getOptionAnalysis,
  identifyWeakTopicsAndRecommendations,
  calculateComprehensiveMastery
} from './scoring';
import { UserProgressState, QuizAttempt, QuizQuestion } from '../types';

test('calculateLessonProgress calculates accurate percentages', () => {
  assert.equal(calculateLessonProgress(0, 5), 0);
  assert.equal(calculateLessonProgress(2, 5), 40);
  assert.equal(calculateLessonProgress(5, 5), 100);
  assert.equal(calculateLessonProgress(6, 5), 100);
});

test('calculateCyberHygieneScore weights lessons, detective scenarios and quiz scores', () => {
  const emptyState: UserProgressState = {
    completedLessons: [],
    completedChecklists: {},
    quizAttempts: [],
    solvedScenarios: [],
    earnedBadges: [],
    streakDays: 1,
    lastVisitDate: '2026-10-28'
  };

  assert.equal(calculateCyberHygieneScore(emptyState, 5, 5), 0);

  const halfState: UserProgressState = {
    ...emptyState,
    completedLessons: ['m1', 'm2'], // 2/5 * 40 = 16
    solvedScenarios: ['s1'], // 1/5 * 30 = 6
    quizAttempts: [
      {
        id: 'q1',
        date: '2026-10-28',
        score: 8,
        total: 10,
        percentage: 80, // 80% * 30 = 24
        mode: 'practice',
        topicBreakdown: {}
      }
    ]
  };
  // 16 + 6 + 24 = 46
  assert.equal(calculateCyberHygieneScore(halfState, 5, 5), 46);
});

test('calculateQuizStats extracts stats correctly', () => {
  const attempts: QuizAttempt[] = [
    { id: '1', date: '2026-10-25', score: 6, total: 10, percentage: 60, mode: 'practice', topicBreakdown: {} },
    { id: '2', date: '2026-10-26', score: 9, total: 10, percentage: 90, mode: 'exam', topicBreakdown: {} },
    { id: '3', date: '2026-10-27', score: 7, total: 10, percentage: 70, mode: 'practice', topicBreakdown: {} }
  ];

  const stats = calculateQuizStats(attempts);
  assert.equal(stats.totalAttempts, 3);
  assert.equal(stats.bestScorePct, 90);
  assert.equal(stats.latestScorePct, 70);
  assert.equal(stats.averageScorePct, 73);
  assert.equal(stats.passedCount, 2);
});

test('evaluateBadges unlocks badges based on criteria', () => {
  const state: UserProgressState = {
    completedLessons: ['l1'],
    completedChecklists: {},
    quizAttempts: [{ id: 'q1', date: 'today', score: 10, total: 10, percentage: 100, mode: 'exam', topicBreakdown: {} }],
    solvedScenarios: ['s1', 's2', 's3'],
    earnedBadges: [],
    streakDays: 1,
    lastVisitDate: '2026-10-28'
  };

  const badges = evaluateBadges(state, 5, 5);
  assert.ok(badges.includes('first_step'));
  assert.ok(badges.includes('detective_ace'));
  assert.ok(badges.includes('quiz_starter'));
  assert.ok(badges.includes('quiz_high_scorer'));
  assert.ok(badges.includes('quiz_perfectionist'));
  assert.ok(!badges.includes('all_lessons'));
});

test('evaluatePasswordStrength rates passwords effectively', () => {
  const weak = evaluatePasswordStrength('123456');
  assert.equal(weak.level, 'Very Weak');

  const strongPassphrase = evaluatePasswordStrength('Correct-Horse-Battery-Staple-2026!');
  assert.equal(strongPassphrase.level, 'Very Strong');
});

test('evaluateQuestionAnswer handles single-choice accurately', () => {
  const q: QuizQuestion = {
    id: 'test_single',
    topic: 'Network',
    category: 'network_security',
    subcategory: 'TCP/IP',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'TCP handshake order?',
    options: ['ACK-SYN', 'SYN-SYNACK-ACK', 'FIN-ACK'],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'SYN -> SYN-ACK -> ACK',
    tips: 'Handshake'
  };

  const correctRes = evaluateQuestionAnswer(q, [1]);
  assert.equal(correctRes.isCorrect, true);
  assert.equal(correctRes.partialScore, 100);

  const incorrectRes = evaluateQuestionAnswer(q, [0]);
  assert.equal(incorrectRes.isCorrect, false);
  assert.equal(incorrectRes.partialScore, 0);

  const emptyRes = evaluateQuestionAnswer(q, []);
  assert.equal(emptyRes.isCorrect, false);
});

test('evaluateQuestionAnswer handles multi-select (select all) questions', () => {
  const multiQ: QuizQuestion = {
    id: 'test_multi',
    topic: 'Cloud',
    category: 'cloud_devsecops',
    subcategory: 'DevSecOps',
    difficulty: 'advanced',
    type: 'select_all',
    question: 'Select security controls',
    options: ['Pin commit SHAs', 'Hardcode AWS root key', 'Use OIDC tokens', 'Sign build artifacts'],
    correctAnswer: 0,
    correctAnswers: [0, 2, 3],
    explanation: 'OIDC and signing protect pipelines',
    tips: 'Zero secrets'
  };

  // Full correct match
  const fullMatch = evaluateQuestionAnswer(multiQ, [0, 2, 3]);
  assert.equal(fullMatch.isCorrect, true);
  assert.equal(fullMatch.correctCount, 3);
  assert.equal(fullMatch.expectedCount, 3);

  // Partial match (chose 2 correct, 0 incorrect)
  const partialMatch = evaluateQuestionAnswer(multiQ, [0, 2]);
  assert.equal(partialMatch.isCorrect, false);
  assert.equal(partialMatch.correctCount, 2);

  // Partial with penalty (chose 2 correct and 1 wrong)
  const badChoice = evaluateQuestionAnswer(multiQ, [0, 1, 2]);
  assert.equal(badChoice.isCorrect, false);
  assert.equal(badChoice.correctCount, 2);
});

test('calculateAssessmentDomainBreakdown groups scores across categories', () => {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      topic: 'Network',
      category: 'network_security',
      subcategory: 'DNS',
      difficulty: 'beginner',
      type: 'multiple_choice',
      question: 'DNS query port?',
      options: ['53', '80'],
      correctAnswer: 0,
      correctAnswers: [0],
      explanation: 'UDP 53',
      tips: 'Port 53'
    },
    {
      id: 'q2',
      topic: 'Network',
      category: 'network_security',
      subcategory: 'Firewalls',
      difficulty: 'intermediate',
      type: 'multiple_choice',
      question: 'Stateful firewall check?',
      options: ['Packet headers only', 'Connection state table'],
      correctAnswer: 1,
      correctAnswers: [1],
      explanation: 'State table',
      tips: 'State table'
    },
    {
      id: 'q3',
      topic: 'AppSec',
      category: 'web_appsec',
      subcategory: 'Injection',
      difficulty: 'beginner',
      type: 'multiple_choice',
      question: 'Prevent SQLi?',
      options: ['Prepared statements', 'Remove quotes'],
      correctAnswer: 0,
      correctAnswers: [0],
      explanation: 'Prepared statements',
      tips: 'Prepared'
    }
  ];

  const answers = {
    0: [0], // correct (network)
    1: [0], // incorrect (network)
    2: [0]  // correct (web_appsec)
  };

  const breakdown = calculateAssessmentDomainBreakdown(questions, answers);
  assert.equal(breakdown['network_security'].total, 2);
  assert.equal(breakdown['network_security'].correct, 1);
  assert.equal(breakdown['network_security'].percentage, 50);

  assert.equal(breakdown['web_appsec'].total, 1);
  assert.equal(breakdown['web_appsec'].correct, 1);
  assert.equal(breakdown['web_appsec'].percentage, 100);
});

test('getProficiencyLevel returns accurate rating levels', () => {
  assert.equal(getProficiencyLevel(95).tier, 'sentinel');
  assert.equal(getProficiencyLevel(80).tier, 'practitioner');
  assert.equal(getProficiencyLevel(65).tier, 'specialist');
  assert.equal(getProficiencyLevel(40).tier, 'apprentice');
});

test('getOptionAnalysis returns clear rationales for correct and incorrect answers', () => {
  const sampleQ: QuizQuestion = {
    id: 'test_opt_analysis',
    topic: 'Authentication & MFA',
    category: 'security_awareness_identity',
    subcategory: 'MFA',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    question: 'Why avoid SMS OTP?',
    options: ['SMS has low latency', 'SMS is prone to SIM swapping', 'SMS costs too much', 'SMS requires VPN'],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'SMS can be intercepted via SIM-swapping or SS7 attacks.',
    distractorExplanations: {
      0: 'Latency is not the security vulnerability.',
      2: 'Cost is an operational factor, not a cryptographic risk.',
      3: 'SMS does not require a VPN to function.'
    }
  };

  const correctOpt = getOptionAnalysis(sampleQ, 1, [1]);
  assert.equal(correctOpt.isCorrect, true);
  assert.match(correctOpt.label, /Correct/);
  assert.match(correctOpt.rationale, /SIM-swapping/);

  const distractorOpt = getOptionAnalysis(sampleQ, 2, [2]);
  assert.equal(distractorOpt.isCorrect, false);
  assert.match(distractorOpt.label, /Selected/);
  assert.match(distractorOpt.rationale, /Cost is an operational factor/);

  // Test fallback rationale generation when distractorExplanations not provided
  const qWithoutExplicitDistractors: QuizQuestion = {
    id: 'test_auto_distractor',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'DNS',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'What is DNSSEC?',
    options: ['Cryptographically signed DNS zones', 'A browser extension', 'A VPN protocol'],
    correctAnswer: 0,
    explanation: 'DNSSEC signs DNS records using public key cryptography.'
  };

  const autoDistractor = getOptionAnalysis(qWithoutExplicitDistractors, 2, []);
  assert.equal(autoDistractor.isCorrect, false);
  assert.ok(autoDistractor.rationale.length > 20);
});

test('identifyWeakTopicsAndRecommendations detects low accuracy and suggests relevant lessons', () => {
  const attempts: QuizAttempt[] = [
    {
      id: 'att_1',
      date: '2026-03-30',
      score: 5,
      total: 10,
      percentage: 50,
      mode: 'practice',
      topicBreakdown: {
        security_awareness_identity: { correct: 1, total: 4 }, // 25% accuracy -> high urgency
        network_security: { correct: 4, total: 6 } // 67% accuracy -> medium urgency
      }
    }
  ];

  const recommendations = identifyWeakTopicsAndRecommendations(attempts);
  assert.ok(recommendations.length >= 2);
  assert.equal(recommendations[0].topicKey, 'security_awareness_identity');
  assert.equal(recommendations[0].urgency, 'high');
  assert.equal(recommendations[0].suggestedLessonId, 'phishing_101');
  assert.ok(recommendations[0].remediationAdvice.length > 0);

  assert.equal(recommendations[1].topicKey, 'network_security');
  assert.equal(recommendations[1].urgency, 'medium');
  assert.equal(recommendations[1].suggestedLessonId, 'safe_browsing');
});

test('calculateComprehensiveMastery aggregates mastery tiers correctly', () => {
  const attempts: QuizAttempt[] = [
    {
      id: 'att_2',
      date: '2026-03-30',
      score: 9,
      total: 10,
      percentage: 90,
      mode: 'exam',
      topicBreakdown: {
        web_appsec: { correct: 9, total: 10 } // 90% -> master
      }
    }
  ];

  const mastery = calculateComprehensiveMastery(attempts, ['web_appsec', 'cloud_devsecops']);
  assert.equal(mastery['web_appsec'].masteryTier, 'master');
  assert.equal(mastery['web_appsec'].percentage, 90);
  assert.equal(mastery['cloud_devsecops'].masteryTier, 'novice');
  assert.equal(mastery['cloud_devsecops'].attempted, 0);
});


