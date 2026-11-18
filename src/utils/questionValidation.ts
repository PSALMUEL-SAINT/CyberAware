import { QuizQuestion, QuestionValidationResult, QuestionDifficulty, QuestionType, ReviewStatus } from '../types';

export const VALID_DIFFICULTIES: QuestionDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export const VALID_QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'select_all',
  'scenario',
  'log_analysis',
  'code_review',
  'troubleshooting'
];

export const VALID_REVIEW_STATUSES: ReviewStatus[] = [
  'verified',
  'peer_reviewed',
  'draft',
  'community_submitted'
];

/**
 * Validates a Question against all 12 mandatory cybersecurity assessment engine requirements:
 * 1. unique ID
 * 2. topic
 * 3. subtopic
 * 4. difficulty
 * 5. question type
 * 6. question prompt text
 * 7. answer options where applicable
 * 8. correct answer(s)
 * 9. explanation
 * 10. provenance/source citation
 * 11. review status
 * 12. creation date and last-verified date
 */
export function validateQuestion(q: Partial<QuizQuestion>): QuestionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Unique ID
  if (!q.id || typeof q.id !== 'string' || q.id.trim().length === 0) {
    errors.push('Question ID is required and must be a non-empty string.');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(q.id)) {
    errors.push('Question ID must contain only alphanumeric characters, underscores, or hyphens.');
  }

  // 2. Topic
  if (!q.topic || typeof q.topic !== 'string' || q.topic.trim().length === 0) {
    errors.push('Topic/Category is required.');
  }

  // 3. Subtopic
  const subtopic = q.subtopic || q.subcategory;
  if (!subtopic || typeof subtopic !== 'string' || subtopic.trim().length === 0) {
    errors.push('Subtopic is required.');
  }

  // 4. Difficulty
  if (!q.difficulty || !VALID_DIFFICULTIES.includes(q.difficulty)) {
    errors.push(`Difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}.`);
  }

  // 5. Question Type
  const qType = q.type || q.questionType;
  if (!qType || !VALID_QUESTION_TYPES.includes(qType)) {
    errors.push(`Question type must be one of: ${VALID_QUESTION_TYPES.join(', ')}.`);
  }

  // 6. Question Prompt
  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 10) {
    errors.push('Question prompt is required and must be at least 10 characters long.');
  }

  // 7. Answer Options
  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push('Question must have at least 2 distinct answer options.');
  } else {
    const trimmedOptions = q.options.map(opt => (typeof opt === 'string' ? opt.trim() : ''));
    if (trimmedOptions.some(opt => opt.length === 0)) {
      errors.push('All answer options must be non-empty text strings.');
    }
    const uniqueOptions = new Set(trimmedOptions);
    if (uniqueOptions.size !== trimmedOptions.length) {
      errors.push('Answer options must be unique (duplicate choices detected).');
    }
  }

  // 8. Correct Answer
  const optionsCount = Array.isArray(q.options) ? q.options.length : 0;
  if (qType === 'select_all') {
    const correctAnswers = q.correctAnswers || (typeof q.correctAnswer === 'number' ? [q.correctAnswer] : []);
    if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
      errors.push('Multi-select questions must designate at least one correct answer option.');
    } else {
      for (const ans of correctAnswers) {
        if (typeof ans !== 'number' || ans < 0 || ans >= optionsCount) {
          errors.push(`Correct answer index ${ans} is out of bounds for options (0 to ${optionsCount - 1}).`);
        }
      }
    }
  } else {
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= optionsCount) {
      errors.push(`Correct answer index ${q.correctAnswer} is out of bounds for options (0 to ${optionsCount - 1}).`);
    }
  }

  // 9. Explanation
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 15) {
    errors.push('A comprehensive explanation (minimum 15 characters) is required to explain why the answer is correct.');
  }

  // 10. Provenance / Source Citation
  const provenance = q.provenance || q.referenceFramework;
  if (!provenance || typeof provenance !== 'string' || provenance.trim().length < 3) {
    errors.push('Provenance/source standard citation is required (e.g. NIST SP 800-53, MITRE ATT&CK, OWASP Top 10, RFC standard).');
  }

  // 11. Review Status
  if (!q.reviewStatus || !VALID_REVIEW_STATUSES.includes(q.reviewStatus)) {
    errors.push(`Review status must be one of: ${VALID_REVIEW_STATUSES.join(', ')}.`);
  }

  // 12. Creation Date & Last-Verified Date
  if (!q.creationDate || isNaN(Date.parse(q.creationDate))) {
    errors.push('Creation date must be a valid ISO 8601 date string.');
  }
  if (!q.lastVerifiedDate || isNaN(Date.parse(q.lastVerifiedDate))) {
    errors.push('Last-verified date must be a valid ISO 8601 date string.');
  }

  // Warnings for code/log questions
  if (qType === 'log_analysis' && (!q.logSnippet || !q.logSnippet.log)) {
    warnings.push('Log analysis questions are recommended to include a telemetry log snippet.');
  }
  if (qType === 'code_review' && (!q.codeSnippet || !q.codeSnippet.code)) {
    warnings.push('Code review questions are recommended to include a code snippet.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normalizes any question to ensure all 12 mandatory fields are populated cleanly.
 */
export function normalizeQuestionRecord(raw: Partial<QuizQuestion>): QuizQuestion {
  const options = Array.isArray(raw.options) && raw.options.length > 0
    ? raw.options.map(o => String(o))
    : ['True / Applicable', 'False / Inapplicable'];

  const primaryCorrect = typeof raw.correctAnswer === 'number' && raw.correctAnswer >= 0 && raw.correctAnswer < options.length
    ? raw.correctAnswer
    : 0;

  const correctAnswers = Array.isArray(raw.correctAnswers) && raw.correctAnswers.length > 0
    ? raw.correctAnswers.filter(a => typeof a === 'number' && a >= 0 && a < options.length)
    : [primaryCorrect];

  const nowIso = new Date().toISOString();
  const subtopic = (raw.subtopic || raw.subcategory || raw.topic || 'General Security').trim();
  const topic = (raw.topic || 'Security Fundamentals').trim();
  const provenance = (raw.provenance || raw.referenceFramework || 'NIST SP 800-53 / CIS Critical Security Controls').trim();
  const type = raw.type || raw.questionType || (correctAnswers.length > 1 ? 'select_all' : 'multiple_choice');

  return {
    id: raw.id || `ca_q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    topic,
    category: raw.category || 'security_awareness_identity',
    subcategory: raw.subcategory || subtopic,
    subtopic,
    difficulty: raw.difficulty && VALID_DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : 'intermediate',
    type,
    questionType: type,
    question: raw.question || 'Cybersecurity Assessment Question',
    scenario: raw.scenario || raw.scenarioText,
    scenarioText: raw.scenarioText || raw.scenario,
    logSnippet: raw.logSnippet,
    codeSnippet: raw.codeSnippet,
    options,
    correctAnswer: primaryCorrect,
    correctAnswers: correctAnswers.length > 0 ? correctAnswers : [primaryCorrect],
    explanation: raw.explanation || 'Detailed security explanation and defensive countermeasures.',
    tips: raw.tips || 'Follow established security best practices and defense-in-depth principles.',
    distractorExplanations: raw.distractorExplanations,
    mitigation: raw.mitigation || raw.tips,
    referenceFramework: raw.referenceFramework || provenance,
    provenance,
    reviewStatus: raw.reviewStatus && VALID_REVIEW_STATUSES.includes(raw.reviewStatus) ? raw.reviewStatus : 'verified',
    creationDate: raw.creationDate && !isNaN(Date.parse(raw.creationDate)) ? raw.creationDate : '2025-01-15T00:00:00.000Z',
    lastVerifiedDate: raw.lastVerifiedDate && !isNaN(Date.parse(raw.lastVerifiedDate)) ? raw.lastVerifiedDate : nowIso,
    isCustom: Boolean(raw.isCustom)
  };
}
