import { SecurityGroup, LeaderboardEntry, UserStanding } from '../types';

/**
 * Validates whether an attempt is verified by the server.
 * Completely ignores client-side score manipulation.
 */
export function isVerifiedAttempt(attempt: any): boolean {
  if (!attempt || typeof attempt !== 'object') return false;
  return attempt.verifiedByServer === true;
}

/**
 * Pure function: Calculates and ranks a group's competitive leaderboard.
 * 
 * Rules:
 * 1. Authority: Uses only server-verified attempts (verifiedByServer === true).
 * 2. Membership Isolation: Only members within group.members are considered. Scores from external users are strictly excluded.
 * 3. Duplicate Prevention: Each unique attempt ID is counted exactly once.
 * 4. Tie-Breaking Order:
 *    - 1st: Total Verified Points (descending)
 *    - 2nd: Average Score Percentage (descending)
 *    - 3rd: Completed Assessments Count (descending)
 *    - 4th: Highest Score Percentage (descending)
 *    - 5th: Member Display Name (alphabetical)
 */
export function calculateGroupLeaderboard(
  group: SecurityGroup,
  userAttemptsStore: Record<string, any[]> = {},
  callerUserId?: string
): LeaderboardEntry[] {
  if (!group || !Array.isArray(group.members)) {
    return [];
  }

  const entries: Omit<LeaderboardEntry, 'rank'>[] = group.members.map(member => {
    const rawAttempts = userAttemptsStore[member.userId] || [];
    
    // Deduplicate attempts by unique attempt ID and filter for verified attempts only
    const seenAttemptIds = new Set<string>();
    const validAttempts: any[] = [];

    for (const att of rawAttempts) {
      if (!isVerifiedAttempt(att)) {
        continue; // Exclude unverified attempts
      }

      const id = String(att.id || att.attemptId || '').trim();
      if (!id) {
        continue;
      }

      if (seenAttemptIds.has(id)) {
        continue; // Prevent duplicate attempt counting
      }

      seenAttemptIds.add(id);
      validAttempts.push(att);
    }

    const completedAssessments = validAttempts.length;
    let totalPoints = 0;
    let sumPercentage = 0;
    let highestScore = 0;
    let latestParticipationDate = 'No assessments';
    let latestTimestampMs = 0;

    for (const att of validAttempts) {
      const score = typeof att.score === 'number' ? att.score : (typeof att.correctCount === 'number' ? att.correctCount : 0);
      const percentage = typeof att.percentage === 'number' ? att.percentage : 0;
      totalPoints += score;
      sumPercentage += percentage;

      if (percentage > highestScore) {
        highestScore = percentage;
      }

      // Track latest date
      const timeVal = att.timestamp ? new Date(att.timestamp).getTime() : (att.date ? new Date(att.date).getTime() : 0);
      if (timeVal > latestTimestampMs) {
        latestTimestampMs = timeVal;
        latestParticipationDate = att.date || (att.timestamp ? new Date(att.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent');
      }
    }

    const averageScore = completedAssessments > 0 ? Math.round(sumPercentage / completedAssessments) : 0;
    const isCurrentUser = callerUserId ? member.userId.toLowerCase() === callerUserId.toLowerCase() : false;

    return {
      userId: member.userId,
      userName: member.userName,
      role: member.role,
      totalPoints,
      completedAssessments,
      averageScore,
      highestScore,
      latestParticipationDate: completedAssessments > 0 ? latestParticipationDate : 'Not yet attempted',
      joinedAt: member.joinedAt,
      isCurrentUser
    };
  });

  // Sort according to fair competition tie-breaking rules
  entries.sort((a, b) => {
    // 1st criterion: Total points descending
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    // 2nd criterion: Average score descending
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }

    // 3rd criterion: Number of completed assessments descending
    if (b.completedAssessments !== a.completedAssessments) {
      return b.completedAssessments - a.completedAssessments;
    }

    // 4th criterion: Highest single assessment score descending
    if (b.highestScore !== a.highestScore) {
      return b.highestScore - a.highestScore;
    }

    // 5th criterion: Alphabetical by user name
    return a.userName.localeCompare(b.userName);
  });

  // Assign sequential rank 1, 2, 3...
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

/**
 * Checks authorization to access a group's competitive leaderboard.
 */
export function canAccessGroupLeaderboard(
  group: SecurityGroup | undefined,
  callerUserId?: string
): { allowed: boolean; status: number; reason?: string } {
  if (!group) {
    return {
      allowed: false,
      status: 404,
      reason: 'Group not found.'
    };
  }

  if (!callerUserId) {
    return {
      allowed: false,
      status: 401,
      reason: 'Authentication required to view group leaderboards.'
    };
  }

  const isMember = group.members.some(
    m => m.userId.toLowerCase() === callerUserId.toLowerCase()
  );

  // If group is not marked public, require active membership
  if (!isMember && group.isPublic === false) {
    return {
      allowed: false,
      status: 403,
      reason: `Access denied: You must be an enrolled member of '${group.name}' to view its private leaderboard.`
    };
  }

  return { allowed: true, status: 200 };
}

/**
 * Calculates current user's standings across all groups they belong to.
 */
export function calculateUserStandings(
  groups: SecurityGroup[],
  userAttemptsStore: Record<string, any[]>,
  userId: string
): UserStanding[] {
  if (!Array.isArray(groups) || !userId) return [];

  const userGroups = groups.filter(g =>
    g.members.some(m => m.userId.toLowerCase() === userId.toLowerCase())
  );

  const standings: UserStanding[] = [];

  for (const group of userGroups) {
    const leaderboard = calculateGroupLeaderboard(group, userAttemptsStore, userId);
    const userEntry = leaderboard.find(
      e => e.userId.toLowerCase() === userId.toLowerCase()
    );

    if (userEntry) {
      standings.push({
        groupId: group.id,
        groupName: group.name,
        inviteCode: group.inviteCode,
        rank: userEntry.rank,
        totalMembers: group.members.length,
        totalPoints: userEntry.totalPoints,
        averageScore: userEntry.averageScore,
        completedAssessments: userEntry.completedAssessments
      });
    }
  }

  // Sort by highest ranking / most points
  standings.sort((a, b) => a.rank - b.rank || b.totalPoints - a.totalPoints);

  return standings;
}
