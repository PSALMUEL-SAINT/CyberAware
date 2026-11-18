import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  verifyPassword,
  generateSessionToken,
  isSessionTokenFormatValid,
  isSessionRecordExpired,
  SESSION_TTL_MS
} from './authUtils';

const BASE_URL = 'http://127.0.0.1:3000';

test('CyberAware Stage 2.2 Critical Security & Authorization Regression Suite', async (t) => {
  let serverAvailable = false;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/demo-users`);
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }

  assert.equal(
    serverAvailable,
    true,
    'Running backend server on 127.0.0.1:3000 is required for API security regression checks'
  );

  // Track temporary artifacts created during tests so server-data remains clean
  const tempUserEmails: string[] = [];
  const tempGroupIds: string[] = [];
  const tempSessionTokens: string[] = [];

  const cleanupTempArtifacts = () => {
    const dataDir = path.join(process.cwd(), 'server-data');

    if (tempSessionTokens.length > 0) {
      const sessionsPath = path.join(dataDir, 'sessions.json');
      if (fs.existsSync(sessionsPath)) {
        const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
        for (const tok of tempSessionTokens) {
          delete sessions[tok];
        }
        fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
      }
    }

    if (tempGroupIds.length > 0) {
      const groupsPath = path.join(dataDir, 'groups.json');
      if (fs.existsSync(groupsPath)) {
        const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
        const filtered = groups.filter((g: any) => !tempGroupIds.includes(g.id));
        fs.writeFileSync(groupsPath, JSON.stringify(filtered, null, 2), 'utf8');
      }
    }

    if (tempUserEmails.length > 0) {
      for (const file of ['users.json', 'progress.json', 'attempts.json', 'user_history.json']) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
          const store = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          for (const email of tempUserEmails) {
            delete store[email];
          }
          fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
        }
      }
    }
  };

  // Register a real ordinary learner account for multi-user / RBAC / isolation tests
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const learnerEmail = `sec_test_learner_${uniqueSuffix}@cyberaware.edu`;
  const learnerPassword = 'StrongSecTestPass#2026!';
  tempUserEmails.push(learnerEmail);

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Stage22 Regression Learner',
      email: learnerEmail,
      password: learnerPassword,
      confirmPassword: learnerPassword
    })
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.equal(regData.success, true);
  assert.equal(regData.user.role, 'Student / Learner');
  const learnerToken = regData.token as string;
  assert.ok(isSessionTokenFormatValid(learnerToken));
  tempSessionTokens.push(learnerToken);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: POST /api/auth/demo-login rejects non-demo users
    // -------------------------------------------------------------------------
    await t.test('1. POST /api/auth/demo-login rejects registered non-demo users (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: learnerEmail, isDemoUser: true, isDemo: true })
      });
      assert.equal(res.status, 403, `Expected 403 for non-demo user demo-login, got ${res.status}`);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.token, undefined);
    });

    // -------------------------------------------------------------------------
    // TEST 2: POST /api/auth/demo-login rejects unknown users without fallback
    // -------------------------------------------------------------------------
    await t.test('2. POST /api/auth/demo-login rejects unknown/missing users without default fallback', async () => {
      const unknownRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'nonexistent.attacker@cyberaware.edu' })
      });
      assert.equal(unknownRes.status, 404);
      const unknownData = await unknownRes.json();
      assert.equal(unknownData.success, false);
      assert.equal(unknownData.user, undefined);

      // Even display-name lookup or empty userId must fail without falling back to Destiny
      const emptyRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(emptyRes.status, 400);

      const displayNameRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'Destiny (Primary Learner)' })
      });
      assert.equal(displayNameRes.status, 404);
    });

    // -------------------------------------------------------------------------
    // TEST 3: POST /api/auth/demo-login succeeds only for designated demo accounts
    // -------------------------------------------------------------------------
    let destinyDemoToken = '';
    let judgeDemoToken = '';

    await t.test('3. POST /api/auth/demo-login succeeds only for server-designated demo accounts', async () => {
      const resDestiny = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'destinyivienagbor2005@gmail.com' })
      });
      assert.equal(resDestiny.status, 200);
      const dataDestiny = await resDestiny.json();
      assert.equal(dataDestiny.success, true);
      assert.equal(dataDestiny.user.id, 'destinyivienagbor2005@gmail.com');
      assert.ok(isSessionTokenFormatValid(dataDestiny.token));
      destinyDemoToken = dataDestiny.token;
      tempSessionTokens.push(destinyDemoToken);

      const resJudge = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'judge.security@codesprint.org' })
      });
      assert.equal(resJudge.status, 200);
      const dataJudge = await resJudge.json();
      assert.equal(dataJudge.success, true);
      assert.equal(dataJudge.user.role, 'Security Evaluator');
      assert.ok(isSessionTokenFormatValid(dataJudge.token));
      judgeDemoToken = dataJudge.token;
      tempSessionTokens.push(judgeDemoToken);
    });

    // -------------------------------------------------------------------------
    // TEST 4: POST /api/assessment/select rejects unauthenticated requests
    // -------------------------------------------------------------------------
    await t.test('4. POST /api/assessment/select rejects unauthenticated requests (401)', async () => {
      const res = await fetch(`${BASE_URL}/api/assessment/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'destinyivienagbor2005@gmail.com',
          count: 5,
          mode: 'assessment'
        })
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    // -------------------------------------------------------------------------
    // TEST 5: POST /api/assessment/select rejects cross-user access/modification
    // -------------------------------------------------------------------------
    await t.test('5. POST /api/assessment/select rejects cross-user history access/tampering (403)', async () => {
      const res = await fetch(`${BASE_URL}/api/assessment/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${learnerToken}`
        },
        body: JSON.stringify({
          userId: 'judge.security@codesprint.org',
          count: 5,
          mode: 'assessment'
        })
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);

      // Legitimate self-selection succeeds
      const selfRes = await fetch(`${BASE_URL}/api/assessment/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${learnerToken}`
        },
        body: JSON.stringify({ count: 3, mode: 'review', reviewFilter: 'all' })
      });
      assert.equal(selfRes.status, 200);
      const selfData = await selfRes.json();
      assert.equal(selfData.success, true);
      assert.ok(Array.isArray(selfData.result?.questions));
    });

    // -------------------------------------------------------------------------
    // TEST 6: POST /api/auth/reset-password does not return verification codes
    // -------------------------------------------------------------------------
    await t.test('6. POST /api/auth/reset-password does not return verification codes', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: learnerEmail })
      });
      assert.equal(res.status, 503);
      const rawText = await res.text();
      assert.equal(rawText.includes('CYBER-892'), false, 'Response must never expose hardcoded verification code');
      const data = JSON.parse(rawText);
      assert.equal(data.success, false);
      assert.equal(data.simulatedCode, undefined);
    });

    // -------------------------------------------------------------------------
    // TEST 7: POST /api/auth/reset-password cannot reset passwords unauthenticated
    // -------------------------------------------------------------------------
    await t.test('7. POST /api/auth/reset-password cannot change passwords without authorization', async () => {
      const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: learnerEmail,
          verificationCode: 'CYBER-892',
          newPassword: 'AttackerPassword999!'
        })
      });
      assert.equal(resetRes.status, 503);
      const resetData = await resetRes.json();
      assert.equal(resetData.success, false);

      // Original password still logs in; attacker password is rejected
      const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: learnerEmail, password: 'AttackerPassword999!' })
      });
      assert.equal(badLogin.status, 401);

      const goodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: learnerEmail, password: learnerPassword })
      });
      assert.equal(goodLogin.status, 200);
      const goodData = await goodLogin.json();
      if (goodData.token) tempSessionTokens.push(goodData.token);
    });

    // Create a private group owned by Destiny for Tests 8 and 9
    const createPrivateGroupRes = await fetch(`${BASE_URL}/api/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${destinyDemoToken}`
      },
      body: JSON.stringify({
        name: `Stage22 Private Audit Squad ${uniqueSuffix}`,
        description: 'Confidential team for regression validation',
        isPublic: false
      })
    });
    assert.equal(createPrivateGroupRes.status, 201);
    const createdGroupData = await createPrivateGroupRes.json();
    const privateGroupId = createdGroupData.group.id as string;
    const privateInviteCode = createdGroupData.group.inviteCode as string;
    tempGroupIds.push(privateGroupId);

    // -------------------------------------------------------------------------
    // TEST 8: Unauthenticated requests cannot read private groups, invite codes, or members
    // -------------------------------------------------------------------------
    await t.test('8. Unauthenticated requests cannot retrieve private group details, invite codes, or member info', async () => {
      const listRes = await fetch(`${BASE_URL}/api/groups`);
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      assert.equal(listData.success, true);

      // Private group must not appear at all
      const leakedPrivate = listData.groups.find((g: any) => g.id === privateGroupId);
      assert.equal(leakedPrivate, undefined, 'Private group must not appear in unauthenticated group listing');

      // Public groups must not leak inviteCode or creatorId
      for (const g of listData.groups) {
        assert.equal(g.inviteCode, '', 'Public discovery summary must redact invite codes');
        assert.equal(g.creatorId, '', 'Public discovery summary must redact internal creator IDs');
        assert.notEqual(g.inviteCode, privateInviteCode);
      }

      const detailRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}`);
      assert.equal(detailRes.status, 401);

      const membersRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}/members`);
      assert.equal(membersRes.status, 401);

      // Even public group details/members require authentication
      const publicDetailRes = await fetch(`${BASE_URL}/api/groups/grp_alpha_defense`);
      assert.equal(publicDetailRes.status, 401);

      const publicMembersRes = await fetch(`${BASE_URL}/api/groups/grp_alpha_defense/members`);
      assert.equal(publicMembersRes.status, 401);
    });

    // -------------------------------------------------------------------------
    // TEST 9: Authenticated non-members cannot access private group details or member lists
    // -------------------------------------------------------------------------
    await t.test('9. Authenticated non-members cannot access private group details or member lists (403)', async () => {
      const listRes = await fetch(`${BASE_URL}/api/groups`, {
        headers: { 'Authorization': `Bearer ${learnerToken}` }
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      const leakedPrivate = listData.groups.find((g: any) => g.id === privateGroupId);
      assert.equal(leakedPrivate, undefined, 'Private group must be hidden from non-members');

      const detailRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}`, {
        headers: { 'Authorization': `Bearer ${learnerToken}` }
      });
      assert.equal(detailRes.status, 403);

      const membersRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}/members`, {
        headers: { 'Authorization': `Bearer ${learnerToken}` }
      });
      assert.equal(membersRes.status, 403);

      // Attempting to join private group by groupId without invite code must fail
      const bypassJoinRes = await fetch(`${BASE_URL}/api/groups/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${learnerToken}`
        },
        body: JSON.stringify({ groupId: privateGroupId })
      });
      assert.equal(bypassJoinRes.status, 403);

      // Member (Destiny) CAN access own private group details and members
      const memberDetailRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}`, {
        headers: { 'Authorization': `Bearer ${destinyDemoToken}` }
      });
      assert.equal(memberDetailRes.status, 200);
      const memberDetailData = await memberDetailRes.json();
      assert.equal(memberDetailData.group.inviteCode, privateInviteCode);

      const memberRosterRes = await fetch(`${BASE_URL}/api/groups/${encodeURIComponent(privateGroupId)}/members`, {
        headers: { 'Authorization': `Bearer ${destinyDemoToken}` }
      });
      assert.equal(memberRosterRes.status, 200);
    });

    // -------------------------------------------------------------------------
    // TEST 10: Public registration cannot self-assign privileged roles
    // -------------------------------------------------------------------------
    await t.test('10. POST /api/auth/register enforces learner allowlist and blocks privileged role assignment', async () => {
      for (const badRole of ['Security Evaluator', 'Educator / Mentor', 'admin', 'moderator']) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Role Escalation Probe',
            email: `sec_test_priv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@cyberaware.edu`,
            password: 'StrongPassword#2026!',
            confirmPassword: 'StrongPassword#2026!',
            role: badRole
          })
        });
        assert.equal(res.status, 403, `Expected 403 for privileged role '${badRole}', got ${res.status}`);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.token, undefined);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 11: Hardcoded static tokens (demo_token_*) cannot authenticate requests
    // -------------------------------------------------------------------------
    await t.test('11. Hardcoded static demo_token_* tokens are strictly rejected (401)', async () => {
      const staticTokens = [
        'demo_token_destiny_2026',
        'demo_token_judge_2026',
        'demo_token_alex_2026'
      ];

      for (const staticTok of staticTokens) {
        const bearerRes = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${staticTok}` }
        });
        assert.equal(bearerRes.status, 401, `Static token ${staticTok} must return 401 via Authorization header`);

        const headerRes = await fetch(`${BASE_URL}/api/user/attempts`, {
          headers: {
            'x-demo-token': staticTok,
            'x-demo-user-id': 'destinyivienagbor2005@gmail.com'
          }
        });
        assert.equal(headerRes.status, 401, `Static token ${staticTok} must return 401 via x-demo-token header`);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 12: Demo accounts authenticate via /api/auth/demo-login and invalidate on logout
    // -------------------------------------------------------------------------
    await t.test('12. Demo accounts get server-generated session via demo-login and become invalid after logout', async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'alex.student@cyberaware.edu' })
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      const alexToken = loginData.token as string;
      tempSessionTokens.push(alexToken);
      assert.ok(isSessionTokenFormatValid(alexToken));

      // Active before logout
      const meBefore = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${alexToken}` }
      });
      assert.equal(meBefore.status, 200);

      // Logout revokes persistent session
      const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${alexToken}` }
      });
      assert.equal(logoutRes.status, 200);

      // Invalid after logout
      const meAfter = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${alexToken}` }
      });
      assert.equal(meAfter.status, 401, 'Session token must be rejected immediately after logout');
    });

    // -------------------------------------------------------------------------
    // TEST 13: Expired and malformed tokens are rejected
    // -------------------------------------------------------------------------
    await t.test('13. Expired and malformed session tokens are rejected (401)', async () => {
      // Malformed / forged tokens
      for (const badToken of ['malformed', 'Bearer abc', 'ca_sec_forged_12345', 'a'.repeat(300)]) {
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${badToken}` }
        });
        assert.equal(res.status, 401, `Malformed token must return 401`);
      }

      // Expired session persisted in sessions.json must be rejected and evicted
      const sessionsPath = path.join(process.cwd(), 'server-data', 'sessions.json');
      const expiredToken = generateSessionToken('destinyivienagbor2005@gmail.com');
      tempSessionTokens.push(expiredToken);
      const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
      const oldTime = Date.now() - SESSION_TTL_MS - 60_000;
      sessions[expiredToken] = {
        userId: 'destinyivienagbor2005@gmail.com',
        createdAt: oldTime,
        expiresAt: oldTime + SESSION_TTL_MS
      };
      fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');

      const expiredRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });
      assert.equal(expiredRes.status, 401, 'Expired session token must return 401');

      const sessionsAfter = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
      assert.equal(sessionsAfter[expiredToken], undefined, 'Expired session token must be evicted from persistent store');
      assert.equal(isSessionRecordExpired({ createdAt: oldTime, expiresAt: oldTime + SESSION_TTL_MS }), true);
    });

    // -------------------------------------------------------------------------
    // TEST 14: Learners receive 403 on POST /api/questions/review; evaluator allowed
    // -------------------------------------------------------------------------
    await t.test('14. Ordinary learners receive 403 on POST /api/questions/review while authorized evaluators pass RBAC', async () => {
      const learnerReviewRes = await fetch(`${BASE_URL}/api/questions/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${learnerToken}`
        },
        body: JSON.stringify({
          questionId: 'sec_auth_01',
          action: 'approve',
          role: 'Security Evaluator' // client-supplied role must be ignored
        })
      });
      assert.equal(learnerReviewRes.status, 403);
      const learnerReviewData = await learnerReviewRes.json();
      assert.equal(learnerReviewData.success, false);

      // Unauthenticated review request returns 401
      const unauthReviewRes = await fetch(`${BASE_URL}/api/questions/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: 'sec_auth_01', action: 'approve' })
      });
      assert.equal(unauthReviewRes.status, 401);

      // Authorized evaluator (Judge) passes RBAC (test with non-destructive nonexistent questionId -> 404 rather than 403/401)
      const judgeReviewRes = await fetch(`${BASE_URL}/api/questions/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${judgeDemoToken}`
        },
        body: JSON.stringify({ questionId: '__nonexistent_probe_id__', action: 'approve' })
      });
      assert.equal(judgeReviewRes.status, 404, 'Authorized evaluator must pass RBAC and reach question lookup');
    });

    // -------------------------------------------------------------------------
    // TEST 15: Existing user accounts, hashes, attempts, progress, groups, questions intact
    // -------------------------------------------------------------------------
    await t.test('15. Existing user data, password hashes, attempts, progress, groups, and questions remain intact', async () => {
      const dataDir = path.join(process.cwd(), 'server-data');
      for (const file of ['users.json', 'attempts.json', 'groups.json', 'progress.json', 'user_history.json']) {
        assert.ok(fs.existsSync(path.join(dataDir, file)), `${file} must exist`);
      }

      const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
      assert.ok(users['destinyivienagbor2005@gmail.com']);
      assert.ok(users['judge.security@codesprint.org']);
      assert.ok(users['alex.student@cyberaware.edu']);
      assert.equal(users['judge.security@codesprint.org'].role, 'Security Evaluator');

      const destiny = users['destinyivienagbor2005@gmail.com'];
      assert.equal(verifyPassword('CyberAware2026!', destiny.salt, destiny.passwordHash), true);

      // Verify existing password login still works end-to-end
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'destinyivienagbor2005@gmail.com', password: 'CyberAware2026!' })
      });
      assert.equal(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.equal(loginData.success, true);
      if (loginData.token) tempSessionTokens.push(loginData.token);

      const questionsRes = await fetch(`${BASE_URL}/api/questions`);
      assert.equal(questionsRes.status, 200);
      const questionsData = await questionsRes.json();
      assert.equal(questionsData.success, true);
      assert.ok(Array.isArray(questionsData.questions) && questionsData.questions.length > 0);

      const groups = JSON.parse(fs.readFileSync(path.join(dataDir, 'groups.json'), 'utf8'));
      assert.ok(Array.isArray(groups) && groups.length >= 2);
    });

    // -------------------------------------------------------------------------
    // TEST 16: Stage 2 non-regression (impersonation, cross-user 403, rate limit)
    // -------------------------------------------------------------------------
    await t.test('16. Stage 2 protections remain intact (impersonation blocked, cross-user 403, rate limit 429)', async () => {
      const qRes = await fetch(`${BASE_URL}/api/user/attempts?userId=destinyivienagbor2005@gmail.com`);
      assert.equal(qRes.status, 401);

      const hRes = await fetch(`${BASE_URL}/api/user/attempts`, {
        headers: { 'x-demo-user-id': 'destinyivienagbor2005@gmail.com' }
      });
      assert.equal(hRes.status, 401);

      const crossRes = await fetch(`${BASE_URL}/api/user/progress?userId=judge.security@codesprint.org`, {
        headers: { 'Authorization': `Bearer ${learnerToken}` }
      });
      assert.equal(crossRes.status, 403);

      let hitRateLimit = false;
      for (let i = 0; i < 7; i++) {
        const res = await fetch(`${BASE_URL}/api/questions/propose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${learnerToken}`
          },
          body: JSON.stringify({ count: 50 })
        });
        if (res.status === 429) {
          hitRateLimit = true;
          break;
        }
      }
      assert.equal(hitRateLimit, true, 'Rate limit must trigger with HTTP 429');
    });
  } finally {
    cleanupTempArtifacts();
  }
});
