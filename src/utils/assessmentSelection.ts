import { QuizQuestion, QuestionDifficulty, QuestionType } from '../types';

export interface UserAssessmentHistory {
  userId: string;
  seenQuestionIds: string[];
  answeredQuestionIds: string[];
  answeredResults: Record<string, { isCorrect: boolean; selectedOptions: number[]; timestamp: string }>;
  flaggedQuestionIds: string[];
}

export interface AssessmentSelectionParams {
  category?: string;
  difficulty?: QuestionDifficulty | 'all';
  type?: QuestionType | 'all';
  count: number;
  mode: 'assessment' | 'review';
  reviewFilter?: 'all' | 'missed' | 'flagged';
  searchQuery?: string;
}

export interface AssessmentSelectionResult {
  questions: QuizQuestion[];
  mode: 'assessment' | 'review';
  requestedCount: number;
  deliveredCount: number;
  poolExhausted: boolean;
  unseenAvailableInPool: number;
  totalEligibleInPool: number;
  exhaustionNotice?: string;
}

/**
 * Server-side / Engine selection with strict no-repeat guarantee in Assessment Mode,
 * and isolated Review Mode for revisiting previously seen questions.
 */
export function selectAssessmentQuestions(
  allQuestions: QuizQuestion[],
  history: UserAssessmentHistory,
  params: AssessmentSelectionParams
): AssessmentSelectionResult {
  const {
    category = 'all',
    difficulty = 'all',
    type = 'all',
    count = 10,
    mode = 'assessment',
    reviewFilter = 'all',
    searchQuery = ''
  } = params;

  const seenSet = new Set(history.seenQuestionIds || []);
  const answeredSet = new Set(history.answeredQuestionIds || []);
  const flaggedSet = new Set(history.flaggedQuestionIds || []);

  // Filter pool by category, difficulty, type, search, and review status
  const basePool = allQuestions.filter(q => {
    // Only approved/verified questions enter scored assessments
    if (q.reviewStatus === 'draft') return false;

    if (category !== 'all' && q.category !== category) return false;
    if (difficulty !== 'all' && q.difficulty !== difficulty) return false;
    if (type !== 'all' && q.type !== type) return false;

    if (searchQuery.trim() !== '') {
      const qText = `${q.question} ${q.topic} ${q.subcategory} ${q.subtopic || ''}`.toLowerCase();
      if (!qText.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  if (mode === 'review') {
    // Review mode: explicitly select from previously seen questions
    const eligibleReviewQuestions = basePool.filter(q => {
      if (!seenSet.has(q.id) && !answeredSet.has(q.id)) return false;

      if (reviewFilter === 'missed') {
        const result = history.answeredResults?.[q.id];
        return result && !result.isCorrect;
      }
      if (reviewFilter === 'flagged') {
        return flaggedSet.has(q.id);
      }
      return true;
    });

    // Shuffle or slice requested count
    const shuffled = [...eligibleReviewQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return {
      questions: selected,
      mode: 'review',
      requestedCount: count,
      deliveredCount: selected.length,
      poolExhausted: selected.length < count,
      unseenAvailableInPool: 0,
      totalEligibleInPool: eligibleReviewQuestions.length,
      exhaustionNotice: selected.length < count
        ? `Review bank has ${selected.length} questions matching your criteria.`
        : undefined
    };
  }

  // Assessment Mode: STRICT NO-REPEAT GUARANTEE
  // Strictly exclude previously seen question IDs across all sessions
  const unseenPool = basePool.filter(q => !seenSet.has(q.id));
  const unseenCount = unseenPool.length;

  if (unseenCount < count) {
    // Available unseen pool is exhausted or less than requested
    // DO NOT secretly deliver repeated questions
    const selected = [...unseenPool]; // Deliver whatever unseen questions remain

    return {
      questions: selected,
      mode: 'assessment',
      requestedCount: count,
      deliveredCount: selected.length,
      poolExhausted: true,
      unseenAvailableInPool: unseenCount,
      totalEligibleInPool: basePool.length,
      exhaustionNotice: unseenCount === 0
        ? `All ${basePool.length} questions in this category/difficulty pool have already been completed across your sessions. We never secretly repeat questions in assessment mode. You can switch to Review Mode to revise your past attempts or use AI pool replenishment to generate newly validated questions.`
        : `Only ${unseenCount} unseen question(s) remain in the active pool for this criteria (requested ${count}). All ${selected.length} unseen questions delivered without repeats.`
    };
  }

  // Pool has sufficient unseen questions. Select distinct questions randomly without duplicates
  const shuffled = [...unseenPool].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  return {
    questions: selected,
    mode: 'assessment',
    requestedCount: count,
    deliveredCount: selected.length,
    poolExhausted: false,
    unseenAvailableInPool: unseenCount,
    totalEligibleInPool: basePool.length
  };
}
