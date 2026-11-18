import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateGroupLeaderboard,
  canAccessGroupLeaderboard,
  calculateUserStandings,
  isVerifiedAttempt
} from './groupLeaderboard';
import { SecurityGroup } from '../types';

describe('CyberAware Group Leaderboard & Competitive Scoring', () => {
  const sampleGroup: SecurityGroup = {
    id: 'grp_alpha_squad',
    name: 'Cyber Defense Squad Alpha',
    description: 'Foundational cyber defense and incident triage.',
    creatorId: 'destinyivienagbor2005@gmail.com',
    creatorName: 'Destiny (Primary Learner)',
    inviteCode: 'CYB101',
    createdAt: 'Nov 1, 2026',
    memberCount: 3,
    members: [
      {
        userId: 'destinyivienagbor2005@gmail.com',
        userName: 'Destiny (Primary Learner)',
        role: 'admin',
        joinedAt: 'Nov 1, 2026'
      },
      {
        userId: 'alex.student@cyberaware.edu',
        userName: 'Alex Rivera (Peer Learner)',
        role: 'member',
        joinedAt: 'Nov 2, 2026'
      },
      {
        userId: 'judge.security@codesprint.org',
        userName: 'CodeSprint Security Judge',
        role: 'member',
        joinedAt: 'Nov 3, 2026'
      }
    ],
    isPublic: false
  };

  it('Scenario 1: Correct ranking based on server-verified scores', () => {
    const attemptsStore = {
      'destinyivienagbor2005@gmail.com': [
        {
          id: 'att_d1',
          score: 9,
          total: 10,
          percentage: 90,
          verifiedByServer: true,
          date: 'Nov 2, 2026'
        },
        {
          id: 'att_d2',
          score: 8,
          total: 10,
          percentage: 80,
          verifiedByServer: true,
          date: 'Nov 3, 2026'
        }
      ],
      'alex.student@cyberaware.edu': [
        {
          id: 'att_a1',
          score: 7,
          total: 10,
          percentage: 70,
          verifiedByServer: true,
          date: 'Nov 2, 2026'
        }
      ],
      'judge.security@codesprint.org': [
        {
          id: 'att_j1',
          score: 10,
          total: 10,
          percentage: 100,
          verifiedByServer: true,
          date: 'Nov 3, 2026'
        },
        {
          id: 'att_j2',
          score: 10,
          total: 10,
          percentage: 100,
          verifiedByServer: true,
          date: 'Nov 4, 2026'
        }
      ]
    };

    const leaderboard = calculateGroupLeaderboard(sampleGroup, attemptsStore);

    assert.strictEqual(leaderboard.length, 3);
    // Judge has 20 total points (10+10) -> Rank 1
    assert.strictEqual(leaderboard[0].userId, 'judge.security@codesprint.org');
    assert.strictEqual(leaderboard[0].rank, 1);
    assert.strictEqual(leaderboard[0].totalPoints, 20);
    assert.strictEqual(leaderboard[0].averageScore, 100);
    assert.strictEqual(leaderboard[0].completedAssessments, 2);

    // Destiny has 17 total points (9+8) -> Rank 2
    assert.strictEqual(leaderboard[1].userId, 'destinyivienagbor2005@gmail.com');
    assert.strictEqual(leaderboard[1].rank, 2);
    assert.strictEqual(leaderboard[1].totalPoints, 17);
    assert.strictEqual(leaderboard[1].averageScore, 85);

    // Alex has 7 total points -> Rank 3
    assert.strictEqual(leaderboard[2].userId, 'alex.student@cyberaware.edu');
    assert.strictEqual(leaderboard[2].rank, 3);
    assert.strictEqual(leaderboard[2].totalPoints, 7);
    assert.strictEqual(leaderboard[2].averageScore, 70);
  });

  it('Scenario 2: Group membership filtering strictly isolates cohort members', () => {
    const attemptsStoreWithOutsider = {
      'destinyivienagbor2005@gmail.com': [
        { id: 'att_d1', score: 10, percentage: 100, verifiedByServer: true }
      ],
      'outsider.hacker@evilcorp.com': [
        { id: 'att_out1', score: 999, percentage: 100, verifiedByServer: true }
      ]
    };

    const leaderboard = calculateGroupLeaderboard(sampleGroup, attemptsStoreWithOutsider);

    const userIds = leaderboard.map(l => l.userId);
    assert.ok(!userIds.includes('outsider.hacker@evilcorp.com'), 'Outsider must never be included in the group leaderboard');
    assert.strictEqual(leaderboard.find(l => l.userId === 'destinyivienagbor2005@gmail.com')?.totalPoints, 10);
  });

  it('Scenario 3: Multi-tier tie-breaking rules', () => {
    // Both Alice and Bob have 10 total points, but Alice has 1 attempt (100% avg) and Bob has 2 attempts (50% avg)
    const tiedGroup: SecurityGroup = {
      ...sampleGroup,
      members: [
        { userId: 'user_a', userName: 'Alice', role: 'member', joinedAt: 'Nov 1, 2026' },
        { userId: 'user_b', userName: 'Bob', role: 'member', joinedAt: 'Nov 1, 2026' },
        { userId: 'user_c', userName: 'Charlie', role: 'member', joinedAt: 'Nov 1, 2026' }
      ]
    };

    const attemptsStore = {
      user_a: [
        { id: 'a1', score: 10, percentage: 100, verifiedByServer: true }
      ],
      user_b: [
        { id: 'b1', score: 5, percentage: 50, verifiedByServer: true },
        { id: 'b2', score: 5, percentage: 50, verifiedByServer: true }
      ],
      user_c: [
        { id: 'c1', score: 10, percentage: 100, verifiedByServer: true }
      ]
    };

    const leaderboard = calculateGroupLeaderboard(tiedGroup, attemptsStore);

    // Alice and Charlie both have 10 points and 100% avg; Alice precedes Charlie alphabetically
    assert.strictEqual(leaderboard[0].userId, 'user_a');
    assert.strictEqual(leaderboard[0].rank, 1);
    assert.strictEqual(leaderboard[1].userId, 'user_c');
    assert.strictEqual(leaderboard[1].rank, 2);

    // Bob has 10 points but lower avg (50%) -> Rank 3
    assert.strictEqual(leaderboard[2].userId, 'user_b');
    assert.strictEqual(leaderboard[2].rank, 3);
    assert.strictEqual(leaderboard[2].averageScore, 50);
  });

  it('Scenario 4: Duplicate assessment attempt prevention', () => {
    const attemptsStoreWithDupes = {
      'destinyivienagbor2005@gmail.com': [
        { id: 'att_unique_1', score: 8, percentage: 80, verifiedByServer: true },
        { id: 'att_unique_1', score: 8, percentage: 80, verifiedByServer: true }, // exact duplicate attempt
        { id: 'att_unique_1', score: 8, percentage: 80, verifiedByServer: true }  // exact duplicate attempt
      ]
    };

    const leaderboard = calculateGroupLeaderboard(sampleGroup, attemptsStoreWithDupes);
    const destiny = leaderboard.find(l => l.userId === 'destinyivienagbor2005@gmail.com');

    assert.ok(destiny);
    assert.strictEqual(destiny.completedAssessments, 1, 'Duplicate attempts must not increase attempt count');
    assert.strictEqual(destiny.totalPoints, 8, 'Duplicate attempts must not artificially inflate points');
  });

  it('Scenario 5: Complete exclusion of unverified attempts', () => {
    const attemptsStoreUnverified = {
      'alex.student@cyberaware.edu': [
        { id: 'tampered_att_1', score: 100, percentage: 100, verifiedByServer: false }, // unverified
        { id: 'client_forged_2', score: 50, percentage: 100 } // missing verifiedByServer flag
      ],
      'destinyivienagbor2005@gmail.com': [
        { id: 'verified_att_1', score: 7, percentage: 70, verifiedByServer: true }
      ]
    };

    const leaderboard = calculateGroupLeaderboard(sampleGroup, attemptsStoreUnverified);
    const alex = leaderboard.find(l => l.userId === 'alex.student@cyberaware.edu');
    const destiny = leaderboard.find(l => l.userId === 'destinyivienagbor2005@gmail.com');

    assert.strictEqual(alex?.totalPoints, 0, 'Unverified attempts must contribute zero points');
    assert.strictEqual(alex?.completedAssessments, 0);
    assert.strictEqual(destiny?.totalPoints, 7);
    assert.strictEqual(leaderboard[0].userId, 'destinyivienagbor2005@gmail.com');
  });

  it('Scenario 6: Authorization check prevents unauthorized access to private leaderboards', () => {
    // Member access: Destiny is a member
    const memberCheck = canAccessGroupLeaderboard(sampleGroup, 'destinyivienagbor2005@gmail.com');
    assert.strictEqual(memberCheck.allowed, true);
    assert.strictEqual(memberCheck.status, 200);

    // Non-member access to private group: blocked with 403
    const nonMemberCheck = canAccessGroupLeaderboard(sampleGroup, 'stranger@external.io');
    assert.strictEqual(nonMemberCheck.allowed, false);
    assert.strictEqual(nonMemberCheck.status, 403);
    assert.match(nonMemberCheck.reason || '', /Access denied/);

    // Nonexistent group: returns 404
    const nonexistentCheck = canAccessGroupLeaderboard(undefined, 'destinyivienagbor2005@gmail.com');
    assert.strictEqual(nonexistentCheck.allowed, false);
    assert.strictEqual(nonexistentCheck.status, 404);
  });

  it('Scenario 7: Empty leaderboard handling for cohorts with no attempts yet', () => {
    const emptyGroup: SecurityGroup = {
      id: 'grp_newbies',
      name: 'Fresh Recruits Cohort',
      description: 'Newly registered members.',
      creatorId: 'newbie1@cyberaware.edu',
      creatorName: 'Newbie One',
      inviteCode: 'NEW999',
      createdAt: 'Nov 4, 2026',
      memberCount: 2,
      members: [
        { userId: 'newbie1@cyberaware.edu', userName: 'Newbie One', role: 'admin', joinedAt: 'Nov 4, 2026' },
        { userId: 'newbie2@cyberaware.edu', userName: 'Newbie Two', role: 'member', joinedAt: 'Nov 4, 2026' }
      ]
    };

    const leaderboard = calculateGroupLeaderboard(emptyGroup, {});
    assert.strictEqual(leaderboard.length, 2);
    assert.strictEqual(leaderboard[0].totalPoints, 0);
    assert.strictEqual(leaderboard[0].completedAssessments, 0);
    assert.strictEqual(leaderboard[0].averageScore, 0);
    assert.strictEqual(leaderboard[0].latestParticipationDate, 'Not yet attempted');
  });

  it('Scenario 8: User standings across multiple groups calculate reliably and survive reload', () => {
    const groups: SecurityGroup[] = [
      sampleGroup,
      {
        id: 'grp_guild',
        name: 'CodeSprint Guild',
        description: 'Elite guild.',
        creatorId: 'judge.security@codesprint.org',
        creatorName: 'Judge',
        inviteCode: 'SPR920',
        createdAt: 'Nov 3, 2026',
        memberCount: 1,
        members: [
          { userId: 'destinyivienagbor2005@gmail.com', userName: 'Destiny', role: 'member', joinedAt: 'Nov 3, 2026' }
        ]
      }
    ];

    const attemptsStore = {
      'destinyivienagbor2005@gmail.com': [
        { id: 'att_1', score: 10, percentage: 100, verifiedByServer: true, date: 'Nov 4, 2026' }
      ]
    };

    // Calculate standings
    const standings = calculateUserStandings(groups, attemptsStore, 'destinyivienagbor2005@gmail.com');
    assert.strictEqual(standings.length, 2);

    // Verify disk serialization
    const serialized = JSON.stringify(standings);
    const reloaded = JSON.parse(serialized);

    assert.strictEqual(reloaded.length, 2);
    assert.strictEqual(reloaded[0].totalPoints, 10);
    assert.strictEqual(reloaded[0].completedAssessments, 1);
  });
});
