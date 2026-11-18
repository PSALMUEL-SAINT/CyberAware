import { SecurityGroup } from '../../types';
import {
  addMemberToGroup,
  removeMemberFromGroup,
  validateJoinGroup
} from '../../utils/groupManagement';
import { normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { DEFAULT_MAX_GROUP_MEMBERS, IGroupRepository } from '../types';
import { readJsonStoreFile, writeJsonStoreFile } from './jsonStorage';

export class JsonGroupRepository implements IGroupRepository {
  constructor(private readonly groupsFile: string) {}

  private loadGroups(): SecurityGroup[] {
    return readJsonStoreFile<SecurityGroup[]>(this.groupsFile, []);
  }

  async listPublicSummaries(): Promise<SecurityGroup[]> {
    return this.loadGroups().filter(g => g.isPublic !== false);
  }

  async findGroupsForMember(userId: string): Promise<SecurityGroup[]> {
    const target = normalizeEmailIdentity(userId);
    return this.loadGroups().filter(g =>
      g.members.some(m => normalizeEmailIdentity(m.userId) === target)
    );
  }

  async getGroupWithMembers(groupId: string): Promise<SecurityGroup | null> {
    return this.loadGroups().find(g => g.id === groupId) || null;
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const target = normalizeEmailIdentity(userId);
    const group = await this.getGroupWithMembers(groupId);
    if (!group) return false;
    return group.members.some(m => normalizeEmailIdentity(m.userId) === target);
  }

  async createGroupAtomic(
    group: SecurityGroup,
    _maxMembers: number = DEFAULT_MAX_GROUP_MEMBERS
  ): Promise<SecurityGroup> {
    const groups = this.loadGroups();
    if (groups.some(g => g.inviteCode.toUpperCase() === group.inviteCode.toUpperCase())) {
      throw new Error(`Invite code '${group.inviteCode}' already exists.`);
    }
    const created: SecurityGroup = {
      ...group,
      inviteCode: group.inviteCode.toUpperCase(),
      memberCount: group.members.length
    };
    groups.unshift(created);
    writeJsonStoreFile(this.groupsFile, groups);
    return created;
  }

  async joinGroupAtomic(params: {
    groupId?: string;
    inviteCode?: string;
    userId: string;
    userName?: string;
    maxMembers?: number;
  }): Promise<{ status: number; group?: SecurityGroup; error?: string }> {
    const groups = this.loadGroups();
    const maxMembers = params.maxMembers ?? DEFAULT_MAX_GROUP_MEMBERS;
    let group: SecurityGroup | undefined;

    if (params.inviteCode) {
      const cleanCode = String(params.inviteCode).trim().toUpperCase();
      group = groups.find(g => g.inviteCode.toUpperCase() === cleanCode);
    } else if (params.groupId) {
      group = groups.find(g => g.id === params.groupId);
      if (group && group.isPublic === false) {
        return {
          status: 403,
          error: 'Forbidden: Private groups require a valid invitation code to join.'
        };
      }
    }

    const validation = validateJoinGroup(group, params.userId);
    if (!validation.valid || !group) {
      return { status: validation.status, error: validation.error };
    }

    if (group.members.length >= maxMembers) {
      return {
        status: 409,
        error: `Group '${group.name}' has reached the maximum capacity of ${maxMembers} members.`
      };
    }

    const updated = addMemberToGroup(group, params.userId, params.userName);
    const nextGroups = groups.map(g => (g.id === updated.id ? updated : g));
    writeJsonStoreFile(this.groupsFile, nextGroups);

    return { status: 200, group: updated };
  }

  async removeMemberAtomic(
    groupId: string,
    targetUserId: string,
    requestingUserId: string
  ): Promise<{ status: number; group?: SecurityGroup; error?: string }> {
    const groups = this.loadGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      return { status: 404, error: 'Group not found.' };
    }

    // Preserve sole-admin invariant across both self-leave and admin-initiated removals
    const target = group.members.find(
      m => normalizeEmailIdentity(m.userId) === normalizeEmailIdentity(targetUserId)
    );
    if (target && target.role === 'admin' && group.members.length > 1) {
      const adminCount = group.members.filter(m => m.role === 'admin').length;
      if (adminCount <= 1) {
        return {
          status: 400,
          error:
            'Administrator cannot be removed while other members remain without another administrator assigned.'
        };
      }
    }

    const result = removeMemberFromGroup(group, targetUserId, requestingUserId);
    if (!result.success || !result.group) {
      return { status: result.status, error: result.error };
    }

    const nextGroups = groups.map(g => (g.id === result.group!.id ? result.group! : g));
    writeJsonStoreFile(this.groupsFile, nextGroups);
    return { status: 200, group: result.group };
  }
}
