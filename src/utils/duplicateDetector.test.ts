import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  normalizeText, 
  jaccardSimilarity, 
  calculateQuestionSimilarity, 
  checkForDuplicates 
} from './duplicateDetector';

test('normalizeText strips punctuation, converts to lower case and removes stop words', () => {
  const raw = "What is the primary function of a Stateful Firewall in Network Security?!";
  const normalized = normalizeText(raw);
  assert.equal(normalized.includes('what'), false);
  assert.equal(normalized.includes('is'), false);
  assert.equal(normalized.includes('the'), false);
  assert.equal(normalized.includes('firewall'), true);
  assert.equal(normalized.includes('stateful'), true);
  assert.equal(normalized.includes('?'), false);
});

test('jaccardSimilarity correctly measures token overlap', () => {
  const setA = new Set(['firewall', 'packet', 'filtering']);
  const setB = new Set(['firewall', 'packet', 'filtering']);
  assert.equal(jaccardSimilarity(setA, setB), 1.0);

  const setC = new Set(['firewall', 'packet', 'inspection']);
  const sim = jaccardSimilarity(setA, setC);
  assert.equal(sim, 0.5); // 2 intersection / 4 union

  const setD = new Set(['antivirus', 'malware']);
  assert.equal(jaccardSimilarity(setA, setD), 0.0);
});

test('calculateQuestionSimilarity detects high similarity for paraphrased questions', () => {
  const q1 = "How does multi-factor authentication (MFA) protect against credential stuffing attacks?";
  const q2 = "In what way does multi-factor authentication (MFA) defend against credential stuffing attacks?";
  const similarity = calculateQuestionSimilarity(q1, q2);
  assert.ok(similarity >= 0.70, `Similarity ${similarity} should be >= 0.70`);
});

test('calculateQuestionSimilarity returns low score for completely different questions', () => {
  const q1 = "What is the primary purpose of a DNS sinkhole in incident response?";
  const q2 = "Which password hashing algorithm uses memory hardness to resist GPU attacks?";
  const similarity = calculateQuestionSimilarity(q1, q2);
  assert.ok(similarity < 0.35, `Similarity ${similarity} should be < 0.35`);
});

test('checkForDuplicates flags exact duplicates', () => {
  const existing = [
    { id: 'q_net_1', question: 'What is the main benefit of network microsegmentation?' },
    { id: 'q_net_2', question: 'Explain how Address Resolution Protocol (ARP) spoofing operates.' }
  ];

  const candidate = 'What is the main benefit of network microsegmentation?';
  const result = checkForDuplicates(candidate, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.reason, 'exact_match');
  assert.equal(result.matchedQuestionId, 'q_net_1');
});

test('checkForDuplicates flags near duplicates above threshold', () => {
  const existing = [
    { id: 'q_net_1', question: 'What is the key benefit of adopting network microsegmentation?' }
  ];

  const candidate = 'What is the main benefit of adopting network microsegmentation in zero trust?';
  const result = checkForDuplicates(candidate, existing, 0.60);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchedQuestionId, 'q_net_1');
});

test('checkForDuplicates accepts unique, novel questions', () => {
  const existing = [
    { id: 'q_net_1', question: 'What is the main benefit of network microsegmentation?' },
    { id: 'q_sec_1', question: 'Which header prevents clickjacking attacks in modern browsers?' }
  ];

  const novel = 'How does an attacker bypass canary tokens in a compromised CI/CD pipeline?';
  const result = checkForDuplicates(novel, existing);
  assert.equal(result.isDuplicate, false);
  assert.equal(result.reason, 'unique');
});
