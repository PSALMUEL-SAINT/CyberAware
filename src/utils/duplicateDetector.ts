/**
 * Duplicate & Near-Duplicate Detection Engine
 * Uses text normalization, token-level n-gram overlap, Jaccard index,
 * Overlap coefficient, Dice coefficient, and edit distance to calculate
 * semantic/lexical similarity between cybersecurity questions.
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  maxSimilarity: number;
  matchedQuestionId?: string;
  matchedQuestionText?: string;
  reason?: 'exact_match' | 'near_duplicate' | 'unique';
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'which', 'what', 'how', 'when',
  'where', 'who', 'why', 'following', 'best', 'describes', 'most',
  'likely', 'should', 'would', 'could', 'can', 'primary', 'main'
]);

/**
 * Normalizes text for comparison:
 * - Converts to lowercase
 * - Strips punctuation, non-alphanumeric characters (keeping spaces)
 * - Removes stop words
 * - Collapses whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
    .join(' ')
    .trim();
}

/**
 * Generates character or word tokens
 */
export function getWordTokens(text: string): Set<string> {
  const normalized = normalizeText(text);
  if (!normalized) return new Set();
  return new Set(normalized.split(/\s+/));
}

/**
 * Computes Jaccard similarity coefficient between two sets of tokens (0.0 to 1.0)
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Computes Overlap coefficient (useful for subset/containment similarity)
 */
export function overlapCoefficient(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }
  const minSize = Math.min(setA.size, setB.size);
  return minSize === 0 ? 0 : intersectionCount / minSize;
}

/**
 * Calculates bigram tokens for phrase-level matching
 */
export function getBigrams(text: string): Set<string> {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const bigrams = new Set<string>();
  if (words.length < 2) {
    if (words.length === 1) bigrams.add(words[0]);
    return bigrams;
  }
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]}_${words[i + 1]}`);
  }
  return bigrams;
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
  let currRow = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const bChar = b.charCodeAt(j - 1);
      const cost = aChar === bChar ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      );
    }
    prevRow = [...currRow];
  }

  return currRow[n];
}

/**
 * Normalized string similarity ratio (0.0 to 1.0) using Levenshtein distance
 */
export function editSimilarity(strA: string, strB: string): number {
  const normA = normalizeText(strA);
  const normB = normalizeText(strB);
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Combined hybrid similarity score between two questions:
 * Blends Token Jaccard, Overlap Coefficient, Bigram similarity, and Edit ratio.
 */
export function calculateQuestionSimilarity(textA: string, textB: string): number {
  const normA = normalizeText(textA);
  const normB = normalizeText(textB);

  // Exact normalized match
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = getWordTokens(textA);
  const tokensB = getWordTokens(textB);
  const tokenJaccard = jaccardSimilarity(tokensA, tokensB);
  const tokenOverlap = overlapCoefficient(tokensA, tokensB);

  const bigramsA = getBigrams(textA);
  const bigramsB = getBigrams(textB);
  const bigramJaccard = jaccardSimilarity(bigramsA, bigramsB);

  let editSim = 0;
  if (normA.length < 150 && normB.length < 150) {
    editSim = editSimilarity(textA, textB);
  } else {
    editSim = tokenJaccard;
  }

  // Weight formula balances token vocabulary (30%), token overlap/subset (30%), bigrams (25%), edit distance (15%)
  const combined = (tokenJaccard * 0.30) + (tokenOverlap * 0.30) + (bigramJaccard * 0.25) + (editSim * 0.15);
  return Number(combined.toFixed(3));
}

/**
 * Checks a candidate question text against an existing question bank.
 * Rejects if similarity threshold is met (default threshold: 0.65).
 */
export function checkForDuplicates(
  candidateText: string,
  existingQuestions: Array<{ id: string; question: string }>,
  threshold = 0.65
): DuplicateCheckResult {
  const normCandidate = normalizeText(candidateText);

  let highestScore = 0;
  let matchedId: string | undefined;
  let matchedText: string | undefined;

  for (const item of existingQuestions) {
    const normExisting = normalizeText(item.question);
    if (normCandidate === normExisting) {
      return {
        isDuplicate: true,
        maxSimilarity: 1.0,
        matchedQuestionId: item.id,
        matchedQuestionText: item.question,
        reason: 'exact_match'
      };
    }

    const similarity = calculateQuestionSimilarity(candidateText, item.question);
    if (similarity > highestScore) {
      highestScore = similarity;
      matchedId = item.id;
      matchedText = item.question;
    }
  }

  if (highestScore >= threshold) {
    return {
      isDuplicate: true,
      maxSimilarity: highestScore,
      matchedQuestionId: matchedId,
      matchedQuestionText: matchedText,
      reason: 'near_duplicate'
    };
  }

  return {
    isDuplicate: false,
    maxSimilarity: highestScore,
    reason: 'unique'
  };
}
