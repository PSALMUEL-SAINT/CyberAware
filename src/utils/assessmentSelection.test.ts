import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAssessmentQuestions, UserAssessmentHistory } from './assessmentSelection';
import { QuizQuestion } from '../types';

const mockQuestions: QuizQuestion[] = [
  {
    id: 'q_net_1',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'Firewalls',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'What is a packet filter?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    explanation: 'Basic explanation',
    reviewStatus: 'verified'
  },
  {
    id: 'q_net_2',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'DNS',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'What is DNSSEC?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 1,
    explanation: 'Basic explanation',
    reviewStatus: 'verified'
  },
  {
    id: 'q_net_3',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'VPNs',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'What is IPsec tunneling?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 2,
    explanation: 'Basic explanation',
    reviewStatus: 'verified'
  },
  {
    id: 'q_net_4_draft',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'VPNs',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'Unverified draft question?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    explanation: 'Draft explanation',
    reviewStatus: 'draft'
  }
];

const emptyHistory: UserAssessmentHistory = {
  userId: 'test_user',
  seenQuestionIds: [],
  answeredQuestionIds: [],
  answeredResults: {},
  flaggedQuestionIds: []
};

test('selectAssessmentQuestions strictly excludes seen questions in assessment mode', () => {
  const history: UserAssessmentHistory = {
    ...emptyHistory,
    seenQuestionIds: ['q_net_1']
  };

  const result = selectAssessmentQuestions(mockQuestions, history, {
    category: 'network_security',
    difficulty: 'beginner',
    count: 2,
    mode: 'assessment'
  });

  assert.equal(result.deliveredCount, 2);
  const ids = result.questions.map(q => q.id);
  assert.equal(ids.includes('q_net_1'), false, 'Previously seen question must NOT be included');
  assert.equal(ids.includes('q_net_4_draft'), false, 'Draft question must NOT be included in assessment');
  assert.deepEqual(ids.sort(), ['q_net_2', 'q_net_3'].sort());
  assert.equal(result.poolExhausted, false);
});

test('selectAssessmentQuestions flags pool exhaustion and does NOT secretly repeat questions', () => {
  const history: UserAssessmentHistory = {
    ...emptyHistory,
    seenQuestionIds: ['q_net_1', 'q_net_2', 'q_net_3']
  };

  const result = selectAssessmentQuestions(mockQuestions, history, {
    category: 'network_security',
    difficulty: 'beginner',
    count: 2,
    mode: 'assessment'
  });

  assert.equal(result.poolExhausted, true);
  assert.equal(result.deliveredCount, 0);
  assert.equal(result.unseenAvailableInPool, 0);
  assert.ok(result.exhaustionNotice?.includes('never secretly repeat questions'));
});

test('selectAssessmentQuestions handles partial pool exhaustion transparently', () => {
  const history: UserAssessmentHistory = {
    ...emptyHistory,
    seenQuestionIds: ['q_net_1', 'q_net_2']
  };

  const result = selectAssessmentQuestions(mockQuestions, history, {
    category: 'network_security',
    difficulty: 'beginner',
    count: 2, // Requested 2, but only 1 unseen remains
    mode: 'assessment'
  });

  assert.equal(result.poolExhausted, true);
  assert.equal(result.deliveredCount, 1);
  assert.equal(result.questions[0].id, 'q_net_3');
  assert.ok(result.exhaustionNotice?.includes('Only 1 unseen question(s) remain'));
});

test('selectAssessmentQuestions in review mode allows reviewing previously seen and missed questions', () => {
  const history: UserAssessmentHistory = {
    ...emptyHistory,
    seenQuestionIds: ['q_net_1', 'q_net_2'],
    answeredQuestionIds: ['q_net_1', 'q_net_2'],
    answeredResults: {
      q_net_1: { isCorrect: false, selectedOptions: [2], timestamp: '2025-01-01' },
      q_net_2: { isCorrect: true, selectedOptions: [1], timestamp: '2025-01-01' }
    }
  };

  // Review mode filtering by 'missed'
  const result = selectAssessmentQuestions(mockQuestions, history, {
    category: 'network_security',
    count: 5,
    mode: 'review',
    reviewFilter: 'missed'
  });

  assert.equal(result.mode, 'review');
  assert.equal(result.deliveredCount, 1);
  assert.equal(result.questions[0].id, 'q_net_1');
});
