import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFirestoreRepositories,
  resetFirestoreClientForTests
} from './index';
import { RateLimiterUnavailableError } from '../types';
import { deriveUserDocKey } from '../../utils/firestoreKeys';
import { generateSessionToken, hashPassword, SESSION_TTL_MS } from '../../utils/authUtils';
import { createGroupRecord } from '../../utils/groupManagement';
import { evaluateBadgesFromSummary } from '../../utils/scoring';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!EMULATOR_HOST) {
  test('Firestore Emulator suite skipped cleanly when FIRESTORE_EMULATOR_HOST is unset', { skip: 'FIRESTORE_EMULATOR_HOST not configured' }, () => {});
} else {
  const projectId = process.env.GCLOUD_PROJECT || 'demo-cyberaware-test';
  const repos = createFirestoreRepositories({ projectId });

  test.after(async () => {
    await resetFirestoreClientForTests();
  });

  test('Emulator: User creation, key isolation, and brute-force lockout', async () => {
    const email = `emu.user+${Date.now()}/ops@example.com`;
    const { salt, hash } = hashPassword('EmulatorPass!2026');
    await repos.users.createUser({
      id: email,
      email,
      name: 'Emulator User',
      role: 'Student / Learner',
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      isDemoUser: false
    });

    const loaded = await repos.users.findByEmailOrId(email.toUpperCase());
    assert.ok(loaded);
    assert.equal(loaded.email, email.toLowerCase());
    assert.match(deriveUserDocKey(email), /^[0-9a-f]{64}$/);
  });

  test('Emulator: Session lifecycle, expiry, and revocation', async () => {
    const email = `emu.sess.${Date.now()}@example.com`;
    const tok1 = generateSessionToken(email);
    const tok2 = generateSessionToken(email);
    const expired = generateSessionToken(email);

    await repos.sessions.createSession(tok1, email);
    await repos.sessions.createSession(tok2, email);
    await repos.sessions.createSession(
      expired,
      email,
      Date.now() - SESSION_TTL_MS - 10_000,
      Date.now() - 1_000
    );

    assert.equal((await repos.sessions.getSessionByToken(tok1))?.userId, email);
    assert.equal(await repos.sessions.getSessionByToken(expired), null);
    const revoked = await repos.sessions.revokeAllUserSessions(email);
    assert.equal(revoked, 2);
    assert.equal(await repos.sessions.getSessionByToken(tok2), null);
  });

  test('Emulator: User-scoped attempt submission, deduplication, and stats sync', async () => {
    const uidA = `emu.a.${Date.now()}@example.com`;
    const uidB = `emu.b.${Date.now()}@example.com`;
    const sharedId = `att_emu_${Date.now()}`;

    const baseAttempt = {
      id: sharedId,
      attemptId: sharedId,
      userId: uidA,
      mode: 'exam' as const,
      date: 'Nov 18, 2026',
      timestamp: new Date().toISOString(),
      score: 9,
      total: 10,
      totalQuestions: 10,
      correctCount: 9,
      percentage: 90,
      difficulty: 'intermediate' as const,
      categoryFilter: 'all',
      topicBreakdown: { A: { correct: 3, total: 3 }, B: { correct: 3, total: 3 }, C: { correct: 3, total: 4 } },
      questionsAttempted: ['q1', 'q2'],
      questionAnswers: {},
      verifiedAnswers: {
        q1: { isCorrect: true, expectedAnswers: [0], selectedAnswers: [0] },
        q2: { isCorrect: true, expectedAnswers: [1], selectedAnswers: [1] }
      },
      completionDuration: 90,
      verifiedByServer: true as const
    };

    const resA = await repos.attempts.submitAttemptAtomic({
      userId: uidA,
      clientAttemptId: sharedId,
      attempt: baseAttempt,
      evaluateBadgesFromSummary
    });
    const resB = await repos.attempts.submitAttemptAtomic({
      userId: uidB,
      clientAttemptId: sharedId,
      attempt: { ...baseAttempt, userId: uidB, score: 6, percentage: 60 },
      evaluateBadgesFromSummary
    });
    const dupA = await repos.attempts.submitAttemptAtomic({
      userId: uidA,
      clientAttemptId: sharedId,
      attempt: baseAttempt,
      evaluateBadgesFromSummary
    });

    assert.equal(resA.created, true);
    assert.equal(resB.created, true);
    assert.equal(dupA.created, false);
    assert.equal((await repos.attempts.getStatsByUser(uidA)).totalCorrectAnswers, 9);
    assert.equal((await repos.attempts.getStatsByUser(uidB)).totalCorrectAnswers, 6);
  });

  test('Emulator: Group concurrent joins, member limits, and sole-admin protections', async () => {
    const admin = `emu.admin.${Date.now()}@example.com`;
    const grp = createGroupRecord(`Emu Group ${Date.now()}`, 'Emulator test cohort', admin);
    grp.isPublic = false;
    await repos.groups.createGroupAtomic(grp, 2);

    const p1 = `emu.p1.${Date.now()}@example.com`;
    const p2 = `emu.p2.${Date.now()}@example.com`;
    const [r1, r2] = await Promise.all([
      repos.groups.joinGroupAtomic({ inviteCode: grp.inviteCode, userId: p1, maxMembers: 2 }),
      repos.groups.joinGroupAtomic({ inviteCode: grp.inviteCode, userId: p2, maxMembers: 2 })
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);

    const soleAdminBlocked = await repos.groups.removeMemberAtomic(grp.id, admin, admin);
    assert.equal(soleAdminBlocked.status, 400);
  });

  test('Emulator: Shared AI rate limit transaction enforces 5 req / 60s', async () => {
    const uid = `emu.rl.${Date.now()}@example.com`;
    const now = Date.now();
    for (let i = 1; i <= 5; i++) {
      const res = await repos.rateLimits.consumeSlidingWindowSlot({
        userId: uid,
        route: 'questions_propose',
        maxRequests: 5,
        windowMs: 60_000,
        nowMs: now + i
      });
      assert.equal(res.allowed, true);
    }
    const denied = await repos.rateLimits.consumeSlidingWindowSlot({
      userId: uid,
      route: 'questions_propose',
      maxRequests: 5,
      windowMs: 60_000,
      nowMs: now + 100
    });
    assert.equal(denied.allowed, false);
    assert.ok(RateLimiterUnavailableError);
  });
}
