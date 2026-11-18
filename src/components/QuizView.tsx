import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Award, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  BookOpen,
  Filter,
  SlidersHorizontal,
  Clock,
  Flag,
  Terminal,
  Code,
  AlertTriangle,
  Layers,
  Sparkles,
  Shield,
  Compass,
  FileText,
  Check,
  Search,
  Network,
  Cpu,
  Globe,
  Crosshair,
  Activity,
  Bug,
  Cloud,
  Key,
  Database,
  Target
} from 'lucide-react';
import { QuizQuestion, QuizAttempt, QuestionDifficulty, QuestionType, AssessmentCategoryKey } from '../types';
import { 
  QUIZ_QUESTIONS, 
  STARTER_QUIZ_QUESTIONS, 
  ALL_ASSESSMENT_QUESTIONS, 
  ASSESSMENT_CATEGORIES,
  filterQuestions 
} from '../data/quizData';
import { 
  evaluateQuestionAnswer, 
  calculateAssessmentDomainBreakdown, 
  getProficiencyLevel,
  getOptionAnalysis,
  identifyWeakTopicsAndRecommendations
} from '../utils/scoring';
import { initQuestionDb, subscribeToQuestionBank } from '../services/questionDb';
import { QuestionBankModal } from './QuestionBankModal';
import { 
  CURRENT_DEFAULT_USER, 
  fetchUserHistory, 
  recordUserAssessmentProgress, 
  requestAssessmentSelection, 
  proposeAiQuestions 
} from '../services/assessmentApi';
import { UserAssessmentHistory, AssessmentSelectionResult } from '../utils/assessmentSelection';

interface QuizViewProps {
  onSaveAttempt: (attempt: QuizAttempt) => void;
  onGoToLearning: (lessonId?: string) => void;
  quizAttempts?: QuizAttempt[];
  initialMode?: 'assessment' | 'review';
  initialCategory?: string;
  initialReviewFilter?: 'all' | 'missed' | 'flagged';
  currentUserId?: string;
  onChangeUser?: (userId: string) => void;
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

const getDifficultyBadge = (difficulty: QuestionDifficulty) => {
  switch (difficulty) {
    case 'beginner':
      return {
        label: 'Beginner',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
      };
    case 'intermediate':
      return {
        label: 'Intermediate',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
      };
    case 'advanced':
      return {
        label: 'Advanced',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
      };
    case 'expert':
      return {
        label: 'Expert / Architect',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
      };
    default:
      return {
        label: difficulty,
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
      };
  }
};

const getTypeLabel = (type: QuestionType) => {
  switch (type) {
    case 'scenario': return 'Scenario Assessment';
    case 'select_all': return 'Select All That Apply';
    case 'log_analysis': return 'Log Telemetry Analysis';
    case 'code_review': return 'Secure Code Review';
    case 'troubleshooting': return 'Root Cause Troubleshooting';
    default: return 'Multiple Choice';
  }
};

export const QuizView: React.FC<QuizViewProps> = ({ 
  onSaveAttempt, 
  onGoToLearning,
  quizAttempts = [],
  initialMode,
  initialCategory,
  initialReviewFilter,
  currentUserId,
  onChangeUser
}) => {
  // Question Bank Database State
  const [databaseQuestions, setDatabaseQuestions] = useState<QuizQuestion[]>([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState<boolean>(false);

  // Initialize questions from IndexedDB / local storage
  React.useEffect(() => {
    initQuestionDb().then(qs => {
      setDatabaseQuestions(qs);
    });
    const unsubscribe = subscribeToQuestionBank(updated => {
      setDatabaseQuestions(updated);
    });
    return () => unsubscribe();
  }, []);

  // User Identity & Cross-Session Assessment History State
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(currentUserId || '');
  const [userHistory, setUserHistory] = useState<UserAssessmentHistory>({
    userId: currentUserId || '',
    seenQuestionIds: [],
    answeredQuestionIds: [],
    answeredResults: {},
    flaggedQuestionIds: []
  });

  const startTimeRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (currentUserId && currentUserId !== currentUserEmail) {
      setCurrentUserEmail(currentUserId);
    }
  }, [currentUserId]);

  // Assessment Configuration State
  const [inSetupMode, setInSetupMode] = useState<boolean>(false);
  const [engineMode, setEngineMode] = useState<'assessment' | 'review'>(initialMode || 'assessment');
  const [reviewScope, setReviewScope] = useState<'all' | 'missed' | 'flagged'>(initialReviewFilter || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [questionCountLimit, setQuestionCountLimit] = useState<number>(10);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [isAiReplenishing, setIsAiReplenishing] = useState<boolean>(false);

  // Adaptive recommendations based on previous assessment attempts and answers
  const weakTopicRecommendations = useMemo(() => {
    return identifyWeakTopicsAndRecommendations(quizAttempts, userHistory);
  }, [quizAttempts, userHistory]);

  // Initialize questions and user history from server / local storage
  React.useEffect(() => {
    initQuestionDb().then(qs => {
      setDatabaseQuestions(qs);
    });
    const unsubscribe = subscribeToQuestionBank(updated => {
      setDatabaseQuestions(updated);
    });
    fetchUserHistory(currentUserEmail).then(hist => {
      setUserHistory(hist);
    });
    return () => unsubscribe();
  }, [currentUserEmail]);

  const allAvailableQuestions = useMemo(() => {
    return databaseQuestions.length > 0 ? databaseQuestions : QUIZ_QUESTIONS;
  }, [databaseQuestions]);

  // Real-time calculation of unseen questions for active user
  const seenIdsSet = useMemo(() => new Set(userHistory.seenQuestionIds || []), [userHistory]);
  const answeredIdsSet = useMemo(() => new Set(userHistory.answeredQuestionIds || []), [userHistory]);

  // Filtered preview during setup using active database
  const filteredQuestionPool = useMemo(() => {
    return allAvailableQuestions.filter(q => {
      if (q.reviewStatus === 'draft') return false;
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
      if (selectedType !== 'all' && q.type !== selectedType) return false;
      if (searchFilter.trim() !== '') {
        const query = searchFilter.toLowerCase();
        const text = `${q.question} ${q.topic} ${q.subcategory} ${q.subtopic || ''} ${q.provenance || ''} ${q.explanation || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [allAvailableQuestions, selectedCategory, selectedDifficulty, selectedType, searchFilter]);

  const unseenInFilteredPool = useMemo(() => {
    return filteredQuestionPool.filter(q => !seenIdsSet.has(q.id)).length;
  }, [filteredQuestionPool, seenIdsSet]);

  const reviewEligibleInPool = useMemo(() => {
    return filteredQuestionPool.filter(q => {
      if (!seenIdsSet.has(q.id) && !answeredIdsSet.has(q.id)) return false;
      if (reviewScope === 'missed') {
        const res = userHistory.answeredResults?.[q.id];
        return res && !res.isCorrect;
      }
      if (reviewScope === 'flagged') {
        return userHistory.flaggedQuestionIds?.includes(q.id);
      }
      return true;
    }).length;
  }, [filteredQuestionPool, seenIdsSet, answeredIdsSet, reviewScope, userHistory]);

  // Assessment Execution State
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>(() => QUIZ_QUESTIONS.slice(0, 10));
  const [assessmentTitle, setAssessmentTitle] = useState<string>('Comprehensive Diagnostic Assessment');
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [navigatorOpen, setNavigatorOpen] = useState<boolean>(false);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  const currentQ: QuizQuestion | undefined = activeQuestions[currentIndex];
  const totalQuestions = activeQuestions.length;
  const currentSelections = userAnswers[currentIndex] || [];
  const isAnswered = currentSelections.length > 0;
  const isMultiSelect = currentQ?.type === 'select_all';

  // Toggle selection for current question
  const handleToggleOption = (oIdx: number) => {
    if (mode === 'practice' && showAnswerFeedback) {
      return; // locked after checking in practice mode
    }

    setUserAnswers(prev => {
      const current = prev[currentIndex] || [];
      if (isMultiSelect) {
        if (current.includes(oIdx)) {
          return { ...prev, [currentIndex]: current.filter(i => i !== oIdx) };
        } else {
          return { ...prev, [currentIndex]: [...current, oIdx] };
        }
      } else {
        return { ...prev, [currentIndex]: [oIdx] };
      }
    });
  };

  const handleToggleFlag = (index: number) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCheckAnswer = () => {
    if (!isAnswered) return;
    setShowAnswerFeedback(true);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswerFeedback(false);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowAnswerFeedback(false);
    }
  };

  const handleJumpToQuestion = (idx: number) => {
    setCurrentIndex(idx);
    setShowAnswerFeedback(false);
    setNavigatorOpen(false);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // Quick AI Pool Replenishment
  const handleQuickAiReplenish = async (cat?: string) => {
    setIsAiReplenishing(true);
    try {
      const targetCat = cat || (selectedCategory !== 'all' ? selectedCategory : 'network_security');
      const targetDiff = (selectedDifficulty !== 'all' ? selectedDifficulty : 'intermediate') as QuestionDifficulty;
      const res = await proposeAiQuestions({ category: targetCat, difficulty: targetDiff, count: 2 });
      if (res.success && res.proposedCount > 0) {
        setPoolNotice(`Proposed ${res.proposedCount} new question(s) grounded in NIST/OWASP. They are stored in Pending Review until approved.`);
      } else if (res.duplicateRejections.length > 0) {
        setPoolNotice(`Candidate question was rejected as a duplicate of an existing question.`);
      } else {
        setPoolNotice(`AI replenishment note: ${res.error || 'Unable to generate questions at this time.'}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiReplenishing(false);
    }
  };

  // Launch a curated track with server selection
  const startCuratedTrack = async (trackType: 'diagnostic' | 'expert_exam' | 'appsec_cloud' | 'soc_threats' | 'foundations') => {
    let title = 'Cybersecurity Assessment';
    let targetCat = 'all';
    let targetDiff: QuestionDifficulty | 'all' = 'all';

    switch (trackType) {
      case 'diagnostic':
        title = 'Quick Diagnostic (10 Questions across All Domains)';
        break;
      case 'expert_exam':
        title = 'Advanced & Expert Security Examination';
        targetDiff = 'advanced';
        break;
      case 'appsec_cloud':
        title = 'Web AppSec, API Security & Cloud DevSecOps';
        targetCat = 'web_appsec';
        break;
      case 'soc_threats':
        title = 'SOC Operations, Malware Defense & Incident Triage';
        targetCat = 'soc_incident_response';
        break;
      case 'foundations':
        title = 'Everyday Security & Threat Awareness (Beginner Track)';
        targetDiff = 'beginner';
        break;
    }

    const selection = await requestAssessmentSelection({
      userId: currentUserEmail,
      category: targetCat,
      difficulty: targetDiff,
      count: 10,
      mode: engineMode,
      reviewFilter: reviewScope
    });

    if (selection.poolExhausted) {
      setPoolNotice(selection.exhaustionNotice || 'No unseen questions remaining for this track.');
    } else {
      setPoolNotice(null);
    }

    let finalQuestions = selection.questions;
    if (finalQuestions.length === 0) {
      // If pool was exhausted in assessment mode, alert user
      if (engineMode === 'assessment') {
        setPoolNotice(selection.exhaustionNotice || 'All questions in this track have been seen. Switch to Review Mode or replenish with AI.');
        return;
      }
      finalQuestions = allAvailableQuestions.slice(0, 10);
    }

    setActiveQuestions(finalQuestions);
    setAssessmentTitle(title);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setShowAnswerFeedback(false);
    setIsFinished(false);
    setHasSaved(false);
    setInSetupMode(false);
  };

  // Launch custom filter with server-side selection & no-repeat check
  const startCustomAssessment = async (overrideCategory?: string) => {
    const targetCat = overrideCategory || selectedCategory;
    if (overrideCategory) {
      setSelectedCategory(overrideCategory);
    }

    const selection = await requestAssessmentSelection({
      userId: currentUserEmail,
      category: targetCat,
      difficulty: selectedDifficulty as QuestionDifficulty,
      type: selectedType as QuestionType,
      count: questionCountLimit,
      mode: engineMode,
      reviewFilter: reviewScope,
      searchQuery: searchFilter
    });

    let title = 'Custom Cybersecurity Assessment';
    if (targetCat !== 'all') {
      const cat = ASSESSMENT_CATEGORIES.find(c => c.key === targetCat);
      title = `${cat ? cat.shortLabel : targetCat} Deep-Dive`;
    } else if (selectedDifficulty !== 'all') {
      title = `${selectedDifficulty.toUpperCase()} Security Assessment`;
    }
    if (engineMode === 'review') {
      title += ' (Revision Mode)';
    }

    if (selection.poolExhausted) {
      setPoolNotice(selection.exhaustionNotice || null);
    } else {
      setPoolNotice(null);
    }

    if (selection.questions.length === 0) {
      // User has exhausted this specific pool
      setPoolNotice(
        selection.exhaustionNotice || 
        'No unseen questions remain in this criteria pool. We never secretly repeat questions in assessment mode. You can switch to Review Mode or use AI Question Replenishment.'
      );
      return;
    }

    setActiveQuestions(selection.questions);
    setAssessmentTitle(title);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setShowAnswerFeedback(false);
    setIsFinished(false);
    setHasSaved(false);
    setInSetupMode(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions(new Set());
    setShowAnswerFeedback(false);
    setIsFinished(false);
    setHasSaved(false);
  };

  // Evaluation calculations
  let correctCount = 0;
  activeQuestions.forEach((q, idx) => {
    const selected = userAnswers[idx] || [];
    const evalRes = evaluateQuestionAnswer(q, selected);
    if (evalRes.isCorrect) correctCount++;
  });

  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const proficiency = getProficiencyLevel(percentage);
  const domainBreakdown = calculateAssessmentDomainBreakdown(activeQuestions, userAnswers);

  const handleSaveResult = () => {
    const topicBreakdownRecord: Record<string, { correct: number; total: number }> = {};
    Object.keys(domainBreakdown).forEach(k => {
      topicBreakdownRecord[k] = {
        correct: domainBreakdown[k].correct,
        total: domainBreakdown[k].total
      };
    });

    const elapsedSeconds = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));

    const questionsAttempted = activeQuestions.map(q => q.id);
    const questionAnswers = activeQuestions.map((q, idx) => ({
      questionId: q.id,
      selectedOptions: userAnswers[idx] || []
    }));

    const attempt: QuizAttempt = {
      id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUserEmail,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      timestamp: new Date().toISOString(),
      score: correctCount,
      total: totalQuestions,
      percentage,
      mode,
      difficulty: selectedDifficulty !== 'all' ? (selectedDifficulty as QuestionDifficulty) : 'mixed',
      categoryFilter: selectedCategory,
      completionDuration: elapsedSeconds,
      topicBreakdown: topicBreakdownRecord,
      userAnswers,
      questionsAttempted,
      questionAnswers,
      verifiedByServer: false
    };
    onSaveAttempt(attempt);

    // Persist question presentation & answer history across devices and sessions
    const answeredUpdates: Record<string, { isCorrect: boolean; selectedOptions: number[]; timestamp: string }> = {};
    activeQuestions.forEach((q, idx) => {
      const selected = userAnswers[idx] || [];
      if (selected.length > 0) {
        const evalRes = evaluateQuestionAnswer(q, selected);
        answeredUpdates[q.id] = {
          isCorrect: evalRes.isCorrect,
          selectedOptions: selected,
          timestamp: new Date().toISOString()
        };
      }
    });
    const presentedIds = activeQuestions.map(q => q.id);
    const flaggedIds = Array.from(flaggedQuestions).map(idx => activeQuestions[idx]?.id).filter(Boolean);

    recordUserAssessmentProgress(currentUserEmail, presentedIds, answeredUpdates, flaggedIds).then(updated => {
      setUserHistory(updated);
    });

    setHasSaved(true);
  };

  // =========================================================================
  // VIEW: SETUP / CUSTOM ASSESSMENT BUILDER
  // =========================================================================
  if (inSetupMode) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
              <SlidersHorizontal className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>Assessment Engine Builder</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure tailored assessments across 11 professional security domains, 4 difficulty tiers, and realistic scenarios.
            </p>
          </div>
          <button
            onClick={() => setInSetupMode(false)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
          >
            Cancel
          </button>
        </div>

        {/* Authenticated User Identity & Cross-Session Pool Indicator */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs border border-sky-200 dark:border-sky-800">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                {onChangeUser ? (
                  <select
                    value={currentUserEmail}
                    onChange={(e) => {
                      setCurrentUserEmail(e.target.value);
                      onChangeUser(e.target.value);
                    }}
                    className="text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
                  >
                    <option value="destinyivienagbor2005@gmail.com">destinyivienagbor2005@gmail.com</option>
                    <option value="judge.security@codesprint.org">judge.security@codesprint.org</option>
                    <option value="alex.student@cyberaware.edu">alex.student@cyberaware.edu</option>
                  </select>
                ) : (
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[240px] sm:max-w-none">
                    {currentUserEmail}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Cross-Session Sync Active
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                <span><strong>{seenIdsSet.size}</strong> Seen</span>
                <span>•</span>
                <span><strong>{answeredIdsSet.size}</strong> Answered</span>
                <span>•</span>
                <span><strong>{userHistory.flaggedQuestionIds?.length || 0}</strong> Flagged</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Mode:</span>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEngineMode('assessment')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                  engineMode === 'assessment'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                No-Repeat Assessment
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('review')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                  engineMode === 'review'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Review & Revision
              </button>
            </div>
          </div>
        </div>

        {/* Global Pool Notice / Exhaustion Alert */}
        {poolNotice && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Assessment Pool Status:</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">{poolNotice}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleQuickAiReplenish()}
                disabled={isAiReplenishing}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAiReplenishing ? 'Synthesizing...' : 'Replenish via AI'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPoolNotice(null)}
                className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Mode Guidance Card */}
        {engineMode === 'review' ? (
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Revision Mode Active (Isolated from No-Repeat Pool)
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                {reviewEligibleInPool} Eligible for Review
              </span>
            </div>
            <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
              In Review Mode, questions you have encountered in previous assessments are reintroduced for deliberate practice and reinforcement. Review attempts do not consume new questions from your scored assessment pool.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-indigo-900 dark:text-indigo-200">Revision Focus:</span>
              <select
                value={reviewScope}
                onChange={(e) => setReviewScope(e.target.value as any)}
                className="p-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-100 text-xs font-semibold"
              >
                <option value="all">All Previously Seen Questions</option>
                <option value="missed">Previously Missed / Incorrect Only</option>
                <option value="flagged">Flagged Questions Only</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200">
              <Shield className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>
                <strong>Strict No-Repeat Guarantee:</strong> Previously seen question IDs are excluded across sessions.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 font-bold text-xs">
                {unseenInFilteredPool} Unseen in Active Pool
              </span>
              {unseenInFilteredPool < 3 && (
                <button
                  type="button"
                  onClick={() => handleQuickAiReplenish()}
                  disabled={isAiReplenishing}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pool Low: Add via AI</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Expandable Question Bank Database Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent border border-sky-200 dark:border-sky-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Expandable Question Bank Database
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  {allAvailableQuestions.length} Questions Stored
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect 12-field schema records, generate new questions with automated validation, or import custom JSON benchmarks.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsBankModalOpen(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5 flex-shrink-0"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Manage Question Bank</span>
          </button>
        </div>

        {/* Adaptive Weak Topics Remediation (Adjusted based on previous performance) */}
        {weakTopicRecommendations.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-transparent border border-amber-300/80 dark:border-amber-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400">
                <Target className="w-4 h-4" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Recommended For You Based on Previous Performance
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Targeted Remediation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {weakTopicRecommendations.slice(0, 2).map((rec) => (
                <div key={rec.topicKey} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{rec.topicLabel}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {rec.accuracy}% Accuracy ({rec.correctCount}/{rec.totalAnswered})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {rec.remediationAdvice}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {rec.suggestedLessonId && (
                      <button
                        type="button"
                        onClick={() => onGoToLearning(rec.suggestedLessonId)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center space-x-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Study Lesson: {rec.suggestedLessonTitle?.split('&')[0]}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startCustomAssessment(rec.topicKey)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center space-x-1"
                    >
                      <span>Drill Weak Topic</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Launch Pre-set Tracks */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Recommended Assessment Tracks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => startCuratedTrack('diagnostic')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 text-left transition-all group"
            >
              <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 mb-2">
                <Compass className="w-4 h-4" />
                <span className="text-xs font-bold">10-Question Diagnostic</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                Broad Security Baseline
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Balanced cross-domain diagnostic assessing basic through advanced instincts.
              </p>
            </button>

            <button
              onClick={() => startCuratedTrack('expert_exam')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 text-left transition-all group"
            >
              <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold">Practitioner / Expert Exam</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Advanced Threat Defense
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Log correlation, EDR bypass mechanics, Kerberos attacks, and zero-day forensics.
              </p>
            </button>

            <button
              onClick={() => startCuratedTrack('appsec_cloud')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all group"
            >
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-bold">DevSecOps & AppSec Track</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                Cloud, Code & OWASP
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                SQLi, SSRF, JWT vulnerabilities, Dockerfile hardening, and CI/CD supply chain defense.
              </p>
            </button>
          </div>
        </div>

        {/* Custom Filter Controls Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Filter className="w-4 h-4 text-sky-500" />
              <span>Custom Assessment Filters</span>
            </h2>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-950 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
              {filteredQuestionPool.length} Questions Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Domain Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All 11 Domains ({ALL_ASSESSMENT_QUESTIONS.length + STARTER_QUIZ_QUESTIONS.length})</option>
                {ASSESSMENT_CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.shortLabel}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Difficulty Tier</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Difficulty Levels</option>
                <option value="beginner">Beginner (Foundations)</option>
                <option value="intermediate">Intermediate (Practitioner)</option>
                <option value="advanced">Advanced (Analyst)</option>
                <option value="expert">Expert (Architect)</option>
              </select>
            </div>

            {/* Question Format */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Exercise Format</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Formats</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="select_all">Select All That Apply</option>
                <option value="scenario">Scenario Assessments</option>
                <option value="log_analysis">Log Telemetry Analysis</option>
                <option value="code_review">Code Review Exercises</option>
                <option value="troubleshooting">Troubleshooting Exercises</option>
              </select>
            </div>

            {/* Question Count Limit */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Questions in Test</label>
              <select
                value={questionCountLimit}
                onChange={(e) => setQuestionCountLimit(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
              >
                <option value={5}>5 Questions (Quick Check)</option>
                <option value={10}>10 Questions (Standard)</option>
                <option value={15}>15 Questions (Thorough)</option>
                <option value={20}>20 Questions (Comprehensive)</option>
                <option value={50}>All Matching in Pool</option>
              </select>
            </div>
          </div>

          {/* Search Query Filter */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Keyword Search (e.g. Kerberos, Docker, XSS, Ransomware, NIST)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search topics, logs, frameworks..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Launch Custom Test Button */}
          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={() => startCustomAssessment()}
              disabled={filteredQuestionPool.length === 0}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shadow-xs ${
                filteredQuestionPool.length > 0
                  ? 'bg-sky-600 hover:bg-sky-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Launch Assessment ({Math.min(questionCountLimit, filteredQuestionPool.length)} Questions)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Bank Modal */}
        <QuestionBankModal
          isOpen={isBankModalOpen}
          onClose={() => setIsBankModalOpen(false)}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW: RESULTS & COMPREHENSIVE POST-ASSESSMENT ANALYTICS
  // =========================================================================
  if (isFinished) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
        {/* Results Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-200 dark:border-sky-800 shadow-xs">
            <Award className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Assessment Completed
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {assessmentTitle}
            </p>
          </div>

          {/* Proficiency Tier Badge */}
          <div className="py-2">
            <div className={`inline-flex flex-col items-center px-4 py-2.5 rounded-2xl border ${proficiency.bgClass} ${proficiency.borderClass}`}>
              <span className={`text-xs uppercase font-extrabold tracking-wider ${proficiency.colorClass}`}>
                {proficiency.badgeLabel}
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {proficiency.title}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-sm text-center">
                {proficiency.summary}
              </span>
            </div>
          </div>

          {/* Numerical Score */}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Final Accuracy: <strong className="text-slate-900 dark:text-white text-base">{percentage}%</strong> ({correctCount} of {totalQuestions} answered accurately)
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {!hasSaved ? (
              <button
                onClick={handleSaveResult}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to My Progress</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-1 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved to Record</span>
              </span>
            )}

            <button
              onClick={handleRestart}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Test</span>
            </button>

            <button
              onClick={() => setInSetupMode(true)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Choose Another Domain</span>
            </button>

            <button
              onClick={() => onGoToLearning()}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Study Lessons</span>
            </button>
          </div>
        </div>

        {/* Domain Proficiency Breakdown Cards */}
        {Object.keys(domainBreakdown).length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-sky-500" />
              <span>Domain Proficiency Breakdown</span>
            </h2>

            <div className="space-y-3">
              {Object.keys(domainBreakdown).map(domainKey => {
                const item = domainBreakdown[domainKey];
                const meta = ASSESSMENT_CATEGORIES.find(c => c.key === domainKey);
                const displayLabel = meta ? meta.label : item.topic;

                return (
                  <div key={domainKey} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(domainKey)}
                        <span className="font-bold text-slate-900 dark:text-white">{displayLabel}</span>
                      </div>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {item.correct} / {item.total} ({item.percentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.percentage >= 80 ? 'bg-emerald-500' : item.percentage >= 60 ? 'bg-sky-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Question Review with Filter */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Question-by-Question Review & Explanations
            </h2>

            {/* Filter buttons */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-2.5 py-1 rounded font-medium ${
                  reviewFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                All ({totalQuestions})
              </button>
              <button
                onClick={() => setReviewFilter('incorrect')}
                className={`px-2.5 py-1 rounded font-medium ${
                  reviewFilter === 'incorrect'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Missed ({totalQuestions - correctCount})
              </button>
              <button
                onClick={() => setReviewFilter('flagged')}
                className={`px-2.5 py-1 rounded font-medium ${
                  reviewFilter === 'flagged'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Flagged ({flaggedQuestions.size})
              </button>
            </div>
          </div>

          {/* List of reviewed questions */}
          <div className="space-y-4">
            {activeQuestions.map((q, idx) => {
              const selected = userAnswers[idx] || [];
              const evalRes = evaluateQuestionAnswer(q, selected);
              const isFlagged = flaggedQuestions.has(idx);

              if (reviewFilter === 'incorrect' && evalRes.isCorrect) return null;
              if (reviewFilter === 'flagged' && !isFlagged) return null;

              const expected = q.correctAnswers && q.correctAnswers.length > 0 ? q.correctAnswers : [q.correctAnswer];
              const diffBadge = getDifficultyBadge(q.difficulty);

              return (
                <div key={q.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-500 dark:text-slate-400">Question {idx + 1}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${diffBadge.badgeClass}`}>
                        {diffBadge.label}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600 dark:text-slate-400 font-medium">{q.subcategory}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isFlagged && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center space-x-0.5">
                          <Flag className="w-3 h-3" />
                          <span>Flagged</span>
                        </span>
                      )}
                      <span className={`font-semibold flex items-center space-x-1 ${
                        evalRes.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {evalRes.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{evalRes.isCorrect ? 'Accurate' : 'Needs Review'}</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                    {q.question}
                  </p>

                  {/* Scenario context if available */}
                  {q.scenarioText && (
                    <div className="p-2.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-slate-700 dark:text-slate-300 italic">
                      {q.scenarioText}
                    </div>
                  )}

                  {/* User answer vs expected */}
                  <div className="text-xs space-y-1">
                    <p className="text-slate-600 dark:text-slate-400">
                      <strong>Your answer: </strong>
                      <span className={evalRes.isCorrect ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-rose-700 dark:text-rose-300 font-medium'}>
                        {selected.length > 0 
                          ? selected.map(i => q.options[i]).join('; ') 
                          : 'Unanswered'}
                      </span>
                    </p>

                    {!evalRes.isCorrect && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Expected: </strong>
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                          {expected.map(i => q.options[i]).join('; ')}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Explanation card */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 leading-relaxed">
                    <p><strong>Technical Analysis: </strong>{q.explanation}</p>
                    {q.referenceFramework && (
                      <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                        <strong>Reference Framework: </strong>{q.referenceFramework}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Detailed Option Analysis (Why choices are right or wrong):
                      </span>
                      <div className="space-y-1.5">
                        {q.options.map((optText, oIdx) => {
                          const analysis = getOptionAnalysis(q, oIdx, selected);
                          return (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg border text-xs space-y-0.5 ${
                                analysis.isCorrect
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                                  : selected.includes(oIdx)
                                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span>{optText}</span>
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${analysis.badgeClass}`}>
                                  {analysis.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-5.5 leading-snug">
                                <strong>Rationale: </strong>{analysis.rationale}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE QUESTION RUNNER
  // =========================================================================
  if (!currentQ) {
    return (
      <div className="p-8 text-center text-slate-500">
        No question found in active set.
        <button onClick={() => setInSetupMode(true)} className="ml-2 text-sky-600 underline">
          Reconfigure Assessment
        </button>
      </div>
    );
  }

  const diffBadge = getDifficultyBadge(currentQ.difficulty);
  const typeLabel = getTypeLabel(currentQ.type);
  const isCurrentFlagged = flaggedQuestions.has(currentIndex);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fadeIn pb-12">
      {/* Assessment Engine Header & Control Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cybersecurity Assessment Engine
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {assessmentTitle}
          </p>
        </div>

        {/* Actions: Configure Engine & Mode Switcher */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsBankModalOpen(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center space-x-1"
            title="Inspect, generate, or manage questions in the database"
          >
            <Database className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Question Bank ({allAvailableQuestions.length})</span>
            <span className="sm:hidden">Bank</span>
          </button>

          <button
            onClick={() => setInSetupMode(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center space-x-1"
            title="Configure questions, domains, or difficulty"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Engine Settings</span>
            <span className="sm:hidden">Settings</span>
          </button>

          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setMode('practice')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                mode === 'practice'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Practice
            </button>
            <button
              onClick={() => setMode('exam')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                mode === 'exam'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Exam
            </button>
          </div>
        </div>
      </div>

      {/* Progress & Question Navigation Drawer Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-slate-400">•</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${diffBadge.badgeClass}`}>
              {diffBadge.label}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
              engineMode === 'assessment' 
                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800' 
                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
            }`}>
              {engineMode === 'assessment' ? 'No-Repeat Delivery' : 'Revision Mode'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              {currentQ.subcategory}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Flag for review toggle */}
            <button
              onClick={() => handleToggleFlag(currentIndex)}
              className={`flex items-center space-x-1 text-xs font-medium px-2 py-0.5 rounded-lg transition-colors ${
                isCurrentFlagged
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Flag this question to review later"
            >
              <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-500' : ''}`} />
              <span className="hidden sm:inline">{isCurrentFlagged ? 'Flagged' : 'Flag'}</span>
            </button>

            {/* Jump navigator button */}
            <button
              onClick={() => setNavigatorOpen(!navigatorOpen)}
              className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline"
            >
              {navigatorOpen ? 'Hide Grid' : 'Question Grid'}
            </button>
          </div>
        </div>

        {/* Continuous progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-sky-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Question Grid Navigator Dropdown */}
        {navigatorOpen && (
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 animate-fadeIn shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Direct Jump to Question:
            </span>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {activeQuestions.map((q, idx) => {
                const ans = userAnswers[idx];
                const hasAnswer = ans && ans.length > 0;
                const isCurrent = idx === currentIndex;
                const isFlagged = flaggedQuestions.has(idx);

                let btnClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                if (hasAnswer) {
                  btnClass = 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold';
                }
                if (isCurrent) {
                  btnClass = 'ring-2 ring-sky-500 bg-sky-600 text-white font-bold border-transparent';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-8 rounded-lg text-xs border flex items-center justify-center relative transition-all ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Primary Question Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs">
        {/* Category, Subtopic, Provenance & Review Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
              {getCategoryIcon(currentQ.category)}
              <span>{currentQ.topic || currentQ.category}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {currentQ.subtopic || currentQ.subcategory}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {typeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800" title="Standards Provenance">
              {currentQ.provenance || currentQ.referenceFramework || 'NIST SP 800-53'}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 capitalize">
              {currentQ.reviewStatus || 'verified'}
            </span>
          </div>
        </div>

        {/* Question Prompt */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {currentQ.question}
        </h2>

        {/* SCENARIO BOX (If scenario assessment) */}
        {currentQ.scenarioText && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-1.5 border-l-4 border-l-sky-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
              Incident Context / Operational Scenario
            </span>
            <p className="leading-relaxed">{currentQ.scenarioText}</p>
          </div>
        )}

        {/* LOG SNIPPET (If log analysis) */}
        {currentQ.logSnippet && (
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800">
              <span className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentQ.logSnippet.source}</span>
              </span>
              <button
                onClick={() => handleCopySnippet(currentQ.logSnippet!.log)}
                className="text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                {copiedLog ? 'Copied!' : 'Copy Log'}
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto text-[11px] sm:text-xs leading-relaxed text-emerald-400 font-mono">
              {currentQ.logSnippet.log}
            </pre>
          </div>
        )}

        {/* CODE SNIPPET (If code review) */}
        {currentQ.codeSnippet && (
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800">
              <span className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <Code className="w-3.5 h-3.5 text-sky-400" />
                <span>Language: {currentQ.codeSnippet.language}</span>
              </span>
              <button
                onClick={() => handleCopySnippet(currentQ.codeSnippet!.code)}
                className="text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                {copiedLog ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto text-[11px] sm:text-xs leading-relaxed text-sky-300 font-mono">
              {currentQ.codeSnippet.code}
            </pre>
          </div>
        )}

        {/* Instructions for Select All */}
        {isMultiSelect && (
          <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 p-2 rounded-lg border border-sky-200 dark:border-sky-900 flex items-center space-x-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select all options that apply (multiple answers are correct).</span>
          </div>
        )}

        {/* Answer Options List */}
        <div className="space-y-2.5">
          {currentQ.options.map((option, oIdx) => {
            const isSelected = currentSelections.includes(oIdx);
            const isAnswerChecked = mode === 'practice' && showAnswerFeedback;
            const expectedAnswers = currentQ.correctAnswers && currentQ.correctAnswers.length > 0 
              ? currentQ.correctAnswers 
              : [currentQ.correctAnswer];
            const isCorrectOption = expectedAnswers.includes(oIdx);

            let optionStyle = 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700';

            if (isSelected) {
              optionStyle = 'bg-sky-50 dark:bg-sky-500/10 border-sky-500 text-slate-900 dark:text-white ring-1 ring-sky-500/40';
            }

            if (isAnswerChecked) {
              if (isCorrectOption) {
                optionStyle = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/50';
              } else if (isSelected) {
                optionStyle = 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-950 dark:text-rose-200 ring-1 ring-rose-500/50';
              }
            }

            return (
              <button
                key={oIdx}
                type="button"
                onClick={() => handleToggleOption(oIdx)}
                className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start space-x-3 ${optionStyle}`}
              >
                {/* Prefix selector (checkbox style if multi-select, radio/letter if single) */}
                <span className={`w-5 h-5 rounded ${isMultiSelect ? 'rounded-md' : 'rounded-full'} text-xs font-bold flex items-center justify-center shrink-0 border mt-0.5 ${
                  isAnswerChecked && isCorrectOption
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : isAnswerChecked && isSelected
                    ? 'bg-rose-600 text-white border-rose-500'
                    : isSelected
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                }`}>
                  {isMultiSelect ? (
                    isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null
                  ) : (
                    String.fromCharCode(65 + oIdx)
                  )}
                </span>
                <span className="flex-1 leading-relaxed">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Immediate Feedback in Practice Mode */}
        {mode === 'practice' && showAnswerFeedback && (
          <div className="space-y-3 pt-2">
            {(() => {
              const evalRes = evaluateQuestionAnswer(currentQ, currentSelections);
              return (
                <div className={`p-4 rounded-xl border space-y-2 animate-fadeIn text-xs ${
                  evalRes.isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                }`}>
                  <div className="flex items-center space-x-2 font-bold text-xs sm:text-sm">
                    {evalRes.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Correct Analysis! Solid defensive judgment.</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Review Required. Here is the operational analysis:</span>
                      </>
                    )}
                  </div>

                  <p className="leading-relaxed">
                    <strong>Technical Breakdown: </strong>{currentQ.explanation}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
                    <div>
                      <strong>Security Standard / Provenance: </strong>
                      <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">{currentQ.provenance || currentQ.referenceFramework || 'NIST SP 800-53'}</span>
                    </div>
                    <div>
                      <strong>Subtopic: </strong>
                      <span className="text-slate-700 dark:text-slate-300">{currentQ.subtopic || currentQ.subcategory}</span>
                    </div>
                    <div>
                      <strong>Verification Status: </strong>
                      <span className="capitalize text-emerald-600 dark:text-emerald-400 font-semibold">{currentQ.reviewStatus || 'verified'}</span>
                    </div>
                    <div>
                      <strong>Last Verified: </strong>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{new Date(currentQ.lastVerifiedDate || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {currentQ.tips && (
                    <p className="text-slate-600 dark:text-slate-300 pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
                      <strong>Defensive Mitigation: </strong>{currentQ.tips}
                    </p>
                  )}

                  {/* Detailed Option-by-Option Breakdown (Correct & Incorrect Analysis) */}
                  <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      Detailed Option Analysis (Why choices are right or wrong):
                    </span>
                    <div className="space-y-1.5">
                      {currentQ.options.map((optText, oIdx) => {
                        const analysis = getOptionAnalysis(currentQ, oIdx, currentSelections);
                        return (
                          <div
                            key={oIdx}
                            className={`p-2.5 rounded-lg border text-xs space-y-0.5 ${
                              analysis.isCorrect
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                                : currentSelections.includes(oIdx)
                                ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span>{optText}</span>
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${analysis.badgeClass}`}>
                                {analysis.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 pl-5.5 leading-relaxed">
                              <strong>Analysis: </strong>{analysis.rationale}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Navigation & Submission Controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border transition-all ${
                currentIndex > 0
                  ? 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="text-xs text-slate-400 hidden sm:inline">
              {isAnswered ? `${currentSelections.length} selected` : 'Select option'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {mode === 'practice' && !showAnswerFeedback ? (
              <button
                type="button"
                disabled={!isAnswered}
                onClick={handleCheckAnswer}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isAnswered
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                Check Answer
              </button>
            ) : (
              <button
                type="button"
                disabled={!isAnswered && mode === 'practice'}
                onClick={handleNext}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  isAnswered || mode === 'exam'
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>{currentIndex === totalQuestions - 1 ? 'Finish Assessment' : 'Next Question'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Question Bank Database Modal */}
      <QuestionBankModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
      />
    </div>
  );
};
