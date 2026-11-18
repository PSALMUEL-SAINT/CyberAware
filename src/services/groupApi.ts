import { SecurityGroup, GroupMember, GroupSummary, GroupLeaderboardResponse, UserStandingsResponse } from '../types';
import { getDemoAuthHeaders } from './assessmentApi';

/**
 * Fetches summaries of all groups from the server.
 */
export async function fetchGroups(userId = ''): Promise<GroupSummary[]> {
  try {
    const headers = getDemoAuthHeaders(userId);
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/groups${query}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.groups)) {
        return data.groups;
      }
    }
  } catch (err) {
    console.warn('Backend groups API unavailable:', err);
  }
  return [];
}

/**
 * Creates a new security group on the server.
 */
export async function createGroup(payload: {
  name: string;
  description: string;
  creatorId?: string;
  isPublic?: boolean;
}): Promise<{ success: boolean; group?: SecurityGroup; error?: string }> {
  const userId = payload.creatorId || '';
  const headers = getDemoAuthHeaders(userId);

  try {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        creatorId: userId,
        isPublic: payload.isPublic ?? true
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, group: data.group };
    }
    return { success: false, error: data.error || `Failed to create group (HTTP ${res.status}).` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to groups service.' };
  }
}

/**
 * Joins an existing group using either an invitation code or group ID.
 */
export async function joinGroup(
  identifier: { inviteCode?: string; groupId?: string },
  userId = ''
): Promise<{ success: boolean; group?: SecurityGroup; error?: string; status?: number }> {
  const headers = getDemoAuthHeaders(userId);

  try {
    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...identifier,
        userId
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, group: data.group, status: res.status };
    }
    return { success: false, error: data.error || 'Failed to join group.', status: res.status };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error attempting to join group.', status: 0 };
  }
}

/**
 * Fetches full details for a group.
 */
export async function fetchGroupDetails(
  groupId: string,
  userId = ''
): Promise<SecurityGroup | null> {
  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      return data.group || null;
    }
  } catch (err) {
    console.warn(`Error fetching group ${groupId}:`, err);
  }
  return null;
}

/**
 * Fetches member list enriched with actual assessment completion statistics.
 */
export async function fetchGroupMembers(
  groupId: string,
  userId = ''
): Promise<GroupMember[]> {
  try {
    const headers = getDemoAuthHeaders(userId);
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, { headers });
    if (res.ok) {
      const data = await res.json();
      return data.members || [];
    }
  } catch (err) {
    console.warn(`Error fetching members for group ${groupId}:`, err);
  }
  return [];
}

/**
 * Leaves a group.
 */
export async function leaveGroup(
  groupId: string,
  userId = ''
): Promise<{ success: boolean; error?: string }> {
  const headers = getDemoAuthHeaders(userId);

  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/leave`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to leave group.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error attempting to leave group.' };
  }
}

/**
 * Removes a member from a group (Administrator action).
 */
export async function removeGroupMember(
  groupId: string,
  memberId: string,
  adminUserId = ''
): Promise<{ success: boolean; error?: string }> {
  const headers = getDemoAuthHeaders(adminUserId);

  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to remove member.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error removing member.' };
  }
}

/**
 * Fetches the competitive leaderboard for a specific security group.
 */
export async function fetchGroupLeaderboard(
  groupId: string,
  userId = ''
): Promise<GroupLeaderboardResponse> {
  const headers = getDemoAuthHeaders(userId);
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/leaderboard${query}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return data;
    }
    return {
      success: false,
      groupId,
      groupName: '',
      inviteCode: '',
      memberCount: 0,
      generatedAt: new Date().toISOString(),
      currentUserRank: null,
      leaderboard: [],
      error: data.error || `Failed to load group leaderboard (HTTP ${res.status}).`
    };
  } catch (err: any) {
    return {
      success: false,
      groupId,
      groupName: '',
      inviteCode: '',
      memberCount: 0,
      generatedAt: new Date().toISOString(),
      currentUserRank: null,
      leaderboard: [],
      error: err?.message || 'Network error fetching group leaderboard.'
    };
  }
}

/**
 * Fetches user standings across all groups they are enrolled in.
 */
export async function fetchUserStandings(
  userId = ''
): Promise<UserStandingsResponse> {
  if (!userId) {
    return {
      success: true,
      userId: '',
      standings: []
    };
  }
  const headers = getDemoAuthHeaders(userId);
  try {
    const res = await fetch(`/api/leaderboard/me?userId=${encodeURIComponent(userId)}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return data;
    }
    return {
      success: false,
      userId,
      standings: [],
      error: data.error || 'Failed to fetch user standings.'
    };
  } catch (err: any) {
    return {
      success: false,
      userId,
      standings: [],
      error: err?.message || 'Network error fetching user standings.'
    };
  }
}
