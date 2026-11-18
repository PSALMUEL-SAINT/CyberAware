import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Award, 
  Users, 
  RefreshCw, 
  ShieldCheck, 
  TrendingUp, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { 
  SecurityGroup, 
  GroupSummary, 
  GroupLeaderboardResponse, 
  LeaderboardEntry, 
  UserStanding, 
  ActiveTab 
} from '../types';
import { 
  fetchGroups, 
  fetchGroupLeaderboard, 
  fetchUserStandings 
} from '../services/groupApi';
import { CURRENT_DEFAULT_USER } from '../services/assessmentApi';

interface LeaderboardViewProps {
  currentUserId: string;
  onChangeUser?: (userId: string) => void;
  onNavigate?: (tab: ActiveTab, subTarget?: string) => void;
  initialGroupId?: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUserId = '',
  onChangeUser,
  onNavigate,
  initialGroupId
}) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [leaderboardData, setLeaderboardData] = useState<GroupLeaderboardResponse | null>(null);
  const [userStandingsMap, setUserStandingsMap] = useState<Record<string, UserStanding>>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Initial data load: groups and standings
  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      setIsLoadingGroups(true);
      setErrorMessage(null);
      try {
        const [allGroups, standingsRes] = await Promise.all([
          fetchGroups(currentUserId),
          fetchUserStandings(currentUserId)
        ]);

        if (!mounted) return;

        setGroups(allGroups);

        if (standingsRes.success && Array.isArray(standingsRes.standings)) {
          const map: Record<string, UserStanding> = {};
          standingsRes.standings.forEach(s => { map[s.groupId] = s; });
          setUserStandingsMap(map);
        }

        // Determine default group: prefer initialGroupId, then first enrolled group, then first public group
        const enrolled = allGroups.filter(g => g.isMember);
        const defaultGroup = initialGroupId
          ? allGroups.find(g => g.id === initialGroupId)
          : (enrolled.length > 0 ? enrolled[0] : allGroups[0]);

        if (defaultGroup) {
          setSelectedGroupId(defaultGroup.id);
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMessage(err?.message || 'Failed to load leaderboard data.');
        }
      } finally {
        if (mounted) setIsLoadingGroups(false);
      }
    }

    loadInitialData();
    return () => { mounted = false; };
  }, [currentUserId, initialGroupId]);

  // 2. Load group leaderboard whenever selected group changes
  useEffect(() => {
    if (!selectedGroupId) return;

    let mounted = true;
    async function loadLeaderboard() {
      setIsLoadingLeaderboard(true);
      try {
        const data = await fetchGroupLeaderboard(selectedGroupId!, currentUserId);
        if (mounted) {
          setLeaderboardData(data);
        }
      } catch (err: any) {
        if (mounted) {
          setLeaderboardData(prev => prev ? { ...prev, error: err?.message || 'Error fetching leaderboard' } : null);
        }
      } finally {
        if (mounted) setIsLoadingLeaderboard(false);
      }
    }

    loadLeaderboard();
    return () => { mounted = false; };
  }, [selectedGroupId, currentUserId]);

  const handleRefresh = async () => {
    if (!selectedGroupId) return;
    setIsLoadingLeaderboard(true);
    try {
      const [data, standingsRes] = await Promise.all([
        fetchGroupLeaderboard(selectedGroupId, currentUserId),
        fetchUserStandings(currentUserId)
      ]);
      setLeaderboardData(data);
      if (standingsRes.success && Array.isArray(standingsRes.standings)) {
        const map: Record<string, UserStanding> = {};
        standingsRes.standings.forEach(s => { map[s.groupId] = s; });
        setUserStandingsMap(map);
      }
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const selectedGroupSummary = groups.find(g => g.id === selectedGroupId);
  const myStanding = selectedGroupId ? userStandingsMap[selectedGroupId] : undefined;
  const currentLeaderboardEntries = leaderboardData?.leaderboard || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/50">
              Competitive Scoring
            </span>
            <span className="text-xs text-slate-400">Server-Verified Records</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center space-x-2.5">
            <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
            <span>CyberAware Leaderboard</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compare verified cybersecurity assessment points and rankings across study cohorts.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isLoadingLeaderboard || isLoadingGroups}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs disabled:opacity-50"
            title="Refresh leaderboard rankings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? 'animate-spin text-sky-500' : 'text-slate-500'}`} />
            <span>Refresh Standings</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('quiz')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-xs"
            >
              <span>Take Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Group Selection Switcher */}
      {groups.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Select Security Cohort</span>
            </span>

            {onNavigate && (
              <button
                onClick={() => onNavigate('groups')}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center space-x-1"
              >
                <span>Manage Security Groups</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
            {groups.map(group => {
              const isSelected = group.id === selectedGroupId;
              const standing = userStandingsMap[group.id];

              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center space-x-2 shrink-0 ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Trophy className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span>{group.name}</span>
                  {group.isMember && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected 
                        ? 'bg-sky-700 text-sky-100' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {standing ? `Rank #${standing.rank}` : 'Member'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No Security Cohorts Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Join or create a security group to participate in competitive cohort assessments and earn rank points.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('groups')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              <span>Explore Security Groups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 3. Current User Standing Banner */}
      {selectedGroupId && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/30 dark:border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs font-bold text-sm shrink-0">
              {myStanding?.rank ? `#${myStanding.rank}` : '—'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Your Cohort Standing</span>
                {selectedGroupSummary?.isMember && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    Enrolled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {myStanding 
                  ? `Position #${myStanding.rank} of ${myStanding.totalMembers} members in ${myStanding.groupName}`
                  : (selectedGroupSummary?.isMember 
                      ? 'No assessment points recorded yet in this cohort.' 
                      : 'You are not enrolled in this group. Join the group to record verified points on its leaderboard.')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 shrink-0 text-xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Total Points</span>
              <span className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                {myStanding?.totalPoints ?? 0}
              </span>
            </div>
            <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Avg. Score</span>
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {myStanding?.averageScore ?? 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Top 3 Podium Highlights */}
      {currentLeaderboardEntries.length > 0 && currentLeaderboardEntries.some(e => e.totalPoints > 0) && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Podium Champions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1st Place Champion */}
            {currentLeaderboardEntries[0] && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 border-2 border-amber-300 dark:border-amber-700/60 flex flex-col justify-between shadow-xs relative overflow-hidden order-1 sm:order-2">
                <div className="absolute top-2 right-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1">
                    <span>🥇 1st Place</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {currentLeaderboardEntries[0].userName}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono block truncate">
                    {currentLeaderboardEntries[0].userId}
                  </span>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                      {currentLeaderboardEntries[0].totalPoints}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Avg: <strong className="text-slate-800 dark:text-slate-200">{currentLeaderboardEntries[0].averageScore}%</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* 2nd Place */}
            {currentLeaderboardEntries[1] && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-100 to-white dark:from-slate-800/40 dark:to-slate-900 border border-slate-300 dark:border-slate-700 flex flex-col justify-between shadow-xs order-2 sm:order-1">
                <div>
                  <div className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    <span>🥈 2nd Place</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {currentLeaderboardEntries[1].userName}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono block truncate">
                    {currentLeaderboardEntries[1].userId}
                  </span>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
                      {currentLeaderboardEntries[1].totalPoints}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Avg: <strong className="text-slate-800 dark:text-slate-200">{currentLeaderboardEntries[1].averageScore}%</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {currentLeaderboardEntries[2] && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200 dark:border-amber-800/40 flex flex-col justify-between shadow-xs order-3">
                <div>
                  <div className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                    <span>🥉 3rd Place</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {currentLeaderboardEntries[2].userName}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono block truncate">
                    {currentLeaderboardEntries[2].userId}
                  </span>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
                      {currentLeaderboardEntries[2].totalPoints}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Avg: <strong className="text-slate-800 dark:text-slate-200">{currentLeaderboardEntries[2].averageScore}%</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Full Cohort Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {leaderboardData?.groupName || selectedGroupSummary?.name || 'Cohort'} – Official Rankings
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {currentLeaderboardEntries.length} registered {currentLeaderboardEntries.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        {isLoadingLeaderboard ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500" />
            <p className="text-xs">Computing server-verified assessment points...</p>
          </div>
        ) : currentLeaderboardEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <Trophy className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              No Assessment Points Recorded Yet
            </h4>
            <p className="text-xs max-w-sm mx-auto">
              Members of this cohort have not submitted any completed assessments yet. Complete a quiz to climb to the top of the leaderboard!
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('quiz')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-xs"
              >
                Launch Assessment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="p-3.5 w-16 text-center">Rank</th>
                  <th className="p-3.5">Defender / Member</th>
                  <th className="p-3.5">Cohort Role</th>
                  <th className="p-3.5 text-right">Verified Points</th>
                  <th className="p-3.5 text-center">Assessments</th>
                  <th className="p-3.5 text-right">Average Score</th>
                  <th className="p-3.5 text-right">Highest Score</th>
                  <th className="p-3.5">Latest Participation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {currentLeaderboardEntries.map(entry => {
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
                      {/* Rank Indicator */}
                      <td className="p-3.5 text-center">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-black text-xs shadow-2xs">
                            🥇
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-black text-xs shadow-2xs">
                            🥈
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100/60 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400 font-black text-xs shadow-2xs">
                            🥉
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-slate-400 text-xs">
                            #{entry.rank}
                          </span>
                        )}
                      </td>

                      {/* Name & ID */}
                      <td className="p-3.5">
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

                      {/* Group Role */}
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          entry.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}>
                          {entry.role === 'admin' ? 'Administrator' : 'Member'}
                        </span>
                      </td>

                      {/* Points */}
                      <td className="p-3.5 text-right">
                        <span className="font-mono font-black text-sky-600 dark:text-sky-400 text-sm">
                          {entry.totalPoints}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">pts</span>
                      </td>

                      {/* Assessments count */}
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {entry.completedAssessments}
                        </span>
                      </td>

                      {/* Average Score */}
                      <td className="p-3.5 text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {entry.averageScore}%
                        </span>
                      </td>

                      {/* Highest Single Score */}
                      <td className="p-3.5 text-right">
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {entry.highestScore ?? entry.totalPoints} pts
                        </span>
                      </td>

                      {/* Latest Activity */}
                      <td className="p-3.5">
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{entry.latestParticipationDate || 'No attempts'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Scoring Rules & Fair Play Explanation */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Competitive Scoring Integrity & Fair Play Standard
          </h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Leaderboard standings in CyberAware are computed using authoritative records in <code className="font-mono text-sky-600 dark:text-sky-400">server-data/attempts.json</code>. Client-supplied scores are discarded; the server grades every answer against the official question bank. Duplicate submissions are rejected with HTTP 409, and rankings are broken using the standard tie-breaker: <strong>Total Points</strong> → <strong>Average %</strong> → <strong>Attempt Count</strong>.
        </p>
      </div>
    </div>
  );
};
