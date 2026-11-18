import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  PlusCircle, 
  Sparkles, 
  Download, 
  Upload, 
  RotateCcw, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  FileCode, 
  BookOpen, 
  X, 
  ChevronRight,
  ExternalLink,
  Tag,
  Calendar,
  Layers,
  HelpCircle,
  Eye,
  Check
} from 'lucide-react';
import { 
  QuizQuestion, 
  QuestionBankStats, 
  QuestionDifficulty, 
  QuestionType, 
  ReviewStatus,
  AssessmentCategoryKey
} from '../types';
import { ASSESSMENT_CATEGORIES } from '../data/assessmentData';
import { 
  getAllQuestions, 
  saveQuestion, 
  deleteQuestion, 
  resetToDefaultSeed, 
  getQuestionBankStats, 
  subscribeToQuestionBank, 
  exportQuestionBankJson, 
  importQuestionsFromJson 
} from '../services/questionDb';
import { generateAndStoreQuestions } from '../services/questionGenerator';
import { validateQuestion } from '../utils/questionValidation';
import { proposeAiQuestions, reviewQuestionAction } from '../services/assessmentApi';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestionForAssessment?: (question: QuizQuestion) => void;
}

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  onSelectQuestionForAssessment
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'generate' | 'review_queue' | 'create' | 'io'>('browse');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [stats, setStats] = useState<QuestionBankStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedQuestionDetail, setSelectedQuestionDetail] = useState<QuizQuestion | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Generator form state
  const [genEngine, setGenEngine] = useState<'ai' | 'procedural'>('ai');
  const [genCategory, setGenCategory] = useState<string>('network_security');
  const [genDifficulty, setGenDifficulty] = useState<QuestionDifficulty>('intermediate');
  const [genCount, setGenCount] = useState<number>(2);
  const [genFocusSubtopic, setGenFocusSubtopic] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [rejectionsList, setRejectionsList] = useState<Array<{ question: string; reason: string; similarity: number }>>([]);

  // Custom question form state
  const [customId, setCustomId] = useState<string>(() => `custom_q_${Date.now().toString(36)}`);
  const [customTopic, setCustomTopic] = useState<string>('Network Security');
  const [customCategory, setCustomCategory] = useState<AssessmentCategoryKey>('network_security');
  const [customSubtopic, setCustomSubtopic] = useState<string>('Firewalls & Access Control');
  const [customDifficulty, setCustomDifficulty] = useState<QuestionDifficulty>('intermediate');
  const [customType, setCustomType] = useState<QuestionType>('multiple_choice');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customOptions, setCustomOptions] = useState<string[]>(['', '', '', '']);
  const [customCorrectAnswer, setCustomCorrectAnswer] = useState<number>(0);
  const [customExplanation, setCustomExplanation] = useState<string>('');
  const [customProvenance, setCustomProvenance] = useState<string>('NIST SP 800-53 / CIS Controls');
  const [customReviewStatus, setCustomReviewStatus] = useState<ReviewStatus>('verified');

  // Import / Export state
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Load questions and stats
  const refreshData = async () => {
    setLoading(true);
    try {
      const all = await getAllQuestions();
      const s = await getQuestionBankStats();
      setQuestions(all);
      setStats(s);
    } catch (err) {
      console.error('Failed to load questions from database', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
    const unsubscribe = subscribeToQuestionBank((updated) => {
      setQuestions(updated);
      getQuestionBankStats().then(setStats);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Flash notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
      if (selectedStatus !== 'all' && q.reviewStatus !== selectedStatus) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const text = `${q.id} ${q.question} ${q.topic} ${q.subtopic} ${q.provenance} ${q.explanation}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [questions, selectedCategory, selectedDifficulty, selectedStatus, searchQuery]);

  // Pending questions for human review queue
  const pendingReviewQuestions = useMemo(() => {
    return questions.filter(q => q.reviewStatus === 'draft' || q.reviewStatus === 'peer_reviewed' && q.isCustom);
  }, [questions]);

  // Handle question generation (AI Service or Procedural)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setRejectionsList([]);
    try {
      if (genEngine === 'ai') {
        const result = await proposeAiQuestions({
          category: genCategory,
          difficulty: genDifficulty,
          count: genCount,
          focusSubtopic: genFocusSubtopic.trim() || undefined
        });

        if (result.success && result.proposedCount > 0) {
          showNotification(
            'success',
            `Proposed ${result.proposedCount} new question(s) grounded in cybersecurity standards! Placed into the Pending Review Queue for human validation.`
          );
          if (result.duplicateRejections.length > 0) {
            setRejectionsList(result.duplicateRejections);
          }
          await refreshData();
          setActiveTab('review_queue');
        } else if (result.duplicateRejections.length > 0) {
          setRejectionsList(result.duplicateRejections);
          showNotification('error', `All proposed questions were rejected as near-duplicates of existing questions.`);
        } else {
          showNotification('error', result.error || 'AI question proposal returned 0 questions.');
        }
      } else {
        const result = await generateAndStoreQuestions({
          category: genCategory,
          difficulty: genDifficulty,
          count: genCount
        });

        if (result.success) {
          showNotification(
            'success',
            `Successfully generated, validated, and stored ${result.generatedQuestions.length} new question(s) in the database!`
          );
          await refreshData();
          setActiveTab('browse');
        } else {
          showNotification('error', `Generation failed: ${result.errors.join('; ')}`);
        }
      }
    } catch (err) {
      showNotification('error', `Error during generation: ${String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Human review actions: Approve for scored assessments
  const handleApproveQuestion = async (q: QuizQuestion) => {
    const reviewRes = await reviewQuestionAction(q.id, 'approve');
    if (!reviewRes.success) {
      showNotification('error', reviewRes.error || 'Only authorized reviewers can approve assessment questions.');
      return;
    }
    const updated = { ...q, reviewStatus: 'verified' as const, lastVerifiedDate: new Date().toISOString() };
    await saveQuestion(updated);
    showNotification('success', `Question ${q.id} approved and admitted to scored assessments!`);
    await refreshData();
  };

  // Human review actions: Reject and delete
  const handleRejectQuestion = async (id: string) => {
    const reviewRes = await reviewQuestionAction(id, 'reject');
    if (!reviewRes.success) {
      showNotification('error', reviewRes.error || 'Only authorized reviewers can reject assessment questions.');
      return;
    }
    await deleteQuestion(id);
    showNotification('success', `Question ${id} rejected and removed from database.`);
    await refreshData();
  };

  // Handle custom question submission with strict validation
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate: Partial<QuizQuestion> = {
      id: customId.trim(),
      topic: customTopic.trim(),
      category: customCategory,
      subcategory: customSubtopic.trim(),
      subtopic: customSubtopic.trim(),
      difficulty: customDifficulty,
      type: customType,
      questionType: customType,
      question: customPrompt.trim(),
      options: customOptions.map(o => o.trim()).filter(Boolean),
      correctAnswer: customCorrectAnswer,
      correctAnswers: [customCorrectAnswer],
      explanation: customExplanation.trim(),
      provenance: customProvenance.trim(),
      reviewStatus: customReviewStatus,
      creationDate: new Date().toISOString(),
      lastVerifiedDate: new Date().toISOString(),
      isCustom: true
    };

    const validation = validateQuestion(candidate);
    if (!validation.isValid) {
      showNotification('error', `Validation errors: ${validation.errors.join(' | ')}`);
      return;
    }

    const saveRes = await saveQuestion(candidate);
    if (saveRes.success) {
      showNotification('success', `Question ${candidate.id} successfully validated and stored in database!`);
      // Reset form
      setCustomId(`custom_q_${Date.now().toString(36)}`);
      setCustomPrompt('');
      setCustomOptions(['', '', '', '']);
      setCustomExplanation('');
      await refreshData();
      setActiveTab('browse');
    } else {
      showNotification('error', saveRes.error || 'Failed to save question to database.');
    }
  };

  // Delete question
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete question "${id}" from the database?`)) {
      return;
    }
    const success = await deleteQuestion(id);
    if (success) {
      showNotification('success', `Question ${id} removed.`);
      if (selectedQuestionDetail?.id === id) {
        setSelectedQuestionDetail(null);
      }
      await refreshData();
    }
  };

  // Reset to verified seed bank
  const handleResetToSeed = async () => {
    if (!window.confirm('Reset question bank to the verified 56+ seed benchmark? Any custom generated questions will be cleared.')) {
      return;
    }
    await resetToDefaultSeed();
    showNotification('success', 'Question bank restored to pristine verified seed data.');
    await refreshData();
  };

  // Export JSON
  const handleExportJson = async () => {
    const jsonStr = await exportQuestionBankJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberaware_question_bank_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('success', 'Database exported successfully as JSON file.');
  };

  // Import JSON
  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      setImportStatus('Please paste JSON text before importing.');
      return;
    }
    setImportStatus('Validating and importing questions...');
    const result = await importQuestionsFromJson(importJsonText);
    if (result.importedCount > 0) {
      showNotification('success', `Successfully validated and imported ${result.importedCount} questions.`);
      setImportStatus(`Success: ${result.importedCount} imported.`);
      setImportJsonText('');
      await refreshData();
      setActiveTab('browse');
    } else {
      setImportStatus(`Import failed: ${result.errors.join('; ')}`);
      showNotification('error', `Import failed: ${result.errors[0] || 'Unknown error'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qbank-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="qbank-title" className="text-xl font-bold text-slate-900 dark:text-white">
                  Expandable Question Bank Database
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  {stats?.total || questions.length} Stored Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Database-backed repository with strict 12-field schema, verified standards provenance, and automated generation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToSeed}
              title="Reset database to default seed questions"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Seed
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 transition-all ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border-b border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-b border-rose-200 dark:border-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'browse'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Browse & Audit ({filteredQuestions.length})
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'generate'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Generate & Validate
          </button>
          <button
            onClick={() => setActiveTab('review_queue')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'review_queue'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Pending Review ({pendingReviewQuestions.length})
            {pendingReviewQuestions.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Create Question
          </button>
          <button
            onClick={() => setActiveTab('io')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'io'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            Import / Export
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/40">
          
          {/* TAB 1: BROWSE & AUDIT QUESTIONS */}
          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Quick Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative col-span-1 md:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompt, standard, ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">All Domains ({questions.length})</option>
                    {ASSESSMENT_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.shortLabel} ({stats?.byCategory[cat.key] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">All Difficulties</option>
                    <option value="beginner">Beginner ({stats?.byDifficulty.beginner || 0})</option>
                    <option value="intermediate">Intermediate ({stats?.byDifficulty.intermediate || 0})</option>
                    <option value="advanced">Advanced ({stats?.byDifficulty.advanced || 0})</option>
                    <option value="expert">Expert ({stats?.byDifficulty.expert || 0})</option>
                  </select>
                </div>

                <div>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">All Review Statuses</option>
                    <option value="verified">Verified Benchmark ({stats?.byReviewStatus.verified || 0})</option>
                    <option value="peer_reviewed">Peer Reviewed ({stats?.byReviewStatus.peer_reviewed || 0})</option>
                    <option value="draft">Draft / Generated ({stats?.byReviewStatus.draft || 0})</option>
                  </select>
                </div>
              </div>

              {/* Questions List and Detail View Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Questions List (Left column) */}
                <div className="lg:col-span-7 space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
                  {filteredQuestions.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <Database className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No matching questions found.</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or generate new questions.</p>
                    </div>
                  ) : (
                    filteredQuestions.map((q) => {
                      const isSelected = selectedQuestionDetail?.id === q.id;
                      return (
                        <div
                          key={q.id}
                          onClick={() => setSelectedQuestionDetail(q)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {q.id}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded uppercase tracking-wider ${
                                q.difficulty === 'beginner' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                q.difficulty === 'intermediate' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                                q.difficulty === 'advanced' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                                'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              }`}>
                                {q.difficulty}
                              </span>
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {q.reviewStatus}
                              </span>
                              {q.isCustom && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Generated/Custom
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {q.isCustom && (
                                <button
                                  onClick={(e) => handleDelete(q.id, e)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Delete question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>

                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-relaxed">
                            {q.question}
                          </h4>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                            <span className="truncate max-w-[200px]">{q.subtopic || q.subcategory}</span>
                            <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 truncate max-w-[220px]">
                              {q.provenance}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Question Detail Inspector (Right column) */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 max-h-[58vh] overflow-y-auto">
                  {selectedQuestionDetail ? (
                    <div className="space-y-4">
                      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                            {selectedQuestionDetail.id}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {selectedQuestionDetail.type}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                          {selectedQuestionDetail.question}
                        </h3>
                      </div>

                      {/* 12-Field Mandatory Metadata Card */}
                      <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                          Schema & Provenance Record
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Topic / Domain:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{selectedQuestionDetail.topic}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Subtopic:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{selectedQuestionDetail.subtopic}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Difficulty:</span>
                            <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{selectedQuestionDetail.difficulty}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Review Status:</span>
                            <span className="font-medium capitalize text-emerald-600 dark:text-emerald-400">{selectedQuestionDetail.reviewStatus}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400 block">Provenance Citation:</span>
                            <span className="font-mono text-[10px] text-sky-600 dark:text-sky-300 font-semibold">{selectedQuestionDetail.provenance}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Creation Date:</span>
                            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                              {new Date(selectedQuestionDetail.creationDate || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Last Verified:</span>
                            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                              {new Date(selectedQuestionDetail.lastVerifiedDate || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Code or Log Snippet if present */}
                      {selectedQuestionDetail.logSnippet && (
                        <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[10px] overflow-x-auto">
                          <div className="text-slate-400 text-[9px] mb-1">Source: {selectedQuestionDetail.logSnippet.source}</div>
                          <pre className="whitespace-pre-wrap">{selectedQuestionDetail.logSnippet.log}</pre>
                        </div>
                      )}
                      {selectedQuestionDetail.codeSnippet && (
                        <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[10px] overflow-x-auto">
                          <div className="text-slate-400 text-[9px] mb-1">Language: {selectedQuestionDetail.codeSnippet.language}</div>
                          <pre className="whitespace-pre-wrap">{selectedQuestionDetail.codeSnippet.code}</pre>
                        </div>
                      )}

                      {/* Answer Options Breakdown */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Options:</div>
                        {selectedQuestionDetail.options.map((opt, i) => {
                          const isCorrect = selectedQuestionDetail.correctAnswers?.includes(i) || selectedQuestionDetail.correctAnswer === i;
                          return (
                            <div 
                              key={i} 
                              className={`p-2 rounded text-xs flex items-start gap-2 ${
                                isCorrect 
                                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800'
                              }`}
                            >
                              <span className="font-mono font-bold text-[10px] mt-0.5">[{i + 1}]</span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation & Mitigation */}
                      <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">Explanation:</div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          {selectedQuestionDetail.explanation}
                        </p>
                      </div>

                      {selectedQuestionDetail.mitigation && (
                        <div className="text-xs space-y-1 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                          <div className="font-semibold text-amber-800 dark:text-amber-300 text-[11px]">Mitigation & Defense:</div>
                          <p className="text-amber-700 dark:text-amber-400 text-[10px]">
                            {selectedQuestionDetail.mitigation}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <Eye className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-xs font-medium">Select any question on the left to inspect its complete 12-field database record, schema citations, and correct answer breakdowns.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERATE & VALIDATE QUESTIONS */}
          {activeTab === 'generate' && (
            <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Grounded Assessment Question Generator
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Synthesize novel cybersecurity assessment questions. AI-proposed questions are grounded in approved standards (NIST SP 800-53/63B, OWASP Top 10, MITRE ATT&CK, RFCs), screened for near-duplicates, and stored as pending review.
                </p>
              </div>

              {/* Engine Selector */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setGenEngine('ai')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    genEngine === 'ai'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Service (NIST / OWASP Grounded)
                </button>
                <button
                  type="button"
                  onClick={() => setGenEngine('procedural')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                    genEngine === 'procedural'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Procedural Domain Synthesis
                </button>
              </div>

              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Domain / Category
                  </label>
                  <select
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {ASSESSMENT_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={genDifficulty}
                      onChange={(e) => setGenDifficulty(e.target.value as QuestionDifficulty)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert / Architect</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Batch Count
                    </label>
                    <select
                      value={genCount}
                      onChange={(e) => setGenCount(parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value={1}>1 Question</option>
                      <option value={2}>2 Questions</option>
                      <option value={3}>3 Questions</option>
                      <option value={5}>5 Questions</option>
                    </select>
                  </div>
                </div>

                {genEngine === 'ai' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Focus Subtopic (Optional)
                    </label>
                    <input
                      type="text"
                      value={genFocusSubtopic}
                      onChange={(e) => setGenFocusSubtopic(e.target.value)}
                      placeholder="e.g. Kerberos Ticket Granting, TLS 1.3 Handshake, OWASP A03 SQL Injection"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

                <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                    Rigorous Standards & Duplicate Filtering:
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {genEngine === 'ai' ? (
                      <>Every proposed question is verified against NIST / OWASP / MITRE / RFC citations, tested against the question bank using normalized token overlap to <strong>reject near-duplicates</strong>, and placed into the <strong>Pending Review</strong> queue until approved.</>
                    ) : (
                      <>Procedurally generated questions adhere to strict 12-field schema compliance and instant local database persistence.</>
                    )}
                  </p>
                </div>

                {rejectionsList.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-200">
                      <AlertCircle className="w-4 h-4" />
                      Duplicate Filter Activity:
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      {rejectionsList.map((r, i) => (
                        <li key={i}>{r.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating & Checking Duplicates...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {genEngine === 'ai' ? 'Propose Grounded Questions (Pending Review)' : 'Generate and Store in Database'}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB: PENDING REVIEW QUEUE */}
          {activeTab === 'review_queue' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Human Review & Moderation Queue ({pendingReviewQuestions.length} pending)
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                      Model-generated and user-submitted questions are held here as draft/pending review until manually verified for technical accuracy, answer key correctness, and provenance validity before being admitted to scored assessments.
                    </p>
                  </div>
                </div>
              </div>

              {pendingReviewQuestions.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Review Queue is Pristine
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    All questions in the active database have been reviewed and approved for scored assessments. When you generate new questions using the AI service, they will appear here for verification.
                  </p>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Generate New Questions via AI
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingReviewQuestions.map((q) => (
                    <div 
                      key={q.id}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded">
                            {q.id}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Pending Review
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {q.topic} • {q.subtopic || q.subcategory}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {q.provenance}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                          {q.question}
                        </h4>
                      </div>

                      {/* Options with correct answer indicator */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Answer Options:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctAnswer === oIdx || (q.correctAnswers && q.correctAnswers.includes(oIdx));
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className="flex-1">{opt}</span>
                                {isCorrect && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white flex-shrink-0">
                                    CORRECT KEY
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs space-y-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Explanation & Technical Grounding:</span>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleRejectQuestion(q.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                        >
                          Reject & Delete
                        </button>
                        <button
                          onClick={() => handleApproveQuestion(q)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve for Scored Assessments
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE CUSTOM QUESTION */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateCustom} className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Question to Verified Database
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enforces all 12 mandatory attributes before persisting to client-side database storage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Question ID (Unique) *
                  </label>
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Domain Category *
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => {
                      const cat = e.target.value as AssessmentCategoryKey;
                      setCustomCategory(cat);
                      const meta = ASSESSMENT_CATEGORIES.find(c => c.key === cat);
                      if (meta) {
                        setCustomTopic(meta.label);
                        setCustomSubtopic(meta.subcategories[0] || 'General');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {ASSESSMENT_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subtopic *
                  </label>
                  <input
                    type="text"
                    value={customSubtopic}
                    onChange={(e) => setCustomSubtopic(e.target.value)}
                    required
                    placeholder="e.g. Zero Trust Architecture"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Difficulty *
                    </label>
                    <select
                      value={customDifficulty}
                      onChange={(e) => setCustomDifficulty(e.target.value as QuestionDifficulty)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Type *
                    </label>
                    <select
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value as QuestionType)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="select_all">Select All That Apply</option>
                      <option value="scenario">Scenario</option>
                      <option value="log_analysis">Log Analysis</option>
                      <option value="code_review">Code Review</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Question Prompt Text *
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={2}
                  required
                  placeholder="Clearly state the cybersecurity challenge, problem, or technical scenario..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Answer Options (Select radio to designate correct answer) *
                </label>
                {customOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="customCorrect"
                      checked={customCorrectAnswer === idx}
                      onChange={() => setCustomCorrectAnswer(idx)}
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...customOptions];
                        copy[idx] = e.target.value;
                        setCustomOptions(copy);
                      }}
                      required
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Explanation & Defensive Rationale *
                </label>
                <textarea
                  value={customExplanation}
                  onChange={(e) => setCustomExplanation(e.target.value)}
                  rows={2}
                  required
                  placeholder="Explain why the designated answer is correct and why the distractors are wrong..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Provenance / Source Standard *
                  </label>
                  <input
                    type="text"
                    value={customProvenance}
                    onChange={(e) => setCustomProvenance(e.target.value)}
                    required
                    placeholder="e.g. NIST SP 800-63B / MITRE ATT&CK T1059 / RFC 8446"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Review Status *
                  </label>
                  <select
                    value={customReviewStatus}
                    onChange={(e) => setCustomReviewStatus(e.target.value as ReviewStatus)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="verified">Verified Benchmark</option>
                    <option value="peer_reviewed">Peer Reviewed</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                Validate and Save to Question Bank
              </button>
            </form>
          )}

          {/* TAB 4: IMPORT / EXPORT */}
          {activeTab === 'io' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Export Card */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Export Question Bank Database
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Download all {questions.length} question records in standardized JSON format.
                  </p>
                </div>
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>

              {/* Import Card */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Import Questions (JSON)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Paste a JSON array of question objects. Every question is validated against the 12 required fields before ingestion.
                  </p>
                </div>

                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  rows={6}
                  placeholder='[\n  {\n    "id": "ext_01",\n    "topic": "Network Security",\n    "subtopic": "DNS",\n    "difficulty": "intermediate",\n    "type": "multiple_choice",\n    "question": "...",\n    "options": ["A", "B"],\n    "correctAnswer": 0,\n    "explanation": "...",\n    "provenance": "RFC 1035",\n    "reviewStatus": "peer_reviewed",\n    "creationDate": "2025-01-15T00:00:00.000Z",\n    "lastVerifiedDate": "2025-02-10T00:00:00.000Z"\n  }\n]'
                  className="w-full p-3 font-mono text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />

                {importStatus && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {importStatus}
                  </p>
                )}

                <button
                  onClick={handleImportJson}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Validate and Ingest
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
          <span>Active Storage: IndexedDB Object Store + Client Cache</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
