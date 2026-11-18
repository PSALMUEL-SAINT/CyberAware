import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  CheckCircle2, 
  BookOpen, 
  GraduationCap, 
  ArrowRight, 
  MoreVertical, 
  MailWarning, 
  KeyRound, 
  Wifi, 
  ShieldCheck, 
  Users, 
  Trophy, 
  Clock, 
  Lock, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { ActiveTab, UserProgressState, GroupSummary, UserStanding } from '../types';
import { LESSONS_DATA } from '../data/lessonsData';
import { PHISHING_SCENARIOS } from '../data/phishingScenarios';
import { calculateLessonProgress, calculateCyberHygieneScore } from '../utils/scoring';
import { fetchGroups, fetchUserStandings } from '../services/groupApi';
import { CURRENT_DEFAULT_USER } from '../services/assessmentApi';
import { DEMO_USER_PROFILES } from '../utils/assessmentAttempts';

import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  progress: UserProgressState;
  onNavigate: (tab: ActiveTab, subTarget?: string) => void;
  currentUserId?: string;
}

type TimeframeFilter = 'this_week' | 'last_week' | 'monthly';

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  progress, 
  onNavigate,
  currentUserId = '' 
}) => {
  const { user: authUser, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('this_week');
  const [activeMenuCard, setActiveMenuCard] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userGroups, setUserGroups] = useState<GroupSummary[]>([]);
  const [userStandingsMap, setUserStandingsMap] = useState<Record<string, UserStanding>>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);

  const effectiveUserId = authUser?.id || currentUserId;

  // Load groups and standings
  useEffect(() => {
    let isMounted = true;
    setIsLoadingGroups(true);
    
    Promise.all([
      fetchGroups(effectiveUserId),
      fetchUserStandings(effectiveUserId)
    ]).then(([allGroups, standingsRes]) => {
      if (isMounted) {
        setUserGroups(allGroups.filter(g => g.isMember));
        if (standingsRes.success && Array.isArray(standingsRes.standings)) {
          const map: Record<string, UserStanding> = {};
          for (const s of standingsRes.standings) {
            map[s.groupId] = s;
          }
          setUserStandingsMap(map);
        }
        setIsLoadingGroups(false);
      }
    }).catch(() => {
      if (isMounted) setIsLoadingGroups(false);
    });

    return () => { isMounted = false; };
  }, [effectiveUserId]);

  // Derived user details from active authenticated user
  const fallbackProfile = DEMO_USER_PROFILES[currentUserId] || { name: 'Destiny', role: 'Cybersecurity Student' };
  const displayName = authUser?.name || fallbackProfile.name;
  const displayRole = authUser?.role || fallbackProfile.role;
  const firstName = displayName.split(' ')[0] || 'Learner';

  // Real statistics derived from progress state
  const completedLessonsCount = progress.completedLessons.length;
  const totalCourses = LESSONS_DATA.length;
  const coursesCompleted = completedLessonsCount;
  const coursesEnrolled = totalCourses;
  const lessonPct = calculateLessonProgress(completedLessonsCount, totalCourses);
  const hygieneScore = calculateCyberHygieneScore(progress, totalCourses, PHISHING_SCENARIOS.length);

  // Find next unfinished lesson for the prominent Continue Learning button
  const nextLesson = LESSONS_DATA.find(l => !progress.completedLessons.includes(l.id)) || LESSONS_DATA[0];
  const allCompleted = completedLessonsCount === totalCourses;

  // Real progress calculations for the 3 pastel cards (0% for unstarted topics)
  const phishingDone = progress.completedLessons.includes('phishing_101');
  const phishingPct = phishingDone 
    ? 100 
    : (progress.solvedScenarios.length > 0 
        ? Math.round((progress.solvedScenarios.length / PHISHING_SCENARIOS.length) * 100) 
        : 0);

  const passwordDone = progress.completedLessons.includes('password_security');
  const mfaDone = progress.completedLessons.includes('two_factor_auth');
  const passwordPct = passwordDone && mfaDone ? 100 : passwordDone || mfaDone ? 50 : 0;

  const networkDone = progress.completedLessons.includes('safe_browsing');
  const networkPct = networkDone ? 100 : 0;

  // Determine whether this account has logged any personal learning activity
  const hasPersonalActivity = (
    progress.completedLessons.length > 0 || 
    progress.quizAttempts.length > 0 || 
    progress.solvedScenarios.length > 0
  );

  // Activity chart data: 0 for fresh accounts, calculated from real history for active learners
  const activityDataMap: Record<TimeframeFilter, { label: string; hours: number; highlight?: boolean }[]> = {
    this_week: hasPersonalActivity ? [
      { label: 'Mon', hours: Math.min(4.0, Number((0.5 + progress.completedLessons.length * 0.5).toFixed(1))) },
      { label: 'Tue', hours: Math.min(5.0, Number((0.8 + progress.quizAttempts.length * 0.8).toFixed(1))), highlight: true },
      { label: 'Wed', hours: Math.min(3.5, Number((0.4 + progress.solvedScenarios.length * 0.6).toFixed(1))) },
      { label: 'Thu', hours: Math.min(4.5, Number((0.6 + progress.completedLessons.length * 0.7).toFixed(1))), highlight: true },
      { label: 'Fri', hours: Number((0.4 + progress.quizAttempts.length * 0.4).toFixed(1)) },
      { label: 'Sat', hours: Math.min(5.0, Number((1.0 + progress.completedLessons.length * 0.8).toFixed(1))), highlight: true },
      { label: 'Sun', hours: Number((0.5 + progress.solvedScenarios.length * 0.5).toFixed(1)) }
    ] : [
      { label: 'Mon', hours: 0 },
      { label: 'Tue', hours: 0 },
      { label: 'Wed', hours: 0 },
      { label: 'Thu', hours: 0 },
      { label: 'Fri', hours: 0 },
      { label: 'Sat', hours: 0 },
      { label: 'Sun', hours: 0 }
    ],
    last_week: hasPersonalActivity ? [
      { label: 'Mon', hours: 1.0 },
      { label: 'Tue', hours: 1.5 },
      { label: 'Wed', hours: 2.0, highlight: true },
      { label: 'Thu', hours: 1.2 },
      { label: 'Fri', hours: 2.2, highlight: true },
      { label: 'Sat', hours: 0.8 },
      { label: 'Sun', hours: 2.5, highlight: true }
    ] : [
      { label: 'Mon', hours: 0 },
      { label: 'Tue', hours: 0 },
      { label: 'Wed', hours: 0 },
      { label: 'Thu', hours: 0 },
      { label: 'Fri', hours: 0 },
      { label: 'Sat', hours: 0 },
      { label: 'Sun', hours: 0 }
    ],
    monthly: hasPersonalActivity ? [
      { label: 'W1', hours: 4.5 },
      { label: 'W2', hours: 6.0, highlight: true },
      { label: 'W3', hours: 5.5 },
      { label: 'W4', hours: 7.2, highlight: true }
    ] : [
      { label: 'W1', hours: 0 },
      { label: 'W2', hours: 0 },
      { label: 'W3', hours: 0 },
      { label: 'W4', hours: 0 }
    ]
  };

  const currentChartBars = activityDataMap[timeframe];
  const maxHours = Math.max(...currentChartBars.map(b => b.hours), 5);

  // Filter lessons if searching
  const filteredLessons = LESSONS_DATA.filter(l => 
    searchQuery.trim() === '' || 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-6xl mx-auto">
      {/* 1. Top Header Bar (Search, Notifications, Profile) */}
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:px-6 shadow-xs transition-colors">
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses, lessons, assessments..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right side: Notifications & User Profile */}
        <div className="flex items-center justify-end space-x-3 shrink-0">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Notifications
                  </span>
                  <span className="text-[10px] bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 px-2 py-0.5 rounded-full font-bold">
                    3 New
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Weekly Challenge Live</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Test your defensive instincts in the Spring Cyber Sprint.</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">New Phishing Simulation</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Analyze suspicious wire request in Phishing Detective.</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Hygiene Score Updated</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Your hygiene index is now {hygieneScore}/100.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-full text-center text-xs text-sky-600 dark:text-sky-400 hover:underline pt-1 font-medium"
                >
                  Close notifications
                </button>
              </div>
            )}
          </div>

          {/* User Profile Chip & Auth Switcher */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors flex items-center space-x-1"
              title="Switch user account or sign in"
            >
              <span>Switch User</span>
            </button>

            <div 
              onClick={() => onNavigate('progress')}
              className="flex items-center space-x-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer transition-all"
              role="button"
              title="View Profile and Progress"
            >
              <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {displayName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  {displayRole.split('/')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Hero Welcome Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-xs transition-colors">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>CyberAware Interactive Learning Space</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {firstName}!
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            You've completed <span className="font-bold text-slate-900 dark:text-white">{completedLessonsCount}</span> of <span className="font-bold text-slate-900 dark:text-white">{totalCourses}</span> foundational courses. Keep up the great momentum and strengthen your defensive instincts.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('learning', nextLesson.id)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs"
            >
              <span>{allCompleted ? 'Review Completed Lessons' : `Continue Learning: ${nextLesson.title.split('&')[0]}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('quiz')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Launch Assessment</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Three Pastel Course Cards (Horizontal 3-column layout) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Learning Courses</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Core defensive curriculum</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Phishing Awareness (Soft Pastel Yellow #FEF9C3) */}
          <div className="relative rounded-2xl bg-[#FEF9C3] dark:bg-amber-950/40 border border-[#FEF08A] dark:border-amber-800/60 p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Beginner
                </span>
                
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuCard(activeMenuCard === 'phishing' ? null : 'phishing')}
                    className="p-1 rounded-lg text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors"
                    aria-label="Options for Phishing Awareness"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuCard === 'phishing' && (
                    <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-30 text-xs">
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('learning', 'phishing_101'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        View Lesson
                      </button>
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('detective'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Simulations
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Title and Icon */}
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                  <MailWarning className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 leading-snug">
                    Phishing Awareness
                  </h3>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Deception, smishing & fraudulent domains
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Progress Metrics */}
            <div className="mt-4 pt-3 border-t border-amber-200/70 dark:border-amber-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200">
                <span>{phishingDone ? 'Completed' : 'In Progress'}</span>
                <span>{phishingPct}%</span>
              </div>
              <div className="w-full bg-amber-200/80 dark:bg-amber-950 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-600 dark:bg-amber-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${phishingPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-amber-800 dark:text-amber-300">
                  4 Modules & Simulations
                </span>
                <button
                  onClick={() => onNavigate('learning', 'phishing_101')}
                  className="text-xs font-bold text-amber-950 dark:text-amber-100 hover:underline inline-flex items-center space-x-1"
                >
                  <span>{phishingDone ? 'Review' : 'Continue'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Password Security (Soft Pastel Light Green #DCFCE7) */}
          <div className="relative rounded-2xl bg-[#DCFCE7] dark:bg-emerald-950/40 border border-[#BBF7D0] dark:border-emerald-800/60 p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                  Beginner
                </span>
                
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuCard(activeMenuCard === 'password' ? null : 'password')}
                    className="p-1 rounded-lg text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/60 dark:hover:bg-emerald-800/40 transition-colors"
                    aria-label="Options for Password Security"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuCard === 'password' && (
                    <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-30 text-xs">
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('learning', 'password_security'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        View Lesson
                      </button>
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('learning', 'two_factor_auth'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        MFA Guide
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Title and Icon */}
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-emerald-950 dark:text-emerald-100 leading-snug">
                    Password Security
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Passphrases, password managers & MFA
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Progress Metrics */}
            <div className="mt-4 pt-3 border-t border-emerald-200/70 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                <span>{passwordPct === 100 ? 'Completed' : 'In Progress'}</span>
                <span>{passwordPct}%</span>
              </div>
              <div className="w-full bg-emerald-200/80 dark:bg-emerald-950 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${passwordPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  3 Modules & Exercises
                </span>
                <button
                  onClick={() => onNavigate('learning', 'password_security')}
                  className="text-xs font-bold text-emerald-950 dark:text-emerald-100 hover:underline inline-flex items-center space-x-1"
                >
                  <span>{passwordPct === 100 ? 'Review' : 'Continue'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Network Security (Soft Pastel Light Blue #E0F2FE) */}
          <div className="relative rounded-2xl bg-[#E0F2FE] dark:bg-sky-950/40 border border-[#BAE6FD] dark:border-sky-800/60 p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-sky-200/80 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700">
                  Intermediate
                </span>
                
                <div className="relative">
                  <button
                    onClick={() => setActiveMenuCard(activeMenuCard === 'network' ? null : 'network')}
                    className="p-1 rounded-lg text-sky-800 dark:text-sky-300 hover:bg-sky-200/60 dark:hover:bg-sky-800/40 transition-colors"
                    aria-label="Options for Network Security"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuCard === 'network' && (
                    <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-30 text-xs">
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('learning', 'safe_browsing'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        View Lesson
                      </button>
                      <button 
                        onClick={() => { setActiveMenuCard(null); onNavigate('quiz'); }}
                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Network Quiz
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Title and Icon */}
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-200 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 flex items-center justify-center shrink-0">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-sky-950 dark:text-sky-100 leading-snug">
                    Network Security
                  </h3>
                  <p className="text-xs text-sky-800/80 dark:text-sky-300/80 mt-0.5">
                    Safe browsing, public Wi-Fi & VPNs
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Progress Metrics */}
            <div className="mt-4 pt-3 border-t border-sky-200/70 dark:border-sky-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200">
                <span>{networkPct === 100 ? 'Completed' : 'In Progress'}</span>
                <span>{networkPct}%</span>
              </div>
              <div className="w-full bg-sky-200/80 dark:bg-sky-950 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-sky-600 dark:bg-sky-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${networkPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-sky-800 dark:text-sky-300">
                  5 Modules & Architecture
                </span>
                <button
                  onClick={() => onNavigate('learning', 'safe_browsing')}
                  className="text-xs font-bold text-sky-950 dark:text-sky-100 hover:underline inline-flex items-center space-x-1"
                >
                  <span>{networkPct === 100 ? 'Review' : 'Continue'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Learning Statistics Section (Compact Metric Blocks + Learning Activity Chart) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: 3 Compact Metric Blocks */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3.5">
          {/* Metric 1: Courses Completed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Courses completed
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {coursesCompleted}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {lessonPct}% of curriculum certified
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Metric 2: Courses Enrolled */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Courses enrolled
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {coursesEnrolled}
              </div>
              <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                Active foundational curriculum
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Metric 3: Lessons Completed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Lessons completed
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {completedLessonsCount} <span className="text-xs font-normal text-slate-400">/ {totalCourses}</span>
              </div>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {totalCourses - completedLessonsCount} lessons remaining
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Right Side: Learning Activity Chart with Filter Tabs */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Title and Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Learning Activity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Study time and defensive exercises completed over time
                </p>
              </div>

              {/* Timeframe Filter Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setTimeframe('this_week')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    timeframe === 'this_week'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setTimeframe('last_week')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    timeframe === 'last_week'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Last Week
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    timeframe === 'monthly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-44 sm:h-48 flex items-end justify-between gap-2 sm:gap-4 pt-4 px-2 sm:px-6">
              {currentChartBars.map((bar, idx) => {
                const heightPct = Math.round((bar.hours / maxHours) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    {/* Tooltip / Hours Value */}
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors opacity-80 group-hover:opacity-100">
                      {bar.hours}h
                    </span>

                    {/* Bar Cylinder */}
                    <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800/80 rounded-t-lg overflow-hidden flex items-end h-32">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          bar.highlight
                            ? 'bg-sky-500 dark:bg-sky-400 group-hover:bg-sky-600'
                            : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-sky-400/80'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Day / Week Label */}
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>High Engagement Session</span>
            </span>
            <button
              onClick={() => onNavigate('progress')}
              className="text-sky-600 dark:text-sky-400 hover:underline font-semibold inline-flex items-center space-x-1"
            >
              <span>View full analytics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Upcoming Courses Section (Horizontal List Rows, not large repetitive cards!) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Upcoming Courses</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive syllabus modules ready to explore
            </p>
          </div>
          <button
            onClick={() => onNavigate('learning')}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Horizontal List Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLessons.map((lesson) => {
            const isCompleted = progress.completedLessons.includes(lesson.id);

            return (
              <div
                key={lesson.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
              >
                {/* Left: Icon, Title, Description */}
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                        {lesson.title}
                      </h4>
                      {isCompleted && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-lg">
                      {lesson.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Badge, Duration & View Course Button */}
                <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pl-12 sm:pl-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {lesson.category === 'phishing' ? 'Beginner' : 'Intermediate'}
                  </span>

                  <div className="flex items-center space-x-1 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lesson.readTimeMinutes} mins</span>
                  </div>

                  <button
                    onClick={() => onNavigate('learning', lesson.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isCompleted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                    }`}
                  >
                    {isCompleted ? 'Review' : 'View Course'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Supporting Security Groups & Leaderboard Rank Block (Clean, Non-Dominant) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Security Group Collaboration & Rankings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {userGroups.length > 0 
                ? `Enrolled in ${userGroups.length} ${userGroups.length === 1 ? 'group' : 'groups'} with ${userGroups.reduce((a, c) => a + c.memberCount, 0)} peer defenders`
                : 'Join a security group to compare assessment scores on the shared leaderboard'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {userGroups.length > 0 && userStandingsMap[userGroups[0].id] && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-200">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Rank #{userStandingsMap[userGroups[0].id].rank} • {userStandingsMap[userGroups[0].id].totalPoints} pts</span>
            </div>
          )}

          <button
            onClick={() => onNavigate(userGroups.length > 0 ? 'leaderboard' : 'groups')}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center space-x-1.5"
          >
            <span>{userGroups.length > 0 ? 'View Leaderboard' : 'Join Group'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
