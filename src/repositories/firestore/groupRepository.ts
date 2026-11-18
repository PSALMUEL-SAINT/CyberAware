import { Timestamp } from '@google-cloud/firestore';
import type { DocumentReference, Firestore } from '@google-cloud/firestore';
import { GroupMember, SecurityGroup } from '../../types';
import { DEMO_USER_PROFILES } from '../../utils/assessmentAttempts';
import { deriveUserDocKey, normalizeEmailIdentity } from '../../utils/firestoreKeys';
import { DEFAULT_MAX_GROUP_MEMBERS, IGroupRepository } from '../types';

interface FirestoreGroupDoc {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  inviteCode: string;
  createdAt: string;
  isPublic: boolean;
  memberCount: number;
  adminCount: number;
  maxMembers: number;
}

interface FirestoreGroupMemberDoc extends GroupMember {
  userKey: string;
}

export class FirestoreGroupRepository implements IGroupRepository {
  constructor(private readonly db: Firestore) {}

  private groupsCol() {
    return this.db.collection('groups');
  }

  private inviteCodesCol() {
    return this.db.collection('groupInviteCodes');
  }

  private async hydrateGroup(
    groupDoc: FirestoreGroupDoc,
    groupRef: DocumentReference
  ): Promise<SecurityGroup> {
    const membersSnap = await groupRef.collection('members').get();
    const members: GroupMember[] = membersSnap.docs.map(d => {
      const data = d.data() as FirestoreGroupMemberDoc;
      return {
        userId: data.userId,
        userName: data.userName,
        role: data.role,
        joinedAt: data.joinedAt,
        participationStatus: data.participationStatus
      };
    });

    return {
      id: groupDoc.id,
      name: groupDoc.name,
      description: groupDoc.description,
      creatorId: groupDoc.creatorId,
      creatorName: groupDoc.creatorName,
      inviteCode: groupDoc.inviteCode,
      createdAt: groupDoc.createdAt,
      memberCount: groupDoc.memberCount ?? members.length,
      isPublic: groupDoc.isPublic !== false,
      members
    };
  }

  async listPublicSummaries(): Promise<SecurityGroup[]> {
    const snap = await this.groupsCol().where('isPublic', '==', true).get();
    const results: SecurityGroup[] = [];
    for (const docSnap of snap.docs) {
      results.push(
        await this.hydrateGroup(docSnap.data() as FirestoreGroupDoc, docSnap.ref)
      );
    }
    return results;
  }

  async findGroupsForMember(userId: string): Promise<SecurityGroup[]> {
    const normalized = normalizeEmailIdentity(userId);
    if (!normalized) return [];
    const userKey = deriveUserDocKey(normalized);

    const memberSnaps = await this.db
      .collectionGroup('members')
      .where('userKey', '==', userKey)
      .get();

    if (memberSnaps.empty) return [];

    const parentRefsMap = new Map<string, DocumentReference>();
    for (const memberSnap of memberSnaps.docs) {
      const parentGroupRef = memberSnap.ref.parent.parent;
      if (parentGroupRef) {
        parentRefsMap.set(parentGroupRef.id, parentGroupRef);
      }
    }

    const parentRefs = Array.from(parentRefsMap.values());
    if (parentRefs.length === 0) return [];

    const groupSnaps = await this.db.getAll(...parentRefs);
    const groups: SecurityGroup[] = [];
    for (const gSnap of groupSnaps) {
      if (gSnap.exists) {
        groups.push(await this.hydrateGroup(gSnap.data() as FirestoreGroupDoc, gSnap.ref));
      }
    }
    return groups;
  }

  async getGroupWithMembers(groupId: string): Promise<SecurityGroup | null> {
    if (!groupId || groupId.includes('/')) return null;
    const ref = this.groupsCol().doc(groupId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return this.hydrateGroup(snap.data() as FirestoreGroupDoc, ref);
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    if (!groupId || groupId.includes('/')) return false;
    const userKey = deriveUserDocKey(userId);
    const snap = await this.groupsCol().doc(groupId).collection('members').doc(userKey).get();
    return snap.exists;
  }

  async createGroupAtomic(
    group: SecurityGroup,
    maxMembers: number = DEFAULT_MAX_GROUP_MEMBERS
  ): Promise<SecurityGroup> {
    const cleanCode = group.inviteCode.trim().toUpperCase();
    const groupRef = this.groupsCol().doc(group.id);
    const codeRef = this.inviteCodesCol().doc(cleanCode);

    const normalizedMembers: FirestoreGroupMemberDoc[] = group.members.map(m => {
      const uid = normalizeEmailIdentity(m.userId);
      return {
        ...m,
        userId: uid,
        userKey: deriveUserDocKey(uid)
      };
    });

    const adminCount = normalizedMembers.filter(m => m.role === 'admin').length;
    if (adminCount < 1) {
      throw new Error('A new group must have at least one administrator.');
    }

    const groupDoc: FirestoreGroupDoc = {
      id: group.id,
      name: group.name,
      description: group.description,
      creatorId: normalizeEmailIdentity(group.creatorId),
      creatorName: group.creatorName,
      inviteCode: cleanCode,
      createdAt: group.createdAt,
      isPublic: group.isPublic !== false,
      memberCount: normalizedMembers.length,
      adminCount,
      maxMembers
    };

    await this.db.runTransaction(async tx => {
      // ALL READS BEFORE WRITES
      const [existingGroupSnap, existingCodeSnap] = await Promise.all([
        tx.get(groupRef),
        tx.get(codeRef)
      ]);
      if (existingGroupSnap.exists) {
        throw new Error(`Group '${group.id}' already exists.`);
      }
      if (existingCodeSnap.exists) {
        throw new Error(`Invite code '${cleanCode}' already exists.`);
      }

      // ALL WRITES
      tx.create(codeRef, { groupId: group.id, createdAt: Timestamp.now() });
      tx.create(groupRef, groupDoc);
      for (const m of normalizedMembers) {
        const memberRef = groupRef.collection('members').doc(m.userKey);
        tx.create(memberRef, m);
      }
    });

    return {
      ...groupDoc,
      members: group.members.map(m => ({
        ...m,
        userId: normalizeEmailIdentity(m.userId)
      }))
    };
  }

  async joinGroupAtomic(params: {
    groupId?: string;
    inviteCode?: string;
    userId: string;
    userName?: string;
    maxMembers?: number;
  }): Promise<{ status: number; group?: SecurityGroup; error?: string }> {
    const normalizedUser = normalizeEmailIdentity(params.userId);
    if (!normalizedUser) {
      return { status: 400, error: 'User identifier is required to join a group.' };
    }

    let resolvedGroupId = params.groupId?.trim();
    const viaInviteCode = Boolean(params.inviteCode && params.inviteCode.trim() !== '');

    if (viaInviteCode) {
      const cleanCode = String(params.inviteCode).trim().toUpperCase();
      const codeSnap = await this.inviteCodesCol().doc(cleanCode).get();
      if (!codeSnap.exists) {
        return {
          status: 404,
          error: 'Invalid invitation code: No group matches the code provided.'
        };
      }
      resolvedGroupId = (codeSnap.data() as { groupId: string }).groupId;
    }

    if (!resolvedGroupId || resolvedGroupId.includes('/')) {
      return {
        status: 404,
        error: 'Invalid invitation code: No group matches the code provided.'
      };
    }

    const groupRef = this.groupsCol().doc(resolvedGroupId);
    const userKey = deriveUserDocKey(normalizedUser);
    const memberRef = groupRef.collection('members').doc(userKey);

    const txOutcome = await this.db.runTransaction(async tx => {
      // ALL READS FIRST
      const [groupSnap, memberSnap] = await Promise.all([
        tx.get(groupRef),
        tx.get(memberRef)
      ]);

      if (!groupSnap.exists) {
        return {
          status: 404,
          error: 'Invalid invitation code: No group matches the code provided.'
        };
      }

      const groupData = groupSnap.data() as FirestoreGroupDoc;

      if (!viaInviteCode && groupData.isPublic === false) {
        return {
          status: 403,
          error: 'Forbidden: Private groups require a valid invitation code to join.'
        };
      }

      if (memberSnap.exists) {
        return {
          status: 409,
          error: `User '${normalizedUser}' is already a registered member of '${groupData.name}'. Duplicate membership prevented.`
        };
      }

      const cap = params.maxMembers ?? groupData.maxMembers ?? DEFAULT_MAX_GROUP_MEMBERS;
      if ((groupData.memberCount || 0) >= cap) {
        return {
          status: 409,
          error: `Group '${groupData.name}' has reached its maximum capacity of ${cap} members.`
        };
      }

      const profile = DEMO_USER_PROFILES[normalizedUser];
      const displayName =
        params.userName || (profile ? profile.name : normalizedUser.split('@')[0]);

      const memberDoc: FirestoreGroupMemberDoc = {
        userId: normalizedUser,
        userKey,
        userName: displayName,
        role: 'member',
        joinedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        participationStatus: 'active'
      };

      // WRITES ONLY AFTER ALL READS
      tx.create(memberRef, memberDoc);
      tx.update(groupRef, {
        memberCount: (groupData.memberCount || 0) + 1
      });

      return { status: 200 };
    });

    if (txOutcome.status !== 200) {
      return txOutcome;
    }

    const hydrated = await this.getGroupWithMembers(resolvedGroupId);
    return { status: 200, group: hydrated || undefined };
  }

  async removeMemberAtomic(
    groupId: string,
    targetUserId: string,
    requestingUserId: string
  ): Promise<{ status: number; group?: SecurityGroup; error?: string }> {
    if (!groupId || groupId.includes('/')) {
      return { status: 404, error: 'Group not found.' };
    }

    const normalizedTarget = normalizeEmailIdentity(targetUserId);
    const normalizedRequester = normalizeEmailIdentity(requestingUserId);
    const groupRef = this.groupsCol().doc(groupId);
    const targetRef = groupRef.collection('members').doc(deriveUserDocKey(normalizedTarget));
    const requesterRef = groupRef
      .collection('members')
      .doc(deriveUserDocKey(normalizedRequester));

    const txOutcome = await this.db.runTransaction(async tx => {
      // ALL READS FIRST
      const [groupSnap, targetSnap, requesterSnap] = await Promise.all([
        tx.get(groupRef),
        tx.get(targetRef),
        normalizedTarget === normalizedRequester
          ? Promise.resolve(null)
          : tx.get(requesterRef)
      ]);

      if (!groupSnap.exists) {
        return { status: 404, error: 'Group not found.' };
      }

      const groupData = groupSnap.data() as FirestoreGroupDoc;
      if (!targetSnap.exists) {
        return {
          status: 404,
          error: `User '${targetUserId}' is not a member of '${groupData.name}'.`
        };
      }

      const targetData = targetSnap.data() as FirestoreGroupMemberDoc;
      const isSelfLeave = normalizedTarget === normalizedRequester;
      const effectiveRequesterSnap = isSelfLeave ? targetSnap : requesterSnap;
      const isRequesterAdmin =
        effectiveRequesterSnap?.exists &&
        (effectiveRequesterSnap.data() as FirestoreGroupMemberDoc).role === 'admin';

      if (!isSelfLeave && !isRequesterAdmin) {
        return {
          status: 403,
          error: 'Unauthorized: Only group administrators can remove other members from the group.'
        };
      }

      const nextMemberCount = Math.max(0, (groupData.memberCount || 1) - 1);
      const isTargetAdmin = targetData.role === 'admin';
      const currentAdminCount = groupData.adminCount ?? 1;
      const nextAdminCount = isTargetAdmin
        ? Math.max(0, currentAdminCount - 1)
        : currentAdminCount;

      // Enforce sole-admin protection for BOTH self-initiated and admin-initiated removals
      if (isTargetAdmin && nextMemberCount > 0 && nextAdminCount < 1) {
        return {
          status: 400,
          error:
            'Administrator cannot be removed while other members remain without another administrator assigned.'
        };
      }

      // ALL WRITES AFTER READS
      tx.delete(targetRef);
      tx.update(groupRef, {
        memberCount: nextMemberCount,
        adminCount: nextAdminCount
      });

      return { status: 200 };
    });

    if (txOutcome.status !== 200) {
      return txOutcome;
    }

    const hydrated = await this.getGroupWithMembers(groupId);
    return { status: 200, group: hydrated || undefined };
  }
}
