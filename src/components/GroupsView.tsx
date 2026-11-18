import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  KeyRound, 
  Copy, 
  Check, 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  Trash2, 
  ArrowLeft, 
  AlertCircle, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  Activity, 
  Clock, 
  Lock, 
  Shield, 
  ChevronRight,
  RefreshCw,
  Info,
  Trophy,
  Medal,
  Award,
  Crown,
  BarChart3,
  TrendingUp,
  Target
} from 'lucide-react';
import { 
  SecurityGroup, 
  GroupMember, 
  GroupSummary, 
  ActiveTab,
  LeaderboardEntry,
  GroupLeaderboardResponse,
  UserStanding
} from '../types';
import { 
  fetchGroups, 
  createGroup, 
  joinGroup, 
  fetchGroupDetails, 
  fetchGroupMembers, 
  leaveGroup, 
  removeGroupMember,
  fetchGroupLeaderboard,
  fetchUserStandings
} from '../services/groupApi';
import { CURRENT_DEFAULT_USER } from '../services/assessmentApi';

interface GroupsViewProps {
  currentUserId: string;
  onChangeUser?: (userId: string) => void;
  onNavigate?: (tab: ActiveTab, subTarget?: string) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUserId = '',
  onChangeUser,
  onNavigate
}) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [userStandingsMap, setUserStandingsMap] = useState<Record<string, UserStanding>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active view tab: 'my_groups' | 'browse' | 'details'
  const [viewTab, setViewTab] = useState<'my_groups' | 'browse' | 'details'>('my_groups');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SecurityGroup | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Details sub-tab: 'leaderboard' | 'roster'
  const [detailsSubTab, setDetailsSubTab] = useState<'leaderboard' | 'roster'>('leaderboard');
  const [leaderboardData, setLeaderboardData] = useState<GroupLeaderboardResponse | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isJoinOpen, setIsJoinOpen] = useState<boolean>(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState<boolean>(false);

  // Form states
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load groups and user standings on mount and user change
  const loadGroupsList = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [list, standingsRes] = await Promise.all([
        fetchGroups(currentUserId),
        fetchUserStandings(currentUserId)
      ]);
      setGroups(list);

      if (standingsRes.success && Array.isArray(standingsRes.standings)) {
        const map: Record<string, UserStanding> = {};
        for (const s of standingsRes.standings) {
          map[s.groupId] = s;
        }
        setUserStandingsMap(map);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load security groups.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaderboardData = async (groupId: string) => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await fetchGroupLeaderboard(groupId, currentUserId);
      setLeaderboardData(data);
    } catch (err) {
      console.warn('Failed to load leaderboard data:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const loadGroupDetails = async (groupId: string) => {
    setIsLoadingDetails(true);
    try {
      const [details, members, lbData] = await Promise.all([
        fetchGroupDetails(groupId, currentUserId),
        fetchGroupMembers(groupId, currentUserId),
        fetchGroupLeaderboard(groupId, currentUserId)
      ]);
      setSelectedGroup(details);
      setSelectedGroupMembers(members);
      setLeaderboardData(lbData);
      setSelectedGroupId(groupId);
      setViewTab('details');
      setDetailsSubTab('leaderboard');
    } catch (e: any) {
      setErrorMsg('Failed to load group details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadGroupsList();
    if (selectedGroupId) {
      loadGroupDetails(selectedGroupId);
    }
  }, [currentUserId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  // Create Group submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDesc.trim()) {
      setCreateError('Please provide both a group name and description.');
      return;
    }
    setCreateError(null);
    setIsCreating(true);

    try {
      const result = await createGroup({
        name: newGroupName,
        description: newGroupDesc,
        creatorId: currentUserId
      });

      if (result.success && result.group) {
        setSuccessMsg(`Group '${result.group.name}' created with invite code ${result.group.inviteCode}!`);
        setIsCreateOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');
        await loadGroupsList();
        // View new group details
        await loadGroupDetails(result.group.id);
      } else {
        setCreateError(result.error || 'Failed to create group.');
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Network error creating group.');
    } finally {
      setIsCreating(false);
    }
  };

  // Join Group submission
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCodeInput.trim().toUpperCase();
    if (clean.length !== 6) {
      setJoinError('Invitation codes must be exactly 6 characters.');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      const result = await joinGroup({ inviteCode: clean }, currentUserId);
      if (result.success && result.group) {
        setJoinSuccess(`Successfully joined ${result.group.name}!`);
        setTimeout(() => {
          setIsJoinOpen(false);
          setJoinCodeInput('');
          setJoinSuccess(null);
          loadGroupsList();
          loadGroupDetails(result.group!.id);
        }, 1200);
      } else {
        setJoinError(result.error || 'Invalid invitation code or already enrolled.');
      }
    } catch (err: any) {
      setJoinError(err?.message || 'Network error attempting to join group.');
    } finally {
      setIsJoining(false);
    }
  };

  // Direct Join from Browse
  const handleDirectJoin = async (group: GroupSummary) => {
    try {
      const result = await joinGroup({ groupId: group.id }, currentUserId);
      if (result.success && result.group) {
        setSuccessMsg(`Successfully joined ${result.group.name}!`);
        await loadGroupsList();
        await loadGroupDetails(result.group.id);
      } else {
        setErrorMsg(result.error || 'Failed to join group.');
      }
    } catch (e: any) {
      setErrorMsg('Failed to join group.');
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!selectedGroupId) return;
    try {
      const result = await leaveGroup(selectedGroupId, currentUserId);
      if (result.success) {
        setSuccessMsg('You have successfully left the group.');
        setIsLeaveConfirmOpen(false);
        setSelectedGroupId(null);
        setSelectedGroup(null);
        setViewTab('my_groups');
        await loadGroupsList();
      } else {
        setErrorMsg(result.error || 'Failed to leave group.');
        setIsLeaveConfirmOpen(false);
      }
    } catch (e: any) {
      setErrorMsg('Failed to leave group.');
      setIsLeaveConfirmOpen(false);
    }
  };

  // Admin remove member
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroupId) return;
    if (!window.confirm(`Are you sure you want to remove ${memberId} from the group?`)) {
      return;
    }

    try {
      const result = await removeGroupMember(selectedGroupId, memberId, currentUserId);
      if (result.success) {
        setSuccessMsg(`Member removed from group.`);
        loadGroupDetails(selectedGroupId);
      } else {
        setErrorMsg(result.error || 'Failed to remove member.');
      }
    } catch (e: any) {
      setErrorMsg('Failed to remove member.');
    }
  };

  // Filter groups
  const myGroups = useMemo(() => {
    return groups.filter(g => g.isMember);
  }, [groups]);

  const browseGroups = useMemo(() => {
    return groups.filter(g => {
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return g.name.toLowerCase().includes(q) || 
             g.description.toLowerCase().includes(q) || 
             (g.inviteCode ? g.inviteCode.toLowerCase().includes(q) : false);
    });
  }, [groups, searchQuery]);

  const isCurrentAdmin = useMemo(() => {
    if (!selectedGroup) return false;
    const currentMember = selectedGroup.members.find(
      m => m.userId.toLowerCase() === currentUserId.toLowerCase()
    );
    return currentMember?.role === 'admin';
  }, [selectedGroup, currentUserId]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-5xl">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                Stage 3: Collaboration & Teams
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                server-data/groups.json
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-3">
              <Users className="w-7 h-7 text-sky-600 dark:text-sky-400" />
              <span>Security Groups & Cohorts</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              Form cyber defense study squads, share invitation codes, and track team members across persistent diagnostic assessments.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setCreateError(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <Plus className="w-4 h-4" />
              <span>Create Group</span>
            </button>

            <button
              onClick={() => {
                setJoinError(null);
                setJoinSuccess(null);
                setIsJoinOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Join by Code</span>
            </button>

            <button
              onClick={loadGroupsList}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Refresh from server-data/groups.json"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Demo Account Switcher Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-slate-400">Authenticated Demo User:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
              {currentUserId}
            </span>
          </div>

          {onChangeUser && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Switch user for isolation test:</span>
              <select
                value={currentUserId}
                onChange={(e) => onChangeUser(e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 font-medium text-slate-800 dark:text-slate-200 shadow-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value="destinyivienagbor2005@gmail.com">destinyivienagbor2005@gmail.com (Learner)</option>
                <option value="judge.security@codesprint.org">judge.security@codesprint.org (CodeSprint Judge)</option>
                <option value="alex.student@cyberaware.edu">alex.student@cyberaware.edu (Alex Student)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* MAIN VIEW CONTROLS (My Groups vs Browse) */}
      {viewTab !== 'details' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setViewTab('my_groups')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewTab === 'my_groups'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Groups ({myGroups.length})
            </button>
            <button
              onClick={() => setViewTab('browse')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewTab === 'browse'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Browse Public Groups ({groups.length})
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups or invite codes..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MY GROUPS                                                          */}
      {/* ========================================================================= */}
      {viewTab === 'my_groups' && (
        <div className="space-y-4">
          {myGroups.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-200 dark:border-sky-800">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">You Haven't Joined Any Groups Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Connect with peers to train together. Create your own group or join an existing cohort using a 6-character invitation code.
              </p>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs"
                >
                  Create Your First Group
                </button>
                <button
                  onClick={() => setViewTab('browse')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700"
                >
                  Explore Public Groups
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGroups.map(group => (
                <div
                  key={group.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                            {group.name}
                          </h3>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                          Created {group.createdAt} by {group.creatorName}
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          group.currentUserRole === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}>
                          {group.currentUserRole === 'admin' ? 'Administrator' : 'Member'}
                        </span>

                        {userStandingsMap[group.id] && (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                            <Trophy className="w-2.5 h-2.5 text-amber-500" />
                            <span>Rank #{userStandingsMap[group.id].rank} ({userStandingsMap[group.id].totalPoints} pts)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {group.description}
                    </p>

                    {/* Invitation Code Pill */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Invite Code:</span>
                        <code className="font-mono font-bold text-sky-600 dark:text-sky-400 tracking-wider">
                          {group.inviteCode}
                        </code>
                      </div>
                      <button
                        onClick={() => handleCopyCode(group.inviteCode)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-1"
                        title="Copy 6-character code"
                      >
                        {copiedCode === group.inviteCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      <strong>{group.memberCount}</strong> {group.memberCount === 1 ? 'member' : 'members'} enrolled
                    </span>

                    <button
                      onClick={() => loadGroupDetails(group.id)}
                      className="inline-flex items-center space-x-1 text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                    >
                      <span>View Roster & Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BROWSE PUBLIC GROUPS                                               */}
      {/* ========================================================================= */}
      {viewTab === 'browse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {browseGroups.map(group => (
              <div
                key={group.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {group.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                        Created {group.createdAt} by {group.creatorName}
                      </span>
                    </div>

                    {group.isMember ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        Enrolled ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                        Public Group
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {group.description}
                  </p>

                  {group.isMember && group.inviteCode && (
                    <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Invite Code:</span>
                      <code className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {group.inviteCode}
                      </code>
                      <button
                        onClick={() => handleCopyCode(group.inviteCode)}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] ml-1"
                      >
                        {copiedCode === group.inviteCode ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  </span>

                  {group.isMember ? (
                    <button
                      onClick={() => loadGroupDetails(group.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200"
                    >
                      View Roster
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDirectJoin(group)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors"
                    >
                      Join Group
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GROUP DETAILS & MEMBER LIST                                        */}
      {/* ========================================================================= */}
      {viewTab === 'details' && selectedGroup && (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => setViewTab('my_groups')}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Groups</span>
          </button>

          {/* Group Overview Banner */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                    {selectedGroup.name}
                  </h2>
                  {isCurrentAdmin && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                      You are Administrator
                    </span>
                  )}
                  {leaderboardData?.currentUserRank && (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 flex items-center space-x-1">
                      <Trophy className="w-3 h-3 text-amber-500" />
                      <span>Your Rank: #{leaderboardData.currentUserRank}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {selectedGroup.description}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                  <span>Created: {selectedGroup.createdAt}</span>
                  <span>•</span>
                  <span>Creator: {selectedGroup.creatorName} ({selectedGroup.creatorId})</span>
                </div>
              </div>

              {/* Invitation Code Display Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shrink-0 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Invitation Code
                </span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-lg font-extrabold text-sky-600 dark:text-sky-400 tracking-widest">
                    {selectedGroup.inviteCode}
                  </span>
                  <button
                    onClick={() => handleCopyCode(selectedGroup.inviteCode)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                    title="Copy invitation code"
                  >
                    {copiedCode === selectedGroup.inviteCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">Share with team members</span>
              </div>
            </div>

            {/* Quick Actions in details */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                <span>Total Roster: <strong>{selectedGroupMembers.length}</strong> members</span>
                {onNavigate && (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => onNavigate('quiz')}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                    >
                      Take Diagnostic Assessment →
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setIsLeaveConfirmOpen(true)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center space-x-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Group</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Switcher: Leaderboard vs Roster */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              onClick={() => setDetailsSubTab('leaderboard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                detailsSubTab === 'leaderboard'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Competitive Leaderboard</span>
              {leaderboardData?.leaderboard && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  detailsSubTab === 'leaderboard' 
                    ? 'bg-sky-700 text-sky-100' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {leaderboardData.leaderboard.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setDetailsSubTab('roster')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                detailsSubTab === 'roster'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Member Roster</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                detailsSubTab === 'roster' 
                  ? 'bg-sky-700 text-sky-100' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {selectedGroupMembers.length}
              </span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* SUB-TAB 1: COMPETITIVE LEADERBOARD                                        */}
          {/* ========================================================================= */}
          {detailsSubTab === 'leaderboard' && (
            <div className="space-y-5">
              {/* Leaderboard Header & Integrity Explanation */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>{selectedGroup.name} – Competitive Leaderboard</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Server-verified assessment rankings for enrolled cohort members.
                    </p>
                  </div>

                  <button
                    onClick={() => loadLeaderboardData(selectedGroup.id)}
                    disabled={isLoadingLeaderboard}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? 'animate-spin' : ''}`} />
                    <span>Refresh Scores</span>
                  </button>
                </div>

                {/* Scoring Rules Pill */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 dark:text-white">Authoritative Scoring Integrity:</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Only verified assessment submissions stored in <code className="font-mono text-sky-600 dark:text-sky-400">server-data/attempts.json</code> earn points. Duplicate attempt submissions are disqualified. Tie-breaking order: <strong>Total Verified Points</strong> → <strong>Average Score %</strong> → <strong>Completed Assessments</strong> → <strong>Highest Single Score</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error state */}
              {leaderboardData?.error && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                  <span>{leaderboardData.error}</span>
                  <button
                    onClick={() => loadLeaderboardData(selectedGroup.id)}
                    className="font-bold underline ml-2"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Top 3 Podium Highlights (if at least one competitor has points) */}
              {leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 && leaderboardData.leaderboard.some(e => e.totalPoints > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1st Place */}
                  {leaderboardData.leaderboard[0] && (
                    <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-2 border-amber-300 dark:border-amber-700/60 flex flex-col justify-between shadow-xs relative overflow-hidden order-1 sm:order-2">
                      <div className="absolute top-2 right-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <div className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                          <span>🥇 1st Place</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {leaderboardData.leaderboard[0].userName}
                        </h4>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {leaderboardData.leaderboard[0].userId}
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                            {leaderboardData.leaderboard[0].totalPoints}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">pts</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Avg: <strong>{leaderboardData.leaderboard[0].averageScore}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2nd Place */}
                  {leaderboardData.leaderboard[1] && (
                    <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-100 to-white dark:from-slate-800/40 dark:to-slate-900 border border-slate-300 dark:border-slate-700 flex flex-col justify-between shadow-xs order-2 sm:order-1">
                      <div>
                        <div className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          <span>🥈 2nd Place</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {leaderboardData.leaderboard[1].userName}
                        </h4>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {leaderboardData.leaderboard[1].userId}
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-lg font-black text-slate-700 dark:text-slate-300">
                            {leaderboardData.leaderboard[1].totalPoints}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">pts</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Avg: <strong>{leaderboardData.leaderboard[1].averageScore}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {leaderboardData.leaderboard[2] && (
                    <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200 dark:border-amber-800/40 flex flex-col justify-between shadow-xs order-3">
                      <div>
                        <div className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                          <span>🥉 3rd Place</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {leaderboardData.leaderboard[2].userName}
                        </h4>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {leaderboardData.leaderboard[2].userId}
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-lg font-black text-amber-700 dark:text-amber-400">
                            {leaderboardData.leaderboard[2].totalPoints}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">pts</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Avg: <strong>{leaderboardData.leaderboard[2].averageScore}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Full Leaderboard Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Full Cohort Rankings</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {leaderboardData?.leaderboard?.length || 0} competitors
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="p-3 w-16 text-center">Rank</th>
                        <th className="p-3">Competitor</th>
                        <th className="p-3">Role</th>
                        <th className="p-3 text-right">Total Verified Points</th>
                        <th className="p-3 text-center">Assessments</th>
                        <th className="p-3 text-right">Average Score</th>
                        <th className="p-3 text-right">Highest</th>
                        <th className="p-3">Latest Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 ? (
                        leaderboardData.leaderboard.map(entry => {
                          const isCurrentUser = entry.userId.toLowerCase() === currentUserId.toLowerCase();

                          return (
                            <tr
                              key={entry.userId}
                              className={`transition-colors ${
                                isCurrentUser
                                  ? 'bg-sky-50/70 dark:bg-sky-950/40 font-medium'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                              }`}
                            >
                              <td className="p-3 text-center">
                                {entry.rank === 1 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-black text-xs">
                                    🥇
                                  </span>
                                ) : entry.rank === 2 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-black text-xs">
                                    🥈
                                  </span>
                                ) : entry.rank === 3 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100/60 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400 font-black text-xs">
                                    🥉
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-400 text-xs">
                                    #{entry.rank}
                                  </span>
                                )}
                              </td>

                              <td className="p-3">
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                  <span>{entry.userName}</span>
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono block">
                                  {entry.userId}
                                </span>
                              </td>

                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  entry.role === 'admin'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}>
                                  {entry.role === 'admin' ? 'Administrator' : 'Member'}
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm">
                                  {entry.totalPoints}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1">pts</span>
                              </td>

                              <td className="p-3 text-center">
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {entry.completedAssessments}
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  {entry.averageScore}%
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <span className="font-mono text-slate-600 dark:text-slate-400">
                                  {entry.highestScore}%
                                </span>
                              </td>

                              <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                {entry.latestParticipationDate}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No member ranking data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Empty State Callout when 0 attempts */}
                {leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 && leaderboardData.leaderboard.every(e => e.completedAssessments === 0) && (
                  <div className="p-6 text-center border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      No group members have completed diagnostic assessments yet.
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Be the first to score verified points for your team! Complete a practice or exam assessment in the assessment engine.
                    </p>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('quiz')}
                        className="mt-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs"
                      >
                        Launch Assessment Engine
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUB-TAB 2: MEMBER LIST ROSTER TABLE                                       */}
          {/* ========================================================================= */}
          {detailsSubTab === 'roster' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Group Member Roster ({selectedGroupMembers.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Verified assessment history and participation status sourced from the shared backend.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="p-3">Member</th>
                        <th className="p-3">Group Role</th>
                        <th className="p-3">Joined Date</th>
                        <th className="p-3">Assessment Activity</th>
                        {isCurrentAdmin && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {selectedGroupMembers.map(member => {
                        const isSelf = member.userId.toLowerCase() === currentUserId.toLowerCase();
                        const hasCompletedTests = (member.assessmentCount || 0) > 0;

                        return (
                          <tr key={member.userId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                <span>{member.userName}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                {member.userId}
                              </span>
                            </td>

                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                member.role === 'admin'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}>
                                {member.role === 'admin' ? 'Administrator' : 'Member'}
                              </span>
                            </td>

                            <td className="p-3 text-slate-500 dark:text-slate-400">
                              {member.joinedAt}
                            </td>

                            <td className="p-3">
                              {hasCompletedTests ? (
                                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>{member.assessmentCount} {member.assessmentCount === 1 ? 'Assessment' : 'Assessments'} Scored</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  Ready for first test
                                </span>
                              )}
                            </td>

                            {isCurrentAdmin && (
                              <td className="p-3 text-right">
                                {member.role !== 'admin' ? (
                                  <button
                                    onClick={() => handleRemoveMember(member.userId)}
                                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                                    title="Remove member (Administrator action)"
                                  >
                                    Remove
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Admin</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE GROUP                                                       */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Security Group</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {createError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Incident Response Cohort"
                  maxLength={50}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Description *
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What is the focus of this group? e.g. Phishing simulation practice and weekly threat hunting drills."
                  rows={3}
                  maxLength={250}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-300 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Automatic Invitation Code & Admin Role</span>
                </div>
                <p>
                  A unique 6-character invitation code will be generated automatically. As creator, you will become the Group Administrator.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: JOIN GROUP BY CODE                                                 */}
      {/* ========================================================================= */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Join by Invitation Code</h3>
              </div>
              <button
                onClick={() => setIsJoinOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-3.5">
              {joinError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs">
                  {joinError}
                </div>
              )}

              {joinSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs flex items-center space-x-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{joinSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  6-Character Invitation Code *
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CYB101"
                  maxLength={6}
                  className="w-full px-3 py-2.5 text-center font-mono text-base tracking-widest uppercase font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
                <span className="text-[11px] text-slate-400 block mt-1 text-center">
                  Case-insensitive alphanumeric code provided by your group admin
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining || joinCodeInput.trim().length !== 6}
                  className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isJoining ? 'Joining...' : 'Confirm & Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LEAVE GROUP CONFIRMATION                                           */}
      {/* ========================================================================= */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-3.5 shadow-xl">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Leave This Group?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to leave <strong>{selectedGroup?.name}</strong>? You will no longer receive group announcements or participate in team activities unless invited again.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsLeaveConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
              >
                Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
