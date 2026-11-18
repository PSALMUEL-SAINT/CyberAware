import type { DocumentReference, Firestore, Transaction } from '@google-cloud/firestore';
import { UserAssessmentHistory } from '../../utils/assessmentSelection';
import {
  deriveUserDocKey,
  estimateFirestoreDocBytes,
  FIRESTORE_SAFE_DOC_LIMIT_BYTES,
  normalizeEmailIdentity
} from '../../utils/firestoreKeys';

export interface FirestoreHistoryDocument extends UserAssessmentHistory {
  userKey: string;
  overflowShardCount?: number;
}

export interface HistoryOverflowShard {
  shardIndex: number;
  seenQuestionIds: string[];
  answeredQuestionIds: string[];
  answeredResults: Record<
    string,
    { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
  >;
  flaggedQuestionIds: string[];
}

export function createEmptyFirestoreHistory(userId: string): FirestoreHistoryDocument {
  const normalized = normalizeEmailIdentity(userId);
  return {
    userId: normalized,
    userKey: deriveUserDocKey(normalized),
    seenQuestionIds: [],
    answeredQuestionIds: [],
    answeredResults: {},
    flaggedQuestionIds: [],
    overflowShardCount: 0
  };
}

/**
 * Merges incoming history events into an existing in-memory history snapshot without duplicates or data loss.
 */
export function mergeHistoryEvents(
  base: UserAssessmentHistory,
  update: {
    presentedIds?: string[];
    answeredUpdates?: Record<
      string,
      { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
    >;
    flaggedIds?: string[];
  }
): UserAssessmentHistory {
  const seenSet = new Set(base.seenQuestionIds || []);
  const answeredSet = new Set(base.answeredQuestionIds || []);
  const flaggedSet = new Set(base.flaggedQuestionIds || []);
  const answeredResults = { ...(base.answeredResults || {}) };

  for (const id of update.presentedIds || []) {
    if (id && typeof id === 'string') {
      seenSet.add(id);
    }
  }

  for (const [qId, res] of Object.entries(update.answeredUpdates || {})) {
    if (qId && res) {
      answeredSet.add(qId);
      answeredResults[qId] = res;
    }
  }

  for (const id of update.flaggedIds || []) {
    if (id && typeof id === 'string') {
      flaggedSet.add(id);
    }
  }

  return {
    userId: base.userId,
    seenQuestionIds: Array.from(seenSet),
    answeredQuestionIds: Array.from(answeredSet),
    answeredResults,
    flaggedQuestionIds: Array.from(flaggedSet)
  };
}

/**
 * Reassembles parent history document plus any overflow shards without data loss.
 */
export function combineParentAndShards(
  parentDoc: FirestoreHistoryDocument,
  shards: HistoryOverflowShard[]
): UserAssessmentHistory {
  let merged: UserAssessmentHistory = {
    userId: parentDoc.userId,
    seenQuestionIds: [...(parentDoc.seenQuestionIds || [])],
    answeredQuestionIds: [...(parentDoc.answeredQuestionIds || [])],
    answeredResults: { ...(parentDoc.answeredResults || {}) },
    flaggedQuestionIds: [...(parentDoc.flaggedQuestionIds || [])]
  };

  for (const shard of shards) {
    merged = mergeHistoryEvents(merged, {
      presentedIds: shard.seenQuestionIds,
      answeredUpdates: shard.answeredResults,
      flaggedIds: shard.flaggedQuestionIds
    });
    // Include any answeredQuestionIds that did not have a corresponding result map entry
    for (const qId of shard.answeredQuestionIds || []) {
      if (!merged.answeredQuestionIds.includes(qId)) {
        merged.answeredQuestionIds.push(qId);
      }
    }
  }

  return merged;
}

/**
 * Plans writes for a Firestore history document so it never approaches Firestore's 1 MiB ceiling
 * and never silently truncates any user question IDs, answers, or flags.
 * If the inline parent document exceeds `budgetBytes`, the newly spilled chunk is moved to
 * an immutable `shards/shard_{index}` subcollection document while leaving a compact parent doc.
 */
export function buildSafeHistoryWritePlan(
  userId: string,
  incomingInlineHistory: UserAssessmentHistory,
  existingShardCount: number = 0,
  budgetBytes: number = FIRESTORE_SAFE_DOC_LIMIT_BYTES
): {
  parentDoc: FirestoreHistoryDocument;
  newShard: HistoryOverflowShard | null;
} {
  const normalized = normalizeEmailIdentity(userId);
  const userKey = deriveUserDocKey(normalized);

  const candidate: FirestoreHistoryDocument = {
    userId: normalized,
    userKey,
    seenQuestionIds: [...(incomingInlineHistory.seenQuestionIds || [])],
    answeredQuestionIds: [...(incomingInlineHistory.answeredQuestionIds || [])],
    answeredResults: { ...(incomingInlineHistory.answeredResults || {}) },
    flaggedQuestionIds: [...(incomingInlineHistory.flaggedQuestionIds || [])],
    overflowShardCount: existingShardCount
  };

  if (estimateFirestoreDocBytes(candidate) <= budgetBytes) {
    return { parentDoc: candidate, newShard: null };
  }

  // Spill half of the inline collections (or at least enough to fit) into an overflow shard subcollection
  // while keeping recent/remaining items inline, guaranteeing zero silent truncation.
  const seen = candidate.seenQuestionIds;
  const answered = candidate.answeredQuestionIds;
  const flagged = candidate.flaggedQuestionIds;
  const resultEntries = Object.entries(candidate.answeredResults);

  const spillSeenCount = seen.length > 1 ? Math.ceil(seen.length / 2) : seen.length;
  const spillAnsweredCount =
    answered.length > 1 ? Math.ceil(answered.length / 2) : answered.length;
  const spillFlaggedCount =
    flagged.length > 1 ? Math.ceil(flagged.length / 2) : flagged.length;
  const spillResultsCount =
    resultEntries.length > 1
      ? Math.ceil(resultEntries.length / 2)
      : resultEntries.length;

  const shardAnsweredResults: Record<
    string,
    { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
  > = {};
  for (const [k, v] of resultEntries.slice(0, spillResultsCount)) {
    shardAnsweredResults[k] = v;
  }

  const remainingAnsweredResults: Record<
    string,
    { isCorrect: boolean; selectedOptions: number[]; timestamp: string }
  > = {};
  for (const [k, v] of resultEntries.slice(spillResultsCount)) {
    remainingAnsweredResults[k] = v;
  }

  const shardIndex = existingShardCount;
  const newShard: HistoryOverflowShard = {
    shardIndex,
    seenQuestionIds: seen.slice(0, spillSeenCount),
    answeredQuestionIds: answered.slice(0, spillAnsweredCount),
    answeredResults: shardAnsweredResults,
    flaggedQuestionIds: flagged.slice(0, spillFlaggedCount)
  };

  // Validate that the newly minted shard itself fits comfortably inside the document limit
  if (estimateFirestoreDocBytes(newShard) > budgetBytes) {
    throw new Error(
      `Single history overflow shard exceeds safe Firestore limit (${budgetBytes} bytes). Split batch updates into smaller chunks.`
    );
  }

  const compactedParent: FirestoreHistoryDocument = {
    userId: normalized,
    userKey,
    seenQuestionIds: seen.slice(spillSeenCount),
    answeredQuestionIds: answered.slice(spillAnsweredCount),
    answeredResults: remainingAnsweredResults,
    flaggedQuestionIds: flagged.slice(spillFlaggedCount),
    overflowShardCount: existingShardCount + 1
  };

  if (estimateFirestoreDocBytes(compactedParent) > budgetBytes) {
    throw new Error(
      `Compacted userHistory parent document still exceeds safe Firestore limit (${budgetBytes} bytes).`
    );
  }

  return { parentDoc: compactedParent, newShard };
}

export function applyHistoryWritePlanInTx(
  tx: Transaction,
  historyRef: DocumentReference,
  plan: { parentDoc: FirestoreHistoryDocument; newShard: HistoryOverflowShard | null }
): void {
  tx.set(historyRef, plan.parentDoc);
  if (plan.newShard) {
    const shardId = `shard_${String(plan.newShard.shardIndex).padStart(4, '0')}`;
    const shardRef = historyRef.collection('shards').doc(shardId);
    tx.set(shardRef, plan.newShard);
  }
}

export async function readFullHistoryDoc(
  _db: Firestore,
  historyRef: DocumentReference
): Promise<{
  parent: FirestoreHistoryDocument | null;
  fullHistory: UserAssessmentHistory | null;
}> {
  const snap = await historyRef.get();
  if (!snap.exists) {
    return { parent: null, fullHistory: null };
  }
  const parent = snap.data() as FirestoreHistoryDocument;
  if (!parent.overflowShardCount || parent.overflowShardCount <= 0) {
    return {
      parent,
      fullHistory: combineParentAndShards(parent, [])
    };
  }
  const shardsSnap = await historyRef.collection('shards').get();
  const shards = shardsSnap.docs
    .map(d => d.data() as HistoryOverflowShard)
    .sort((a, b) => a.shardIndex - b.shardIndex);
  return {
    parent,
    fullHistory: combineParentAndShards(parent, shards)
  };
}
