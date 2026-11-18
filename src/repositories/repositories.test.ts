import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deriveAttemptDocId,
  deriveRateLimitDocId,
  deriveSessionDocId,
  deriveUserDocKey,
  estimateFirestoreDocBytes,
  normalizeEmailIdentity,
  validateSafeAttemptId
} from '../utils/firestoreKeys';
import { evaluateBadges, evaluateBadgesFromSummary } from '../utils/scoring';
import {
  generateSessionToken,
  hashPassword,
  SESSION_TTL_MS,
  UserAccount
} from '../utils/authUtils';
import { createGroupRecord } from '../utils/groupManagement';
import {
  applyAttemptToUserStats,
  buildEmptyUserStats,
  createCleanStoredProgress,
  createRepositories,
  RateLimiterUnavailableError,
  resolveStorageBackend
} from './index';
import { createFirestoreRepositories } from './firestore';
import { QuizAttempt, QuizQuestion, UserProgressState } from '../types';

// ---------------------------------------------------------------------------
// Strict In-Memory Firestore Fake for Adapter Contract & Transaction Testing
// Enforces:
//   - No writes before reads inside runTransaction()
//   - Single WriteBatch max 500 operations
//   - Real collectionGroup queries and db.getAll()
// ---------------------------------------------------------------------------
class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toMillis() {
    return this.ms;
  }
  static fromMillis(ms: number) {
    return new FakeTimestamp(ms);
  }
  static now() {
    return new FakeTimestamp(Date.now());
  }
}

class FakeDocSnapshot {
  constructor(
    readonly ref: FakeDocRef,
    private readonly payload: any | undefined
  ) {}
  get exists() {
    return this.payload !== undefined;
  }
  get id() {
    return this.ref.id;
  }
  data() {
    return this.payload === undefined ? undefined : structuredCloneFake(this.payload);
  }
}

function structuredCloneFake(val: any): any {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (typeof val.toMillis === 'function') return new FakeTimestamp(val.toMillis());
  if (val instanceof Date) return new Date(val.getTime());
  if (Array.isArray(val)) return val.map(v => structuredCloneFake(v));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) out[k] = structuredCloneFake(v);
  }
  return out;
}

class FakeQuerySnapshot {
  constructor(readonly docs: FakeDocSnapshot[]) {}
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string
  ) {}
  get id(): string {
    const parts = this.path.split('/');
    return parts[parts.length - 1];
  }
  get parent(): FakeCollectionRef {
    const parts = this.path.split('/');
    return new FakeCollectionRef(this.db, parts.slice(0, -1).join('/'));
  }
  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.db, `${this.path}/${name}`);
  }
  async get(): Promise<FakeDocSnapshot> {
    this.db.assertAvailable();
    return new FakeDocSnapshot(this, this.db.store.get(this.path));
  }
  async set(data: any): Promise<void> {
    this.db.assertAvailable();
    this.db.store.set(this.path, structuredCloneFake(data));
  }
  async update(partial: Record<string, any>): Promise<void> {
    this.db.assertAvailable();
    const cur = this.db.store.get(this.path);
    if (!cur) throw new Error(`NOT_FOUND: ${this.path}`);
    this.db.store.set(this.path, { ...cur, ...structuredCloneFake(partial) });
  }
  async create(data: any): Promise<void> {
    this.db.assertAvailable();
    if (this.db.store.has(this.path)) {
      throw new Error(`ALREADY_EXISTS: ${this.path}`);
    }
    this.db.store.set(this.path, structuredCloneFake(data));
  }
  async delete(): Promise<void> {
    this.db.assertAvailable();
    this.db.store.delete(this.path);
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly collectionNameOrPath: string,
    private readonly isCollectionGroup: boolean,
    private readonly filters: Array<{ field: string; op: string; value: any }> = [],
    private readonly orders: Array<{ field: string; dir: 'asc' | 'desc' }> = [],
    private readonly limitCount?: number
  ) {}

  where(field: string, op: string, value: any): FakeQuery {
    return new FakeQuery(
      this.db,
      this.collectionNameOrPath,
      this.isCollectionGroup,
      [...this.filters, { field, op, value }],
      this.orders,
      this.limitCount
    );
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(
      this.db,
      this.collectionNameOrPath,
      this.isCollectionGroup,
      this.filters,
      [...this.orders, { field, dir }],
      this.limitCount
    );
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(
      this.db,
      this.collectionNameOrPath,
      this.isCollectionGroup,
      this.filters,
      this.orders,
      n
    );
  }

  async get(): Promise<FakeQuerySnapshot> {
    this.db.assertAvailable();
    const docs: FakeDocSnapshot[] = [];

    for (const [docPath, data] of this.db.store.entries()) {
      const segments = docPath.split('/');
      const parentColPath = segments.slice(0, -1).join('/');
      const colName = segments[segments.length - 2];

      const pathMatches = this.isCollectionGroup
        ? colName === this.collectionNameOrPath
        : parentColPath === this.collectionNameOrPath;
      if (!pathMatches) continue;

      let filterOk = true;
      for (const f of this.filters) {
        if (f.op === '==' && data[f.field] !== f.value) {
          filterOk = false;
          break;
        }
      }
      if (!filterOk) continue;

      docs.push(new FakeDocSnapshot(new FakeDocRef(this.db, docPath), data));
    }

    for (const o of this.orders) {
      docs.sort((a, b) => {
        const av = a.data()?.[o.field];
        const bv = b.data()?.[o.field];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return o.dir === 'desc' ? -cmp : cmp;
      });
    }

    const sliced = this.limitCount !== undefined ? docs.slice(0, this.limitCount) : docs;
    return new FakeQuerySnapshot(sliced);
  }
}

class FakeCollectionRef extends FakeQuery {
  constructor(private readonly fsDb: FakeFirestore, readonly colPath: string) {
    super(fsDb, colPath, false);
  }
  get parent(): FakeDocRef | null {
    const parts = this.colPath.split('/');
    if (parts.length <= 1) return null;
    return new FakeDocRef(this.fsDb, parts.slice(0, -1).join('/'));
  }
  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.fsDb, `${this.colPath}/${id}`);
  }
}

class FakeWriteBatch {
  private ops: Array<() => void> = [];
  constructor(private readonly db: FakeFirestore) {}
  set(ref: FakeDocRef, data: any) {
    this.ops.push(() => this.db.store.set(ref.path, structuredCloneFake(data)));
    return this;
  }
  delete(ref: FakeDocRef) {
    this.ops.push(() => this.db.store.delete(ref.path));
    return this;
  }
  async commit() {
    this.db.assertAvailable();
    if (this.ops.length > 500) {
      throw new Error(`Batch size ${this.ops.length} exceeds Firestore 500 limit`);
    }
    this.db.committedBatchSizes.push(this.ops.length);
    for (const op of this.ops) op();
  }
}

class FakeTransaction {
  private hasWritten = false;
  private pendingWrites: Array<() => void> = [];
  constructor(private readonly db: FakeFirestore) {}

  async get(ref: FakeDocRef): Promise<FakeDocSnapshot> {
    if (this.hasWritten) {
      throw new Error('Firestore transactions require all reads to be executed before all writes.');
    }
    return new FakeDocSnapshot(ref, this.db.store.get(ref.path));
  }
  create(ref: FakeDocRef, data: any) {
    this.hasWritten = true;
    this.pendingWrites.push(() => {
      if (this.db.store.has(ref.path)) {
        throw new Error(`ALREADY_EXISTS: ${ref.path}`);
      }
      this.db.store.set(ref.path, structuredCloneFake(data));
    });
    return this;
  }
  set(ref: FakeDocRef, data: any) {
    this.hasWritten = true;
    this.pendingWrites.push(() => this.db.store.set(ref.path, structuredCloneFake(data)));
    return this;
  }
  update(ref: FakeDocRef, partial: Record<string, any>) {
    this.hasWritten = true;
    this.pendingWrites.push(() => {
      const cur = this.db.store.get(ref.path);
      if (!cur) throw new Error(`NOT_FOUND: ${ref.path}`);
      this.db.store.set(ref.path, { ...cur, ...structuredCloneFake(partial) });
    });
    return this;
  }
  delete(ref: FakeDocRef) {
    this.hasWritten = true;
    this.pendingWrites.push(() => this.db.store.delete(ref.path));
    return this;
  }
  commitWrites() {
    for (const op of this.pendingWrites) op();
  }
}

class FakeFirestore {
  readonly store = new Map<string, any>();
  readonly committedBatchSizes: number[] = [];
  unavailable = false;
  private txChain: Promise<any> = Promise.resolve();

  assertAvailable() {
    if (this.unavailable) {
      throw new Error('UNAVAILABLE: Simulated Firestore connection outage');
    }
  }

  collection(name: string) {
    return new FakeCollectionRef(this, name);
  }
  collectionGroup(name: string) {
    return new FakeQuery(this, name, true);
  }
  async getAll(...refs: FakeDocRef[]): Promise<FakeDocSnapshot[]> {
    this.assertAvailable();
    return refs.map(r => new FakeDocSnapshot(r, this.store.get(r.path)));
  }
  batch() {
    return new FakeWriteBatch(this);
  }
  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    this.assertAvailable();
    const run = async (): Promise<T> => {
      this.assertAvailable();
      const tx = new FakeTransaction(this);
      const res = await fn(tx);
      tx.commitWrites();
      return res;
    };
    const next = this.txChain.then(run, run);
    this.txChain = next.catch(() => undefined);
    return next;
  }
}

function makeTempDir(prefix = 'cyberaware_repo_test_'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeSampleQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: overrides.id || 'q_test_001',
    topic: 'Network Security',
    category: 'network_security',
    subcategory: 'TLS',
    subtopic: 'TLS 1.3',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    questionType: 'multiple_choice',
    question: 'Which protocol eliminates obsolete RSA key transport to enforce forward secrecy?',
    options: ['TLS 1.3', 'SSL 3.0', 'Telnet', 'HTTP/1.0'],
    correctAnswer: 0,
    correctAnswers: [0],
    explanation: 'TLS 1.3 requires ephemeral key exchange (ECDHE/DHE) for forward secrecy.',
    provenance: 'IETF RFC 8446 Section 2',
    reviewStatus: 'verified',
    creationDate: '2026-11-01T00:00:00.000Z',
    lastVerifiedDate: '2026-11-01T00:00:00.000Z',
    isCustom: false,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// 1. Safe Key Derivation & Backend Configuration Tests
// ---------------------------------------------------------------------------
test('User doc keys are deterministic, normalized, path-safe for special emails, and distinct across users', () => {
  assert.equal(normalizeEmailIdentity('  Alice.Dev@Example.COM '), 'alice.dev@example.com');

  const k1 = deriveUserDocKey('Alice/Ops+Team@example.com');
  const k2 = deriveUserDocKey('  alice/ops+team@EXAMPLE.COM ');
  assert.equal(k1, k2);
  assert.match(k1, /^[0-9a-f]{64}$/);
  assert.equal(k1.includes('/'), false);
  assert.equal(k1.includes('@'), false);

  const other = deriveUserDocKey('bob.ops@example.com');
  assert.notEqual(k1, other);

  assert.throws(() => deriveUserDocKey('   '), /empty identifier/);
});

test('Attempt ID validation & user-scoped doc IDs isolate users and reject unsafe path characters', () => {
  assert.equal(validateSafeAttemptId('attempt_1700000_ab12c').valid, true);
  assert.equal(validateSafeAttemptId('demo_init_attempt').valid, true);
  assert.equal(validateSafeAttemptId('bad/slash/id').valid, false);
  assert.equal(validateSafeAttemptId('../traversal').valid, false);
  assert.equal(validateSafeAttemptId('ab').valid, false);

  const docUserA = deriveAttemptDocId('alice@example.com', 'att_shared_123');
  const docUserB = deriveAttemptDocId('bob@example.com', 'att_shared_123');
  assert.match(docUserA, /^[0-9a-f]{64}$/);
  assert.notEqual(docUserA, docUserB);
  assert.equal(docUserA, deriveAttemptDocId('ALICE@example.com', 'att_shared_123'));

  assert.notEqual(deriveSessionDocId('ca_sec_abc_123_def'), 'ca_sec_abc_123_def');
  assert.match(deriveRateLimitDocId('questions_propose', 'alice/ops@example.com'), /^[0-9a-f]{64}$/);
});

test('Storage backend selector defaults strictly to json and validates explicit configuration', () => {
  assert.equal(resolveStorageBackend(undefined), 'json');
  assert.equal(resolveStorageBackend(''), 'json');
  assert.equal(resolveStorageBackend('JSON'), 'json');
  assert.equal(resolveStorageBackend('firestore'), 'firestore');
  assert.throws(() => resolveStorageBackend('postgres'), /Invalid STORAGE_BACKEND/);

  const tmpDir = makeTempDir();
  const prevEnv = process.env.STORAGE_BACKEND;
  delete process.env.STORAGE_BACKEND;
  try {
    const defaultRepos = createRepositories({ jsonDataDir: tmpDir });
    assert.equal(defaultRepos.backend, 'json');
  } finally {
    if (prevEnv !== undefined) process.env.STORAGE_BACKEND = prevEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 2. Badge Evaluation Parity Tests
// ---------------------------------------------------------------------------
test('evaluateBadgesFromSummary produces identical badge sets to evaluateBadges across combinations', () => {
  const scenarios: Array<{ progress: UserProgressState }> = [
    {
      progress: {
        completedLessons: [],
        completedChecklists: {},
        quizAttempts: [],
        solvedScenarios: [],
        earnedBadges: [],
        streakDays: 0,
        lastVisitDate: '2026-11-18'
      }
    },
    {
      progress: {
        completedLessons: ['phishing_101', 'l2', 'l3', 'l4', 'l5'],
        completedChecklists: {},
        quizAttempts: [
          {
            id: 'a1',
            date: 'Nov 18, 2026',
            score: 8,
            total: 8,
            percentage: 100,
            mode: 'exam',
            topicBreakdown: { Phishing: { correct: 3, total: 3 }, Network: { correct: 3, total: 3 }, Cloud: { correct: 2, total: 2 } }
          }
        ],
        solvedScenarios: ['s1', 's2', 's3'],
        earnedBadges: [],
        streakDays: 5,
        lastVisitDate: '2026-11-18'
      }
    },
    {
      progress: {
        completedLessons: ['phishing_101'],
        completedChecklists: {},
        quizAttempts: [
          { id: 'a1', date: 'd1', score: 3, total: 5, percentage: 60, mode: 'practice', topicBreakdown: { A: { correct: 3, total: 5 } } },
          { id: 'a2', date: 'd2', score: 9, total: 10, percentage: 90, mode: 'exam', topicBreakdown: { B: { correct: 9, total: 10 } } },
          { id: 'a3', date: 'd3', score: 4, total: 5, percentage: 80, mode: 'practice', topicBreakdown: { A: { correct: 4, total: 5 } } }
        ],
        solvedScenarios: ['s1', 's2', 's3', 's4', 's5'],
        earnedBadges: [],
        streakDays: 2,
        lastVisitDate: '2026-11-18'
      }
    }
  ];

  for (const { progress } of scenarios) {
    const expected = evaluateBadges(progress, 5, 5).sort();

    let stats = buildEmptyUserStats('learner@example.com');
    for (const att of progress.quizAttempts) {
      stats = applyAttemptToUserStats(stats, att);
    }
    const { quizAttempts: _omit, ...stored } = progress;
    const actual = evaluateBadgesFromSummary(stored, stats, 5, 5).sort();
    assert.deepEqual(actual, expected);
  }
});

// ---------------------------------------------------------------------------
// 3. JSON Repository Parity Tests (Isolated Temp Dir)
// ---------------------------------------------------------------------------
test('JSON repository bundle preserves Stage 2.2 semantics in isolated storage', async () => {
  const tmpDir = makeTempDir();
  try {
    const repos = createRepositories({ backend: 'json', jsonDataDir: tmpDir });
    assert.equal(repos.backend, 'json');

    const { salt, hash } = hashPassword('StrongPass!2026');
    const learner: UserAccount = {
      id: 'Learner@Example.com',
      email: 'Learner@Example.com',
      name: 'Test Learner',
      role: 'Student / Learner',
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      isDemoUser: false
    };
    await repos.users.createUser(learner);
    const loaded = await repos.users.findByEmailOrId('learner@example.com');
    assert.equal(loaded?.email, 'learner@example.com');
    assert.equal((await repos.users.listDemoUsers()).length, 0);

    // Brute-force lockout after 5 failures
    for (let i = 1; i <= 4; i++) {
      const res = await repos.users.recordLoginFailureAtomic('learner@example.com', 1000 + i);
      assert.equal(res.failedLoginAttempts, i);
      assert.equal(res.lockedUntil, null);
    }
    const locked = await repos.users.recordLoginFailureAtomic('learner@example.com', 2000);
    assert.equal(locked.failedLoginAttempts, 5);
    assert.ok(locked.lockedUntil);

    // Sessions create, retrieve, revoke
    const tok1 = generateSessionToken('learner@example.com');
    const tok2 = generateSessionToken('learner@example.com');
    await repos.sessions.createSession(tok1, 'learner@example.com');
    await repos.sessions.createSession(tok2, 'learner@example.com');
    assert.equal((await repos.sessions.getSessionByToken(tok1))?.userId, 'learner@example.com');
    assert.equal(await repos.sessions.revokeAllUserSessions('learner@example.com'), 2);
    assert.equal(await repos.sessions.getSessionByToken(tok1), null);

    // Group creation, join, and sole-admin block on admin removal
    const grp = createGroupRecord('SecOps', 'Security Operations Group', 'learner@example.com');
    await repos.groups.createGroupAtomic(grp);
    const joinRes = await repos.groups.joinGroupAtomic({
      inviteCode: grp.inviteCode,
      userId: 'peer@example.com',
      userName: 'Peer'
    });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.group?.memberCount, 2);

    const soleAdminRemoval = await repos.groups.removeMemberAtomic(
      grp.id,
      'learner@example.com',
      'learner@example.com'
    );
    assert.equal(soleAdminRemoval.status, 400);

    // Question draft filtering
    await repos.questions.createQuestionsBatch(
      [makeSampleQuestion({ id: 'q_draft_1', reviewStatus: 'draft' })],
      { forceDraft: true }
    );
    const publicList = await repos.questions.listQuestions({ includeDrafts: false });
    assert.equal(publicList.some(q => q.id === 'q_draft_1'), false);
    const reviewerList = await repos.questions.listQuestions({ includeDrafts: true, status: 'draft' });
    assert.equal(reviewerList.some(q => q.id === 'q_draft_1'), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 4. Firestore Repository Adapter & Safeguards Contract Tests
// ---------------------------------------------------------------------------
test('Firestore user, session expiry, and >500 chunked revocation enforce batch limits', async () => {
  const fakeDb = new FakeFirestore();
  const repos = createFirestoreRepositories({ db: fakeDb as any });

  // Email with slash '/' and mixed case
  const trickyEmail = 'Alice/SecOps@Example.COM';
  const { salt, hash } = hashPassword('ValidPass#99');
  await repos.users.createUser({
    id: trickyEmail,
    email: trickyEmail,
    name: 'Alice Ops',
    role: 'Student / Learner',
    salt,
    passwordHash: hash,
    createdAt: '2026-11-18T00:00:00.000Z',
    isDemoUser: false
  });

  // Document key must NEVER be the raw email containing '/'
  const expectedKey = deriveUserDocKey(trickyEmail);
  assert.ok(fakeDb.store.has(`users/${expectedKey}`));
  const foundUser = await repos.users.findByEmailOrId('alice/secops@example.com');
  assert.equal(foundUser?.email, 'alice/secops@example.com');
  assert.equal(foundUser?.id, 'alice/secops@example.com');

  // Expired session rejected at request time and deleted
  const expiredTok = generateSessionToken('alice/secops@example.com');
  await repos.sessions.createSession(
    expiredTok,
    'alice/secops@example.com',
    Date.now() - SESSION_TTL_MS - 10_000,
    Date.now() - 5_000
  );
  assert.equal(await repos.sessions.getSessionByToken(expiredTok), null);

  // Batch revocation > 500 sessions (1,050 sessions -> 3 batches <= 450 each)
  for (let i = 0; i < 1050; i++) {
    const tok = `ca_sec_batchtest_${i}_${'a'.repeat(48)}`;
    await repos.sessions.createSession(tok, 'alice/secops@example.com');
  }
  const deleted = await repos.sessions.revokeAllUserSessions('alice/secops@example.com');
  assert.equal(deleted, 1050);
  assert.equal(fakeDb.committedBatchSizes.length, 3);
  assert.ok(fakeDb.committedBatchSizes.every(sz => sz <= 450));
});

test('Firestore attempts enforce user-scoped doc IDs, O(1) stats, and badge parity', async () => {
  const fakeDb = new FakeFirestore();
  const repos = createFirestoreRepositories({ db: fakeDb as any });

  const makeVerifiedAttempt = (userId: string, clientId: string, score: number, total: number): QuizAttempt & any => ({
    id: clientId,
    attemptId: clientId,
    userId,
    mode: 'exam',
    date: 'Nov 18, 2026',
    timestamp: '2026-11-18T10:00:00.000Z',
    score,
    total,
    totalQuestions: total,
    correctCount: score,
    percentage: Math.round((score / total) * 100),
    difficulty: 'intermediate',
    categoryFilter: 'all',
    topicBreakdown: {
      network_security: { correct: 4, total: 5, percentage: 80 },
      web_appsec: { correct: 5, total: 5, percentage: 100 },
      cryptography_pki: { correct: 0, total: 0, percentage: 0 }
    },
    questionsAttempted: ['q1', 'q2'],
    verifiedAnswers: {
      q1: { isCorrect: true, expectedAnswers: [0], selectedAnswers: [0] },
      q2: { isCorrect: false, expectedAnswers: [1], selectedAnswers: [2] }
    },
    completionDuration: 120,
    verifiedByServer: true
  });

  // Same clientAttemptId from User A and User B must NOT collide or leak
  const resA = await repos.attempts.submitAttemptAtomic({
    userId: 'alice@example.com',
    clientAttemptId: 'shared_client_att_01',
    attempt: makeVerifiedAttempt('alice@example.com', 'shared_client_att_01', 9, 10),
    evaluateBadgesFromSummary
  });
  const resB = await repos.attempts.submitAttemptAtomic({
    userId: 'bob@example.com',
    clientAttemptId: 'shared_client_att_01',
    attempt: makeVerifiedAttempt('bob@example.com', 'shared_client_att_01', 5, 10),
    evaluateBadgesFromSummary
  });

  assert.equal(resA.created, true);
  assert.equal(resB.created, true);
  assert.equal(resA.attempt.id, 'shared_client_att_01');
  assert.equal(resA.attempt.attemptId, 'shared_client_att_01');
  assert.equal(resA.stats.totalCorrectAnswers, 9);
  assert.equal(resB.stats.totalCorrectAnswers, 5);
  assert.ok(resA.earnedBadges.includes('grand_architect'));
  assert.equal(resB.earnedBadges.includes('grand_architect'), false);

  // Duplicate retry by User A is blocked atomically
  const dupA = await repos.attempts.submitAttemptAtomic({
    userId: 'alice@example.com',
    clientAttemptId: 'shared_client_att_01',
    attempt: makeVerifiedAttempt('alice@example.com', 'shared_client_att_01', 10, 10),
    evaluateBadgesFromSummary
  });
  assert.equal(dupA.created, false);
  const statsA = await repos.attempts.getStatsByUser('alice@example.com');
  assert.equal(statsA.totalAttempts, 1);
  assert.equal(statsA.totalCorrectAnswers, 9);

  // Batched stats lookup for multiple users
  const batchStats = await repos.attempts.getStatsForUsers([
    'alice@example.com',
    'bob@example.com',
    'nonexistent@example.com'
  ]);
  assert.equal(batchStats['alice@example.com'].totalCorrectAnswers, 9);
  assert.equal(batchStats['bob@example.com'].totalCorrectAnswers, 5);
  assert.equal(batchStats['nonexistent@example.com'].totalAttempts, 0);
});

test('Firestore groups enforce atomic join capacity, collectionGroup lookup, and sole-admin removal blocks', async () => {
  const fakeDb = new FakeFirestore();
  const repos = createFirestoreRepositories({ db: fakeDb as any });

  const grp = createGroupRecord('Defense Guild', 'Cohort Alpha', 'admin@example.com');
  grp.isPublic = false;
  await repos.groups.createGroupAtomic(grp, 2);

  // Concurrent join race at cap=2: only ONE additional member should succeed
  const [j1, j2] = await Promise.all([
    repos.groups.joinGroupAtomic({ inviteCode: grp.inviteCode, userId: 'u1@example.com', maxMembers: 2 }),
    repos.groups.joinGroupAtomic({ inviteCode: grp.inviteCode, userId: 'u2@example.com', maxMembers: 2 })
  ]);
  const statuses = [j1.status, j2.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  // Duplicate join rejected 409
  const joinedUser = j1.status === 200 ? 'u1@example.com' : 'u2@example.com';
  const dupJoin = await repos.groups.joinGroupAtomic({ inviteCode: grp.inviteCode, userId: joinedUser });
  assert.equal(dupJoin.status, 409);

  // CollectionGroup membership query finds private group for member
  const enrolled = await repos.groups.findGroupsForMember(joinedUser);
  assert.equal(enrolled.length, 1);
  assert.equal(enrolled[0].id, grp.id);
  assert.equal(enrolled[0].memberCount, 2);

  // Non-admin cannot remove admin
  const nonAdminTry = await repos.groups.removeMemberAtomic(grp.id, 'admin@example.com', joinedUser);
  assert.equal(nonAdminTry.status, 403);

  // Sole admin cannot leave while other members remain
  const soleAdminTry = await repos.groups.removeMemberAtomic(grp.id, 'admin@example.com', 'admin@example.com');
  assert.equal(soleAdminTry.status, 400);

  // Member can leave self cleanly
  const memberLeave = await repos.groups.removeMemberAtomic(grp.id, joinedUser, joinedUser);
  assert.equal(memberLeave.status, 200);
  assert.equal(memberLeave.group?.memberCount, 1);

  // Now sole remaining admin CAN leave the empty-afterward group
  const adminFinalLeave = await repos.groups.removeMemberAtomic(grp.id, 'admin@example.com', 'admin@example.com');
  assert.equal(adminFinalLeave.status, 200);
  assert.equal(adminFinalLeave.group?.memberCount, 0);
});

test('Firestore questions enforce draft visibility RBAC and shared rate limiter fails closed on outage', async () => {
  const fakeDb = new FakeFirestore();
  const repos = createFirestoreRepositories({ db: fakeDb as any });

  await repos.questions.createQuestionsBatch(
    [
      makeSampleQuestion({ id: 'q_pub_1', reviewStatus: 'verified' }),
      makeSampleQuestion({ id: 'q_draft_only', reviewStatus: 'verified' })
    ].slice(0, 1)
  );
  await repos.questions.upsertQuestion(
    makeSampleQuestion({ id: 'q_learner_submit', reviewStatus: 'verified' }),
    { isReviewer: false }
  );

  // Even though caller requested 'verified', non-reviewer upsert forced 'draft'
  const learnerQ = await repos.questions.getById('q_learner_submit');
  assert.equal(learnerQ?.reviewStatus, 'draft');
  assert.equal((await repos.questions.listQuestions({ includeDrafts: false })).length, 1);
  assert.equal((await repos.questions.listQuestions({ includeDrafts: false, status: 'draft' })).length, 0);
  assert.equal((await repos.questions.listQuestions({ includeDrafts: true, status: 'draft' })).length, 1);

  // Shared rate limit: 5 allowed, 6th rejected, outage throws RateLimiterUnavailableError (fail closed)
  for (let i = 1; i <= 5; i++) {
    const slot = await repos.rateLimits.consumeSlidingWindowSlot({
      userId: 'learner@example.com',
      route: 'questions_propose',
      maxRequests: 5,
      windowMs: 60_000,
      nowMs: 1_000_000 + i * 100
    });
    assert.equal(slot.allowed, true);
    assert.equal(slot.currentUsage, i);
  }
  const blocked = await repos.rateLimits.consumeSlidingWindowSlot({
    userId: 'learner@example.com',
    route: 'questions_propose',
    maxRequests: 5,
    windowMs: 60_000,
    nowMs: 1_001_000
  });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);

  // Simulate Firestore unavailability -> fail-closed exception
  fakeDb.unavailable = true;
  await assert.rejects(
    () =>
      repos.rateLimits.consumeSlidingWindowSlot({
        userId: 'learner@example.com',
        route: 'questions_propose',
        maxRequests: 5,
        windowMs: 60_000
      }),
    RateLimiterUnavailableError
  );
});

test('Firestore history & progress safeguard against 1 MiB overflow without silent truncation', async () => {
  const fakeDb = new FakeFirestore();
  // Configure tight 1,200 byte budget to exercise shard spilling deterministically
  const tightBudget = 1200;
  const repos = createFirestoreRepositories({ db: fakeDb as any, docBudgetBytes: tightBudget });

  const totalQuestionsToRecord = 40;
  for (let i = 0; i < totalQuestionsToRecord; i++) {
    const qId = `q_hist_scale_${String(i).padStart(3, '0')}`;
    await repos.history.recordEvents('scale.learner@example.com', {
      presentedIds: [qId],
      answeredUpdates: {
        [qId]: {
          isCorrect: i % 2 === 0,
          selectedOptions: [0],
          timestamp: '2026-11-18T12:00:00.000Z'
        }
      },
      flaggedIds: i % 5 === 0 ? [qId] : []
    });
  }

  // Every parent doc and shard must remain strictly <= budget, yet full reassembly loses 0 items
  const parentPath = `userHistory/${deriveUserDocKey('scale.learner@example.com')}`;
  const parentDoc = fakeDb.store.get(parentPath);
  assert.ok(parentDoc);
  assert.ok((parentDoc.overflowShardCount || 0) >= 1);
  assert.ok(estimateFirestoreDocBytes(parentDoc) <= tightBudget);

  const restored = await repos.history.getOrInit('scale.learner@example.com');
  assert.equal(restored.seenQuestionIds.length, totalQuestionsToRecord);
  assert.equal(restored.answeredQuestionIds.length, totalQuestionsToRecord);
  assert.equal(Object.keys(restored.answeredResults).length, totalQuestionsToRecord);
  assert.equal(restored.flaggedQuestionIds.length, 8);

  // Progress oversize guard refuses silently truncating an oversized payload
  const hugeChecklists: Record<string, string[]> = {};
  for (let i = 0; i < 60; i++) {
    hugeChecklists[`module_${i}`] = [`item_alpha_${i}`, `item_beta_${i}`];
  }
  await assert.rejects(
    () =>
      repos.progress.saveProgress(
        'scale.learner@example.com',
        { ...createCleanStoredProgress(), completedChecklists: hugeChecklists },
        evaluateBadgesFromSummary
      ),
    /exceeds safe Firestore document budget/
  );
});
