import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion, normalizeQuestionRecord } from './questionValidation';
import { QuizQuestion } from '../types';
import { getNormalizedSeedQuestions } from '../services/questionDb';
import { generateAndStoreQuestions } from '../services/questionGenerator';

test('validateQuestion detects missing mandatory fields', () => {
  // Empty question object
  const emptyRes = validateQuestion({});
  assert.equal(emptyRes.isValid, false);
  assert.ok(emptyRes.errors.some(e => e.includes('Question ID is required')));
  assert.ok(emptyRes.errors.some(e => e.includes('Topic/Category is required')));
  assert.ok(emptyRes.errors.some(e => e.includes('Subtopic is required')));
  assert.ok(emptyRes.errors.some(e => e.includes('Difficulty must be one of')));
  assert.ok(emptyRes.errors.some(e => e.includes('Question type must be one of')));
  assert.ok(emptyRes.errors.some(e => e.includes('Question prompt is required')));
  assert.ok(emptyRes.errors.some(e => e.includes('Question must have at least 2 distinct answer options')));
  assert.ok(emptyRes.errors.some(e => e.includes('A comprehensive explanation')));
  assert.ok(emptyRes.errors.some(e => e.includes('Provenance/source standard citation is required')));
  assert.ok(emptyRes.errors.some(e => e.includes('Review status must be one of')));
  assert.ok(emptyRes.errors.some(e => e.includes('Creation date must be a valid ISO 8601')));
  assert.ok(emptyRes.errors.some(e => e.includes('Last-verified date must be a valid ISO 8601')));
});

test('validateQuestion accepts fully compliant 12-field question', () => {
  const validQ: QuizQuestion = {
    id: 'test_sec_01',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'DNS Security',
    subtopic: 'DNS & DNSSEC',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    question: 'Which DNS record type provides cryptographic signatures for authentication of DNS data in DNSSEC?',
    options: ['RRSIG', 'CNAME', 'PTR', 'MX'],
    correctAnswer: 0,
    correctAnswers: [0],
    explanation: 'RRSIG holds the cryptographic signature for a record set (RRset) in DNSSEC.',
    provenance: 'RFC 4034 (Resource Records for the DNS Security Extensions)',
    reviewStatus: 'verified',
    creationDate: '2025-01-15T00:00:00.000Z',
    lastVerifiedDate: '2025-02-10T00:00:00.000Z'
  };

  const res = validateQuestion(validQ);
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);
});

test('validateQuestion rejects out-of-bounds correct answer index', () => {
  const invalidAnswerQ: QuizQuestion = {
    id: 'test_sec_02',
    topic: 'Cloud Security',
    category: 'cloud_devsecops',
    subcategory: 'IAM',
    subtopic: 'Cloud IAM & Least Privilege',
    difficulty: 'advanced',
    type: 'multiple_choice',
    question: 'What is the recommended IAM practice for developer access?',
    options: ['Root account only', 'Temporary credentials via STS assume role'],
    correctAnswer: 5, // index 5 is out of bounds for 2 options!
    correctAnswers: [5],
    explanation: 'Temporary STS tokens expire automatically.',
    provenance: 'CIS AWS Foundations Benchmark v2.0',
    reviewStatus: 'verified',
    creationDate: '2025-01-15T00:00:00.000Z',
    lastVerifiedDate: '2025-02-10T00:00:00.000Z'
  };

  const res = validateQuestion(invalidAnswerQ);
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('out of bounds')));
});

test('validateQuestion rejects duplicate options', () => {
  const dupQ: QuizQuestion = {
    id: 'test_sec_03',
    topic: 'Web AppSec',
    category: 'web_appsec',
    subcategory: 'OWASP Top 10',
    subtopic: 'Injection Flaws',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'How do you prevent SQL injection vulnerability?',
    options: ['Parameterized Queries', 'Parameterized Queries'], // Duplicates!
    correctAnswer: 0,
    explanation: 'Parameterized queries separate code from data input.',
    provenance: 'OWASP Top 10 A03:2021',
    reviewStatus: 'verified',
    creationDate: '2025-01-15T00:00:00.000Z',
    lastVerifiedDate: '2025-02-10T00:00:00.000Z'
  };

  const res = validateQuestion(dupQ);
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('duplicate choices detected')));
});

test('getNormalizedSeedQuestions returns all seed questions satisfying 12 fields', () => {
  const seedQuestions = getNormalizedSeedQuestions();
  assert.ok(seedQuestions.length >= 50, `Expected at least 50 seed questions, got ${seedQuestions.length}`);

  for (const q of seedQuestions) {
    const res = validateQuestion(q);
    assert.equal(res.isValid, true, `Seed question ${q.id} failed validation: ${res.errors.join('; ')}`);
    assert.ok(q.id);
    assert.ok(q.topic);
    assert.ok(q.subtopic);
    assert.ok(q.difficulty);
    assert.ok(q.type);
    assert.ok(q.options.length >= 2);
    assert.ok(typeof q.correctAnswer === 'number');
    assert.ok(q.explanation.length >= 15);
    assert.ok(q.provenance && q.provenance.length >= 3);
    assert.ok(q.reviewStatus && ['verified', 'peer_reviewed', 'draft', 'community_submitted'].includes(q.reviewStatus));
    assert.ok(q.creationDate && !isNaN(Date.parse(q.creationDate)));
    assert.ok(q.lastVerifiedDate && !isNaN(Date.parse(q.lastVerifiedDate)));
  }
});

test('generateAndStoreQuestions generates, validates, and stores new unique questions', async () => {
  const result = await generateAndStoreQuestions({
    category: 'network_security',
    subtopic: 'Firewalls & Next-Gen Filters',
    difficulty: 'intermediate',
    count: 2
  });

  assert.equal(result.success, true);
  assert.equal(result.generatedQuestions.length, 2);
  assert.equal(result.errors.length, 0);

  for (const q of result.generatedQuestions) {
    const val = validateQuestion(q);
    assert.equal(val.isValid, true, `Generated question ${q.id} failed validation: ${val.errors.join('; ')}`);
    assert.equal(q.isCustom, true);
    assert.ok(q.provenance);
    assert.ok(q.reviewStatus);
    assert.ok(q.creationDate);
    assert.ok(q.lastVerifiedDate);
  }
});
