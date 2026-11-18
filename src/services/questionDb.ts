import { QuizQuestion, QuestionBankStats, QuestionDifficulty, ReviewStatus } from '../types';
import { QUIZ_QUESTIONS } from '../data/quizData';
import { validateQuestion, normalizeQuestionRecord } from '../utils/questionValidation';

const DB_NAME = 'CyberAwareQuestionDB';
const DB_VERSION = 1;
const STORE_NAME = 'questions';
const LOCAL_STORAGE_KEY = 'cyberaware_question_bank_v2';

let dbInstance: IDBDatabase | null = null;
let isDbInitialized = false;

// Event listeners for question bank updates across components
type ChangeListener = (questions: QuizQuestion[]) => void;
const listeners: Set<ChangeListener> = new Set();

export function subscribeToQuestionBank(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(questions: QuizQuestion[]) {
  listeners.forEach(fn => {
    try {
      fn(questions);
    } catch (err) {
      console.error('Error notifying question bank listener', err);
    }
  });
}

/**
 * Checks if IndexedDB is supported in the current environment
 */
function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Open or initialize IndexedDB connection
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('difficulty', 'difficulty', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('reviewStatus', 'reviewStatus', { unique: false });
        store.createIndex('isCustom', 'isCustom', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Fallback localStorage helpers
 */
function getFromLocalStorage(): QuizQuestion[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('Failed to parse questions from localStorage', e);
    return null;
  }
}

function saveToLocalStorage(questions: QuizQuestion[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    console.warn('Failed to persist questions to localStorage', e);
  }
}

/**
 * Generates verified initial seed questions with all 12 mandatory fields cleanly populated
 */
export function getNormalizedSeedQuestions(): QuizQuestion[] {
  return QUIZ_QUESTIONS.map((q, idx) => {
    const base = normalizeQuestionRecord(q);
    // Ensure unique ID if duplicates existed
    if (!base.id) {
      base.id = `seed_q_${idx + 1}`;
    }
    base.reviewStatus = 'verified';
    base.creationDate = '2025-01-10T08:00:00.000Z';
    base.lastVerifiedDate = '2025-02-15T12:00:00.000Z';
    return base;
  });
}

/**
 * Initialize the Question Bank:
 * Opens DB, checks if questions exist, and auto-seeds on first run.
 */
export async function initQuestionDb(): Promise<QuizQuestion[]> {
  const seedQuestions = getNormalizedSeedQuestions();

  if (!isIndexedDBAvailable()) {
    // Pure localStorage fallback
    let current = getFromLocalStorage();
    if (!current || current.length === 0) {
      current = seedQuestions;
      saveToLocalStorage(current);
    }
    isDbInitialized = true;
    notifyListeners(current);
    return current;
  }

  try {
    const db = await openIndexedDB();
    const existing = await new Promise<QuizQuestion[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QuizQuestion[]);
      req.onerror = () => reject(req.error);
    });

    if (existing.length === 0) {
      // First time initialization: Seed with the complete 56+ verified question bank
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        seedQuestions.forEach(q => store.put(q));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      saveToLocalStorage(seedQuestions);
      isDbInitialized = true;
      notifyListeners(seedQuestions);
      return seedQuestions;
    }

    saveToLocalStorage(existing);
    isDbInitialized = true;
    notifyListeners(existing);
    return existing;
  } catch (err) {
    console.warn('IndexedDB initialization failed, falling back to localStorage cache:', err);
    let fallback = getFromLocalStorage();
    if (!fallback || fallback.length === 0) {
      fallback = seedQuestions;
      saveToLocalStorage(fallback);
    }
    isDbInitialized = true;
    notifyListeners(fallback);
    return fallback;
  }
}

/**
 * Retrieves all questions from the active database
 */
export async function getAllQuestions(): Promise<QuizQuestion[]> {
  if (!isDbInitialized) {
    return initQuestionDb();
  }

  if (isIndexedDBAvailable() && dbInstance) {
    try {
      const questions = await new Promise<QuizQuestion[]>((resolve, reject) => {
        const tx = dbInstance!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as QuizQuestion[]);
        req.onerror = () => reject(req.error);
      });
      return questions;
    } catch (e) {
      console.warn('Error reading from IndexedDB, falling back to localStorage', e);
    }
  }

  return getFromLocalStorage() || getNormalizedSeedQuestions();
}

/**
 * Retrieves a single question by its unique ID
 */
export async function getQuestionById(id: string): Promise<QuizQuestion | null> {
  const all = await getAllQuestions();
  return all.find(q => q.id === id) || null;
}

/**
 * Saves a question (insert or update). Validates all 12 mandatory fields before persisting.
 */
export async function saveQuestion(
  questionData: Partial<QuizQuestion>
): Promise<{ success: boolean; error?: string; question?: QuizQuestion }> {
  const normalized = normalizeQuestionRecord(questionData);
  const validation = validateQuestion(normalized);

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join(' | ')
    };
  }

  // Update last verified timestamp to now
  normalized.lastVerifiedDate = new Date().toISOString();

  if (isIndexedDBAvailable() && dbInstance) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = dbInstance!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(normalized);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB save failed, using localStorage', e);
    }
  }

  // Also update localStorage cache and notify subscribers
  const current = await getAllQuestions();
  const idx = current.findIndex(q => q.id === normalized.id);
  let updatedList: QuizQuestion[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = normalized;
  } else {
    updatedList = [normalized, ...current];
  }
  saveToLocalStorage(updatedList);
  notifyListeners(updatedList);

  return {
    success: true,
    question: normalized
  };
}

/**
 * Deletes a question by unique ID
 */
export async function deleteQuestion(id: string): Promise<boolean> {
  if (isIndexedDBAvailable() && dbInstance) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = dbInstance!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB delete failed, using localStorage', e);
    }
  }

  const current = await getAllQuestions();
  const filtered = current.filter(q => q.id !== id);
  saveToLocalStorage(filtered);
  notifyListeners(filtered);
  return true;
}

/**
 * Resets the question bank to the pristine, verified default seed bank
 */
export async function resetToDefaultSeed(): Promise<QuizQuestion[]> {
  const seedQuestions = getNormalizedSeedQuestions();

  if (isIndexedDBAvailable() && dbInstance) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = dbInstance!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        seedQuestions.forEach(q => store.put(q));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB reset failed, updating localStorage', e);
    }
  }

  saveToLocalStorage(seedQuestions);
  notifyListeners(seedQuestions);
  return seedQuestions;
}

/**
 * Computes live database statistics
 */
export async function getQuestionBankStats(): Promise<QuestionBankStats> {
  const all = await getAllQuestions();

  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<QuestionDifficulty, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    expert: 0
  };
  const byReviewStatus: Record<ReviewStatus, number> = {
    verified: 0,
    peer_reviewed: 0,
    draft: 0,
    community_submitted: 0
  };

  let customCount = 0;

  for (const q of all) {
    // category
    const cat = String(q.category || 'other');
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    // difficulty
    if (byDifficulty[q.difficulty] !== undefined) {
      byDifficulty[q.difficulty]++;
    }

    // review status
    const status = q.reviewStatus || 'verified';
    if (byReviewStatus[status] !== undefined) {
      byReviewStatus[status]++;
    } else {
      byReviewStatus.verified++;
    }

    if (q.isCustom) {
      customCount++;
    }
  }

  return {
    total: all.length,
    byCategory,
    byDifficulty,
    byReviewStatus,
    customCount
  };
}

/**
 * Export full question bank as pretty formatted JSON
 */
export async function exportQuestionBankJson(): Promise<string> {
  const questions = await getAllQuestions();
  return JSON.stringify(questions, null, 2);
}

/**
 * Import questions in bulk from JSON string, validating every record
 */
export async function importQuestionsFromJson(
  jsonString: string
): Promise<{ importedCount: number; errors: string[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { importedCount: 0, errors: ['Invalid JSON format. Check file syntax.'] };
  }

  if (!Array.isArray(parsed)) {
    return { importedCount: 0, errors: ['Expected an array of question objects.'] };
  }

  const errors: string[] = [];
  let importedCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i];
    const normalized = normalizeQuestionRecord(raw);
    const validation = validateQuestion(normalized);

    if (!validation.isValid) {
      errors.push(`Question #${i + 1} (${raw?.id || 'unknown ID'}): ${validation.errors.join('; ')}`);
      continue;
    }

    normalized.isCustom = true;
    normalized.reviewStatus = normalized.reviewStatus || 'peer_reviewed';
    await saveQuestion(normalized);
    importedCount++;
  }

  return { importedCount, errors };
}
