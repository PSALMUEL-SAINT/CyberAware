import { SecurityGroup, GroupMember, GroupRole, GroupSummary } from '../types';
import { DEMO_USER_PROFILES } from './assessmentAttempts';

// Non-ambiguous uppercase characters for readable 6-character invitation codes
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a unique 6-character uppercase alphanumeric invitation code.
 */
export function generateInviteCode(existingCodes: Set<string> | string[] = []): string {
  const codeSet = existingCodes instanceof Set ? existingCodes : new Set(existingCodes.map(c => c.toUpperCase()));
  let code = '';
  let attempts = 0;
  const maxAttempts = 1000;

  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
      code += CODE_ALPHABET[idx];
    }
    attempts++;
  } while (codeSet.has(code) && attempts < maxAttempts);

  return code;
}

/**
 * Validates group creation payload.
 */
export function validateGroupCreation(payload: {
  name?: string;
  description?: string;
  creatorId?: string;
}): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const name = payload.name?.trim();
  if (!name || name.length < 3 || name.length > 50) {
    return { valid: false, error: 'Group name must be between 3 and 50 characters.' };
  }

  const desc = payload.description?.trim();
  if (!desc || desc.length < 5 || desc.length > 250) {
    return { valid: false, error: 'Group description must be between 5 and 250 characters.' };
  }

  if (!payload.creatorId || typeof payload.creatorId !== 'string' || payload.creatorId.trim() === '') {
    return { valid: false, error: 'Creator identifier is required.' };
  }

  return { valid: true };
}

/**
 * Creates a brand new SecurityGroup object with the creator as Administrator.
 */
export function createGroupRecord(
  name: string,
  description: string,
  creatorId: string,
  existingCodes: string[] = []
): SecurityGroup {
  const profile = DEMO_USER_PROFILES[creatorId];
  const creatorName = profile ? profile.name : creatorId.split('@')[0];
  const now = new Date();
  const inviteCode = generateInviteCode(existingCodes);

  const adminMember: GroupMember = {
    userId: creatorId,
    userName: creatorName,
    role: 'admin',
    joinedAt: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    participationStatus: 'active'
  };

  return {
    id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    description: description.trim(),
    creatorId,
    creatorName,
    inviteCode,
    createdAt: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    memberCount: 1,
    members: [adminMember],
    isPublic: true
  };
}

/**
 * Validates joining a group, rejecting missing groups, invalid codes, or duplicate memberships.
 */
export function validateJoinGroup(
  group: SecurityGroup | undefined,
  userId: string
): { valid: boolean; error?: string; status: number } {
  if (!group) {
    return { valid: false, error: 'Invalid invitation code: No group matches the code provided.', status: 404 };
  }

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return { valid: false, error: 'User identifier is required to join a group.', status: 400 };
  }

  const isAlreadyMember = group.members.some(m => m.userId.toLowerCase() === userId.toLowerCase());
  if (isAlreadyMember) {
    return {
      valid: false,
      error: `User '${userId}' is already a registered member of '${group.name}'. Duplicate membership prevented.`,
      status: 409
    };
  }

  return { valid: true, status: 200 };
}

/**
 * Adds a user to a group as a standard Member.
 */
export function addMemberToGroup(
  group: SecurityGroup,
  userId: string,
  userName?: string
): SecurityGroup {
  const profile = DEMO_USER_PROFILES[userId];
  const displayName = userName || (profile ? profile.name : userId.split('@')[0]);
  const now = new Date();

  const newMember: GroupMember = {
    userId,
    userName: displayName,
    role: 'member',
    joinedAt: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    participationStatus: 'active'
  };

  const updatedMembers = [...group.members, newMember];
  return {
    ...group,
    memberCount: updatedMembers.length,
    members: updatedMembers
  };
}

/**
 * Removes a member from a group (self-leave or admin removal).
 */
export function removeMemberFromGroup(
  group: SecurityGroup,
  targetUserId: string,
  requestingUserId: string
): { success: boolean; group?: SecurityGroup; error?: string; status: number } {
  const targetMember = group.members.find(m => m.userId.toLowerCase() === targetUserId.toLowerCase());
  if (!targetMember) {
    return { success: false, error: `User '${targetUserId}' is not a member of '${group.name}'.`, status: 404 };
  }

  const isSelfLeave = targetUserId.toLowerCase() === requestingUserId.toLowerCase();
  const requester = group.members.find(m => m.userId.toLowerCase() === requestingUserId.toLowerCase());
  const isRequesterAdmin = requester?.role === 'admin';

  // If not self-leave and not admin, reject unauthorized modification
  if (!isSelfLeave && !isRequesterAdmin) {
    return {
      success: false,
      error: 'Unauthorized: Only group administrators can remove other members from the group.',
      status: 403
    };
  }

  // Check if target is the sole administrator in a multi-member group
  if (targetMember.role === 'admin') {
    const adminCount = group.members.filter(m => m.role === 'admin').length;
    if (adminCount <= 1 && group.members.length > 1 && isSelfLeave) {
      return {
        success: false,
        error: 'Administrator cannot leave the group while other members remain without transferring administrator privileges.',
        status: 400
      };
    }
  }

  const updatedMembers = group.members.filter(m => m.userId.toLowerCase() !== targetUserId.toLowerCase());
  const updatedGroup: SecurityGroup = {
    ...group,
    memberCount: updatedMembers.length,
    members: updatedMembers
  };

  return { success: true, group: updatedGroup, status: 200 };
}

/**
 * Enriches group members with accurate assessment statistics from server-data/attempts.json.
 * Zero fake statistics!
 */
export function enrichMemberParticipation(
  members: GroupMember[],
  userAttemptsStore: Record<string, any[]> = {}
): GroupMember[] {
  return members.map(m => {
    const userAttempts = userAttemptsStore[m.userId] || [];
    const count = userAttempts.length;
    let status: 'active' | 'pending' | 'completed_assessments' = 'active';
    if (count > 0) {
      status = 'completed_assessments';
    } else {
      status = 'pending';
    }

    return {
      ...m,
      assessmentCount: count,
      participationStatus: status,
      lastActive: userAttempts.length > 0 ? userAttempts[0].date : m.joinedAt
    };
  });
}

/**
 * Maps a full SecurityGroup to a GroupSummary for the current user.
 * Redacts private inviteCode and creatorId for non-members and unauthenticated callers.
 */
export function toGroupSummary(group: SecurityGroup, currentUserId?: string): GroupSummary {
  const member = currentUserId
    ? group.members.find(m => m.userId.toLowerCase() === currentUserId.toLowerCase())
    : undefined;

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    creatorId: member ? group.creatorId : '',
    creatorName: group.creatorName,
    inviteCode: member ? group.inviteCode : '',
    createdAt: group.createdAt,
    memberCount: group.members.length,
    isMember: !!member,
    currentUserRole: member?.role
  };
}
