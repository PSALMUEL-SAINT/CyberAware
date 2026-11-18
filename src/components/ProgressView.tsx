import React, { useState, useMemo } from 'react';
import { 
  Award, 
  CheckCircle2, 
  XCircle,
  RotateCcw, 
  Copy, 
  Check, 
  ShieldCheck, 
  BookOpen, 
  Lock,
  ArrowRight,
  AlertTriangle,
  FileText,
  Sparkles,
  TrendingUp,
  Target,
  Layers,
  Shield,
  Network,
  Cpu,
  Globe,
  Crosshair,
  Activity,
  Bug,
  Cloud,
  Key,
  Compass,
  Printer,
  Database,
  RefreshCw
} from 'lucide-react';
import { UserProgressState, ActiveTab } from '../types';
import { LESSONS_DATA } from '../data/lessonsData';
import { PHISHING_SCENARIOS } from '../data/phishingScenarios';
import { ASSESSMENT_CATEGORIES } from '../data/assessmentData';
import { 
  ALL_BADGES, 
  calculateCyberHygieneScore, 
  calculateQuizStats,
  identifyWeakTopicsAndRecommendations,
  calculateComprehensiveMastery,
  getProficiencyLevel
} from '../utils/scoring';
import { CURRENT_DEFAULT_USER } from '../services/assessmentApi';

interface ProgressViewProps {
  progress: UserProgressState;
  onResetProgress: () => void;
  onNavigate: (tab: ActiveTab, subTarget?: string) => void;
  currentUserId?: string;
  onChangeUser?: (userId: string) => void;
  onRefreshAttempts?: () => Promise<void>;
  isSyncing?: boolean;
}

// Icon helper for domain categories
const getCategoryIcon = (key: string) => {
  switch (key) {
    case 'security_awareness_identity': return <Shield className="w-4 h-4 text-sky-500" />;
    case 'network_security': return <Network className="w-4 h-4 text-indigo-500" />;
    case 'os_endpoint_security': return <Cpu className="w-4 h-4 text-amber-500" />;
    case 'web_appsec': return <Globe className="w-4 h-4 text-emerald-500" />;
    case 'pentest_methodology': return <Crosshair className="w-4 h-4 text-rose-500" />;
    case 'soc_incident_response': return <Activity className="w-4 h-4 text-blue-500" />;
    case 'malware_ransomware': return <Bug className="w-4 h-4 text-purple-500" />;
    case 'cloud_devsecops': return <Cloud className="w-4 h-4 text-cyan-500" />;
    case 'cryptography_pki': return <Key className="w-4 h-4 text-teal-500" />;
    case 'governance_risk_privacy': return <FileText className="w-4 h-4 text-orange-500" />;
    case 'emerging_threats_research': return <Sparkles className="w-4 h-4 text-fuchsia-500" />;
    default: return <Shield className="w-4 h-4 text-sky-500" />;
  }
};

export const ProgressView: React.FC<ProgressViewProps> = ({
  progress,
  onResetProgress,
  onNavigate,
  currentUserId = '',
  onChangeUser,
  onRefreshAttempts,
  isSyncing = false
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'exam' | 'practice'>('all');

  const hygieneScore = calculateCyberHygieneScore(progress, LESSONS_DATA.length, PHISHING_SCENARIOS.length);
  const quizStats = calculateQuizStats(progress.quizAttempts);

  // Recommendations based on performance
  const weakTopics = useMemo(() => {
    return identifyWeakTopicsAndRecommendations(progress.quizAttempts);
  }, [progress.quizAttempts]);

  // Comprehensive 11-domain mastery
  const categoryKeys = useMemo(() => ASSESSMENT_CATEGORIES.map(c => c.key), []);
  const masteryMap = useMemo(() => {
    return calculateComprehensiveMastery(progress.quizAttempts, categoryKeys);
  }, [progress.quizAttempts, categoryKeys]);

  // Overall question totals
  const totalQuestionsAnswered = useMemo(() => {
    return progress.quizAttempts.reduce((acc, curr) => acc + curr.total, 0);
  }, [progress.quizAttempts]);

  const totalQuestionsCorrect = useMemo(() => {
    return progress.quizAttempts.reduce((acc, curr) => acc + curr.score, 0);
  }, [progress.quizAttempts]);

  const overallAccuracy = totalQuestionsAnswered > 0
    ? Math.round((totalQuestionsCorrect / totalQuestionsAnswered) * 100)
    : 0;

  const proficiency = getProficiencyLevel(quizStats.bestScorePct || hygieneScore);

  const filteredAttempts = useMemo(() => {
    if (historyFilter === 'exam') {
      return progress.quizAttempts.filter(a => a.mode === 'exam');
    }
    if (historyFilter === 'practice') {
      return progress.quizAttempts.filter(a => a.mode !== 'exam');
    }
    return progress.quizAttempts;
  }, [progress.quizAttempts, historyFilter]);

  const handleCopyReportCard = () => {
    const reportText = `=====================================================
CYBERAWARE PERSONAL SECURITY PROGRESS REPORT
User Account: ${currentUserId || 'Guest Defender'}
Generated Date: ${new Date().toLocaleDateString()}
Platform Standing: ${proficiency.title} (${proficiency.badgeLabel})
=====================================================

1. EXECUTIVE HYGIENE SCORE: ${hygieneScore}/100
   - Core Modules Completed: ${progress.completedLessons.length} of ${LESSONS_DATA.length}
   - Phishing Threats Identified: ${progress.solvedScenarios.length} of ${PHISHING_SCENARIOS.length}
   - Defense Badges Unlocked: ${progress.earnedBadges.length} of ${ALL_BADGES.length}

2. ASSESSMENT ENGINE PERFORMANCE:
   - Total Assessments Taken: ${quizStats.totalAttempts}
   - Total Questions Answered: ${totalQuestionsAnswered} (${totalQuestionsCorrect} Accurate)
   - Overall Accuracy Rate: ${overallAccuracy}%
   - High Score: ${quizStats.bestScorePct}%
   - Average Score: ${quizStats.averageScorePct}%

3. DOMAIN MASTERY HIGHLIGHTS:
${ASSESSMENT_CATEGORIES.map(c => {
  const m = masteryMap[c.key];
  return `   - ${c.shortLabel}: ${m.percentage}% accuracy (${m.tierLabel}, ${m.attempted} questions)`;
}).join('\n')}

4. RECOMMENDED REMEDIATION:
${weakTopics.length > 0 ? weakTopics.map(w => `   - ${w.topicLabel} (${w.accuracy}% accuracy): ${w.remediationAdvice}`).join('\n') : '   - All assessed areas meet target baseline (>75%). Maintain readiness through regular diagnostic drills.'}

Educational Disclaimer: CyberAware is an awareness platform. This report demonstrates practical security understanding and does not constitute official certification.
=====================================================`;

    navigator.clipboard?.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Personal Security Progress Report
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Live Profile
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Verified assessment records, topic mastery metrics, and adaptive learning recommendations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyReportCard}
            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center space-x-1.5 transition-colors shadow-xs"
            title="Copy full text progress report to clipboard"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-sky-600" />}
            <span>{copiedReport ? 'Report Copied' : 'Export Report'}</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center space-x-1.5 transition-colors shadow-xs hidden sm:flex"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800/80 flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* User Standing & Executive Report Card */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-sky-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                User: {currentUserId || 'Guest Defender'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{proficiency.title}</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              {proficiency.summary}
            </p>
          </div>

          <div className="flex items-center gap-4 self-start md:self-auto bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Hygiene Score
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400">
                {hygieneScore}<span className="text-xs text-slate-400 font-normal">/100</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Overall Accuracy
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {overallAccuracy}%
              </div>
            </div>
          </div>
        </div>

        {/* 4 Quick Stat Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3 bg-white/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lessons Completed</span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {progress.completedLessons.length} / {LESSONS_DATA.length}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {Math.round((progress.completedLessons.length / LESSONS_DATA.length) * 100)}% coverage
            </span>
          </div>

          <div className="p-3 bg-white/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Threats Spotting</span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {progress.solvedScenarios.length} / {PHISHING_SCENARIOS.length}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {Math.round((progress.solvedScenarios.length / PHISHING_SCENARIOS.length) * 100)}% analyzed
            </span>
          </div>

          <div className="p-3 bg-white/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessments Taken</span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {quizStats.totalAttempts} Tests
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {totalQuestionsAnswered} questions total
            </span>
          </div>

          <div className="p-3 bg-white/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quiz High Score</span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {quizStats.totalAttempts > 0 ? `${quizStats.bestScorePct}%` : '—'}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Avg: {quizStats.averageScorePct}%
            </span>
          </div>
        </div>
      </div>

      {/* ADAPTIVE RECOMMENDATIONS: Identified Weak Topics & Remediation Suggestions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Personalized Learning Recommendations & Weak Topics
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automatically adjusted based on your question accuracy and missed concept areas.
            </p>
          </div>

          <button
            onClick={() => onNavigate('quiz')}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center space-x-1"
          >
            <span>Launch Engine</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {weakTopics.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Compass className="w-6 h-6 text-sky-500 mx-auto" />
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
              No weak topics identified yet!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Take a diagnostic assessment to test your skills across web security, network protocols, SOC triage, and identity protection.
            </p>
            <button
              onClick={() => onNavigate('quiz')}
              className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
            >
              Start 10-Question Diagnostic Assessment
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {weakTopics.slice(0, 3).map((rec) => {
              const meta = ASSESSMENT_CATEGORIES.find(c => c.key === rec.topicKey);
              const isUrgent = rec.urgency === 'high';

              return (
                <div
                  key={rec.topicKey}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    isUrgent
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {getCategoryIcon(rec.topicKey)}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {meta?.label || rec.topicLabel}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isUrgent
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {rec.accuracy}% Accuracy ({rec.correctCount}/{rec.totalAnswered})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {rec.remediationAdvice}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    {rec.suggestedLessonId && (
                      <button
                        onClick={() => onNavigate('learning', rec.suggestedLessonId)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 transition-colors shadow-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                        <span>Study Lesson</span>
                      </button>
                    )}

                    <button
                      onClick={() => onNavigate('quiz')}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center space-x-1 shadow-xs transition-colors"
                    >
                      <span>Drill Domain</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DEDICATED REVISION / PRACTICE MODE BANNER */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Dedicated Practice & Revision Mode
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Isolated Practice
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
              Revisit questions you previously answered incorrectly to cement security instincts. Revision mode lets you practice without altering your no-repeat question bank state.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('quiz')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Launch Revision Drill</span>
        </button>
      </div>

      {/* COMPREHENSIVE TOPIC MASTERY GRID (11 CYBERSECURITY DOMAINS) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Cybersecurity Domain Topic Mastery (11 Domains)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time proficiency scoring based on verified standards-grounded assessments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {ASSESSMENT_CATEGORIES.map((cat) => {
            const mastery = masteryMap[cat.key];
            const hasAttempts = mastery.attempted > 0;

            return (
              <div
                key={cat.key}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                      {getCategoryIcon(cat.key)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={cat.label}>
                        {cat.label}
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                        {cat.subcategories.slice(0, 3).join(' • ')}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${mastery.badgeClass}`}>
                    {mastery.tierLabel}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {hasAttempts ? `${mastery.correct} / ${mastery.attempted} correct` : 'No questions taken'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {mastery.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        mastery.percentage >= 90
                          ? 'bg-violet-500'
                          : mastery.percentage >= 75
                          ? 'bg-emerald-500'
                          : mastery.percentage >= 50
                          ? 'bg-sky-500'
                          : hasAttempts
                          ? 'bg-amber-500'
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${mastery.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Direct Action links */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800/80 text-[11px]">
                  {mastery.lessonId ? (
                    <button
                      onClick={() => onNavigate('learning', mastery.lessonId)}
                      className="text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Study Lesson</span>
                    </button>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}

                  <button
                    onClick={() => onNavigate('quiz')}
                    className="text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 font-semibold flex items-center space-x-0.5"
                  >
                    <span>Practice Domain</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EARNED DEFENSE BADGES */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Earned Defense Badges ({progress.earnedBadges.length} of {ALL_BADGES.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Security milestones unlocked as you master technical topics, inspect telemetry, and defeat threats.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ALL_BADGES.map((badge) => {
            const isEarned = progress.earnedBadges.includes(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-3.5 rounded-xl border flex items-start space-x-3 transition-colors ${
                  isEarned
                    ? 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700'
                    : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 opacity-60'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  isEarned ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {isEarned ? <Award className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{badge.name}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {badge.tier}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{badge.description}</p>
                  <span className={`text-[10px] font-semibold block pt-0.5 ${isEarned ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {isEarned ? 'Unlocked ✓' : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSESSMENT HISTORY TABLE WITH FILTERING */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assessment History & Scored Log
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center space-x-1">
                <Database className="w-2.5 h-2.5 text-sky-500" />
                <span>Backend Truth: server-data/attempts.json</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Persistent cross-session records validated and scored by the Express backend.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter buttons */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  historyFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                All ({progress.quizAttempts.length})
              </button>
              <button
                onClick={() => setHistoryFilter('exam')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  historyFilter === 'exam'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Exams
              </button>
              <button
                onClick={() => setHistoryFilter('practice')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  historyFilter === 'practice'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Practice
              </button>
            </div>

            {onRefreshAttempts && (
              <button
                onClick={() => onRefreshAttempts()}
                disabled={isSyncing}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1"
                title="Refresh attempts from server-data/attempts.json"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('quiz')}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              Take Assessment
            </button>
          </div>
        </div>

        {/* Demo Account Context Banner */}
        <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-slate-400">Authenticated Demo User:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">{currentUserId}</span>
          </div>

          {onChangeUser && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-slate-500">Switch user for isolation test:</span>
              <select
                value={currentUserId}
                onChange={(e) => onChangeUser(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="destinyivienagbor2005@gmail.com">destinyivienagbor2005@gmail.com (Learner)</option>
                <option value="judge.security@codesprint.org">judge.security@codesprint.org (CodeSprint Judge)</option>
                <option value="alex.student@cyberaware.edu">alex.student@cyberaware.edu (Alex Student)</option>
              </select>
            </div>
          )}
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              No assessment attempts found for this filter.
            </p>
            <button
              onClick={() => onNavigate('quiz')}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              Start First Assessment
            </button>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Assessment Type / Track</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Accuracy</th>
                    <th className="p-3">Proficiency Rating</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {filteredAttempts.map((attempt) => {
                    const prof = getProficiencyLevel(attempt.percentage);
                    const hasMissed = attempt.score < attempt.total;

                    return (
                      <tr key={attempt.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                        <td className="p-3 font-medium whitespace-nowrap">{attempt.date}</td>
                        <td className="p-3">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="capitalize font-semibold text-slate-900 dark:text-white">
                              {attempt.mode === 'exam' ? 'Scored Examination' : 'Practice Drill'}
                            </span>
                            {attempt.verifiedByServer && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Scored and verified by backend engine">
                                Server Verified ✓
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            {attempt.difficulty && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">
                                Level: {attempt.difficulty}
                              </span>
                            )}
                            {attempt.completionDuration && (
                              <span className="text-[10px] text-slate-400">
                                • {attempt.completionDuration}s
                              </span>
                            )}
                          </div>
                          {attempt.categoryFilter && (
                            <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                              {attempt.categoryFilter}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono">{attempt.score} / {attempt.total}</td>
                        <td className="p-3 font-semibold font-mono">{attempt.percentage}%</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${prof.bgClass} ${prof.colorClass} ${prof.borderClass}`}>
                            {prof.badgeLabel}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {hasMissed ? (
                            <button
                              onClick={() => onNavigate('quiz')}
                              className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                              title="Revisit missed questions in Revision Mode"
                            >
                              Review Missed →
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-semibold">Perfect ✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-3.5 shadow-xl">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Learning Progress?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will clear completed lessons, quiz scores, and unlocked badges in your local browser storage.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setShowResetConfirm(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
