import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInviteCode,
  validateGroupCreation,
  createGroupRecord,
  validateJoinGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  enrichMemberParticipation,
  toGroupSummary
} from './groupManagement';
import { verifyDemoUserAccess, DEMO_USER_PROFILES } from './assessmentAttempts';
import { SecurityGroup } from '../types';

// ---------------------------------------------------------------------------
// TEST 1: Creating a group
// ---------------------------------------------------------------------------
test('Scenario 1: Creating a group initializes name, creator, code, and admin role', () => {
  const validation = validateGroupCreation({
    name: 'Incident Response Cohort',
    description: 'Collaborative analysis of live security events and malware forensics.',
    creatorId: 'destinyivienagbor2005@gmail.com'
  });
  assert.equal(validation.valid, true);

  const group = createGroupRecord(
    'Incident Response Cohort',
    'Collaborative analysis of live security events and malware forensics.',
    'destinyivienagbor2005@gmail.com',
    ['EXIST1', 'EXIST2']
  );

  assert.equal(group.name, 'Incident Response Cohort');
  assert.equal(group.creatorId, 'destinyivienagbor2005@gmail.com');
  assert.equal(group.memberCount, 1);
  assert.equal(group.members.length, 1);
  assert.equal(group.members[0].userId, 'destinyivienagbor2005@gmail.com');
  assert.equal(group.members[0].role, 'admin'); // Creator is automatically Administrator
  assert.equal(typeof group.inviteCode, 'string');
  assert.equal(group.inviteCode.length, 6);
  assert.match(group.inviteCode, /^[A-Z0-9]{6}$/);
});

// ---------------------------------------------------------------------------
// TEST 2: Generating unique invitation codes
// ---------------------------------------------------------------------------
test('Scenario 2: Generating unique 6-character invitation codes', () => {
  const existing = ['CYB101', 'SEC999', 'ALFA01'];
  const generatedCodes = new Set<string>();

  for (let i = 0; i < 50; i++) {
    const code = generateInviteCode(existing);
    assert.equal(code.length, 6);
    assert.match(code, /^[A-Z0-9]{6}$/);
    assert.equal(existing.includes(code), false);
    generatedCodes.add(code);
  }

  // Ensures high entropy across generated codes
  assert.ok(generatedCodes.size >= 48);
});

// ---------------------------------------------------------------------------
// TEST 3: Joining with a valid invitation code
// ---------------------------------------------------------------------------
test('Scenario 3: Joining with a valid invitation code adds member and increments count', () => {
  const initialGroup = createGroupRecord(
    'Threat Hunting Guild',
    'Detection engineering drills and telemetry queries.',
    'destinyivienagbor2005@gmail.com'
  );

  // Validate join for a second user
  const joinCheck = validateJoinGroup(initialGroup, 'alex.student@cyberaware.edu');
  assert.equal(joinCheck.valid, true);
  assert.equal(joinCheck.status, 200);

  // Add member
  const updated = addMemberToGroup(initialGroup, 'alex.student@cyberaware.edu', 'Alex Rivera');
  assert.equal(updated.memberCount, 2);
  assert.equal(updated.members.length, 2);

  const joinedMember = updated.members.find(m => m.userId === 'alex.student@cyberaware.edu');
  assert.ok(joinedMember);
  assert.equal(joinedMember.role, 'member'); // Standard joiner is member
  assert.equal(joinedMember.userName, 'Alex Rivera');
});

// ---------------------------------------------------------------------------
// TEST 4: Rejecting invalid invitation codes
// ---------------------------------------------------------------------------
test('Scenario 4: Rejecting invalid invitation codes returns 404', () => {
  // Undefined group simulates no match for the invitation code
  const result = validateJoinGroup(undefined, 'alex.student@cyberaware.edu');
  assert.equal(result.valid, false);
  assert.equal(result.status, 404);
  assert.match(result.error || '', /Invalid invitation code/);
});

// ---------------------------------------------------------------------------
// TEST 5: Preventing duplicate membership
// ---------------------------------------------------------------------------
test('Scenario 5: Preventing duplicate membership returns 409 conflict', () => {
  const group = createGroupRecord(
    'Red Team Lab',
    'Authorized penetration testing methodologies.',
    'destinyivienagbor2005@gmail.com'
  );

  // Try to join with the creator who is already a member
  const duplicateCheck = validateJoinGroup(group, 'destinyivienagbor2005@gmail.com');
  assert.equal(duplicateCheck.valid, false);
  assert.equal(duplicateCheck.status, 409);
  assert.match(duplicateCheck.error || '', /already a registered member/);

  // Case insensitive check
  const duplicateUpper = validateJoinGroup(group, 'DESTINYIVIENAGBOR2005@GMAIL.COM');
  assert.equal(duplicateUpper.valid, false);
  assert.equal(duplicateUpper.status, 409);
});

// ---------------------------------------------------------------------------
// TEST 6: Preventing unauthorized group administration
// ---------------------------------------------------------------------------
test('Scenario 6: Preventing unauthorized member removal by non-admins', () => {
  const baseGroup = createGroupRecord(
    'Cloud Security Working Group',
    'IAM policies, least privilege, and container hardening.',
    'destinyivienagbor2005@gmail.com'
  );

  // Add Member 1 and Member 2
  const groupWithAlex = addMemberToGroup(baseGroup, 'alex.student@cyberaware.edu');
  const groupWithJudge = addMemberToGroup(groupWithAlex, 'judge.security@codesprint.org');

  // Alex (a standard member) attempts to remove Judge (another member)
  const unauthorizedRemoval = removeMemberFromGroup(
    groupWithJudge,
    'judge.security@codesprint.org',
    'alex.student@cyberaware.edu' // Requester is not an admin
  );

  assert.equal(unauthorizedRemoval.success, false);
  assert.equal(unauthorizedRemoval.status, 403);
  assert.match(unauthorizedRemoval.error || '', /Unauthorized: Only group administrators/);

  // Admin Destiny removes Judge
  const authorizedRemoval = removeMemberFromGroup(
    groupWithJudge,
    'judge.security@codesprint.org',
    'destinyivienagbor2005@gmail.com' // Admin requester
  );
  assert.equal(authorizedRemoval.success, true);
  assert.equal(authorizedRemoval.group?.memberCount, 2);
});

// ---------------------------------------------------------------------------
// TEST 7: Leaving a group
// ---------------------------------------------------------------------------
test('Scenario 7: Member leaving a group succeeds; sole admin restricted from abandoning multi-member group', () => {
  const baseGroup = createGroupRecord(
    'Network Hardening Group',
    'Firewall rules and segmentation.',
    'destinyivienagbor2005@gmail.com'
  );

  const groupWithMember = addMemberToGroup(baseGroup, 'alex.student@cyberaware.edu');

  // Alex voluntarily leaves
  const leaveResult = removeMemberFromGroup(
    groupWithMember,
    'alex.student@cyberaware.edu',
    'alex.student@cyberaware.edu'
  );
  assert.equal(leaveResult.success, true);
  assert.equal(leaveResult.group?.members.some(m => m.userId === 'alex.student@cyberaware.edu'), false);

  // Destiny (sole admin) tries to leave while Alex is still in the group
  const adminLeaveAttempt = removeMemberFromGroup(
    groupWithMember,
    'destinyivienagbor2005@gmail.com',
    'destinyivienagbor2005@gmail.com'
  );
  assert.equal(adminLeaveAttempt.success, false);
  assert.equal(adminLeaveAttempt.status, 400);
  assert.match(adminLeaveAttempt.error || '', /transferring administrator privileges/);
});

// ---------------------------------------------------------------------------
// TEST 8: Retrieving group members and participation status
// ---------------------------------------------------------------------------
test('Scenario 8: Retrieving group members enriches real assessment participation counts', () => {
  const baseGroup = createGroupRecord(
    'SOC Incident Command',
    'SIEM correlation and incident response playbooks.',
    'destinyivienagbor2005@gmail.com'
  );
  const fullGroup = addMemberToGroup(baseGroup, 'alex.student@cyberaware.edu');

  // Mock attempts store matching server-data/attempts.json
  const mockAttemptsStore: Record<string, any[]> = {
    'destinyivienagbor2005@gmail.com': [
      { id: 'att_1', score: 10, total: 10, date: 'Nov 4, 2026' },
      { id: 'att_2', score: 8, total: 10, date: 'Nov 3, 2026' }
    ],
    'alex.student@cyberaware.edu': []
  };

  const enriched = enrichMemberParticipation(fullGroup.members, mockAttemptsStore);

  const destiny = enriched.find(m => m.userId === 'destinyivienagbor2005@gmail.com')!;
  assert.equal(destiny.assessmentCount, 2);
  assert.equal(destiny.participationStatus, 'completed_assessments');
  assert.equal(destiny.lastActive, 'Nov 4, 2026');

  const alex = enriched.find(m => m.userId === 'alex.student@cyberaware.edu')!;
  assert.equal(alex.assessmentCount, 0);
  assert.equal(alex.participationStatus, 'pending');
});

// ---------------------------------------------------------------------------
// TEST 9: Persistence after simulated server restart
// ---------------------------------------------------------------------------
test('Scenario 9: Groups and member rosters survive disk serialization and reload', () => {
  const group: SecurityGroup = {
    id: 'grp_persistent_test',
    name: 'Persistent Cyber Cohort',
    description: 'Testing file serialization to server-data/groups.json.',
    creatorId: 'destinyivienagbor2005@gmail.com',
    creatorName: 'Destiny',
    inviteCode: 'PERS01',
    createdAt: 'Nov 4, 2026',
    memberCount: 2,
    members: [
      {
        userId: 'destinyivienagbor2005@gmail.com',
        userName: 'Destiny',
        role: 'admin',
        joinedAt: 'Nov 4, 2026',
        participationStatus: 'completed_assessments'
      },
      {
        userId: 'judge.security@codesprint.org',
        userName: 'Judge',
        role: 'member',
        joinedAt: 'Nov 4, 2026',
        participationStatus: 'active'
      }
    ],
    isPublic: true
  };

  // Simulate JSON serialization to server-data/groups.json
  const fileString = JSON.stringify([group], null, 2);

  // Simulate server restart reading file back
  const reloaded = JSON.parse(fileString) as SecurityGroup[];

  assert.equal(reloaded.length, 1);
  const loadedGroup = reloaded[0];
  assert.equal(loadedGroup.id, 'grp_persistent_test');
  assert.equal(loadedGroup.inviteCode, 'PERS01');
  assert.equal(loadedGroup.memberCount, 2);
  assert.equal(loadedGroup.members[0].role, 'admin');
  assert.equal(loadedGroup.members[1].role, 'member');

  // Verify group summary mapping
  const summaryForDestiny = toGroupSummary(loadedGroup, 'destinyivienagbor2005@gmail.com');
  assert.equal(summaryForDestiny.isMember, true);
  assert.equal(summaryForDestiny.currentUserRole, 'admin');
  assert.equal(summaryForDestiny.inviteCode, 'PERS01');

  const summaryForStranger = toGroupSummary(loadedGroup, 'stranger@example.com');
  assert.equal(summaryForStranger.isMember, false);
  assert.equal(summaryForStranger.currentUserRole, undefined);
  assert.equal(summaryForStranger.inviteCode, '');
  assert.equal(summaryForStranger.creatorId, '');
});

// ---------------------------------------------------------------------------
// TEST 10: Isolation between different demo users
// ---------------------------------------------------------------------------
test('Scenario 10: Demo user isolation blocks impersonation and cross-user group actions', () => {
  // Destiny attempting to act as Judge
  const impersonationAttempt = verifyDemoUserAccess(
    'destinyivienagbor2005@gmail.com', // Verified caller identity
    'judge.security@codesprint.org'    // Trying to perform action on behalf of Judge
  );
  assert.equal(impersonationAttempt.allowed, false);
  assert.match(impersonationAttempt.reason || '', /Access denied/);

  // Judge acting as Judge with verified identity
  const validJudgeAccess = verifyDemoUserAccess(
    'judge.security@codesprint.org',
    'judge.security@codesprint.org'
  );
  assert.equal(validJudgeAccess.allowed, true);
});
