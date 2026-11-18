import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles, 
  ListChecks, 
  CheckSquare, 
  Search, 
  Shield, 
  KeyRound, 
  UserX, 
  Globe, 
  MailWarning,
  Circle
} from 'lucide-react';
import { LessonModule, UserProgressState } from '../types';
import { LESSONS_DATA } from '../data/lessonsData';
import { PasswordStrengthTool } from './PasswordStrengthTool';

interface LearningCenterViewProps {
  progress: UserProgressState;
  initialLessonId?: string;
  onToggleLesson: (lessonId: string) => void;
  onToggleChecklist: (lessonId: string, itemId: string) => void;
  onGoToDetective: () => void;
  onGoToQuiz: () => void;
}

export const LearningCenterView: React.FC<LearningCenterViewProps> = ({
  progress,
  initialLessonId,
  onToggleLesson,
  onToggleChecklist,
  onGoToDetective,
  onGoToQuiz
}) => {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessonId || null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [justCompletedToast, setJustCompletedToast] = useState(false);

  useEffect(() => {
    if (initialLessonId) {
      setSelectedLessonId(initialLessonId);
    }
  }, [initialLessonId]);

  const categories = [
    { id: 'all', label: 'All Modules' },
    { id: 'phishing', label: 'Phishing' },
    { id: 'passwords', label: 'Passwords' },
    { id: 'authentication', label: 'MFA' },
    { id: 'social_engineering', label: 'Social Engineering' },
    { id: 'safe_browsing', label: 'Safe Browsing' }
  ];

  const filteredLessons = activeCategory === 'all'
    ? LESSONS_DATA
    : LESSONS_DATA.filter(l => l.category === activeCategory);

  const currentLesson = LESSONS_DATA.find(l => l.id === selectedLessonId);
  const isCurrentCompleted = currentLesson ? progress.completedLessons.includes(currentLesson.id) : false;

  const handleToggleComplete = (lessonId: string) => {
    onToggleLesson(lessonId);
    if (!isCurrentCompleted) {
      setJustCompletedToast(true);
      setTimeout(() => setJustCompletedToast(false), 3000);
    }
  };

  const getLessonIcon = (name: string) => {
    switch (name) {
      case 'MailWarning': return <MailWarning className="w-4 h-4" />;
      case 'KeyRound': return <KeyRound className="w-4 h-4" />;
      case 'ShieldCheck': return <Shield className="w-4 h-4" />;
      case 'UserX': return <UserX className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  // If a lesson is selected, render the rich, clean lesson reader
  if (currentLesson) {
    const currentIndex = LESSONS_DATA.findIndex(l => l.id === currentLesson.id);
    const prevLesson = currentIndex > 0 ? LESSONS_DATA[currentIndex - 1] : null;
    const nextLesson = currentIndex < LESSONS_DATA.length - 1 ? LESSONS_DATA[currentIndex + 1] : null;
    const completedItems = progress.completedChecklists[currentLesson.id] || [];

    return (
      <div className="max-w-3xl space-y-6 animate-fadeIn pb-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedLessonId(null)}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Lessons</span>
          </button>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentLesson.readTimeMinutes} min read</span>
            </span>

            <button
              onClick={() => handleToggleComplete(currentLesson.id)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isCurrentCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isCurrentCompleted ? 'Completed ✓' : 'Mark Complete'}</span>
            </button>
          </div>
        </div>

        {/* Completion Toast */}
        {justCompletedToast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              <span className="font-semibold">Lesson marked as complete! Your progress has been updated.</span>
            </div>
            <button
              onClick={() => setJustCompletedToast(false)}
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Lesson Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 space-y-2.5">
          <div className="inline-flex items-center space-x-1.5 text-xs text-sky-700 dark:text-sky-400 font-semibold uppercase tracking-wider">
            {getLessonIcon(currentLesson.iconName)}
            <span>{currentLesson.category.replace('_', ' ')}</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {currentLesson.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentLesson.subtitle}
          </p>

          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Summary: </strong>
            {currentLesson.summary}
          </div>
        </div>

        {/* Embedded Interactive Password Tool if on password lesson */}
        {currentLesson.id === 'password_security' && (
          <div className="my-6">
            <PasswordStrengthTool />
          </div>
        )}

        {/* Sections */}
        <div className="space-y-5">
          {currentLesson.sections.map((section, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <span>{section.title}</span>
              </h2>

              <div className="space-y-2.5 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                {section.content.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}
              </div>

              {/* Practical Example Good vs Bad */}
              {section.practicalExample && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block mb-1">
                      Safe Pattern:
                    </span>
                    <p className="text-xs font-mono text-emerald-900 dark:text-emerald-200 break-all">{section.practicalExample.good}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400 block mb-1">
                      Deceptive Pattern:
                    </span>
                    <p className="text-xs font-mono text-rose-900 dark:text-rose-200 break-all">{section.practicalExample.bad}</p>
                  </div>
                  <div className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400 italic">
                    Note: {section.practicalExample.explanation}
                  </div>
                </div>
              )}

              {/* Warning Notice */}
              {section.warningNotice && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Caution: </strong>{section.warningNotice}
                </div>
              )}

              {/* Key Rule Takeaway */}
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs text-sky-900 dark:text-sky-200 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span><strong>Key Rule: </strong>{section.takeaway}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Checklist */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
              <ListChecks className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Recommended Defense Habits</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {completedItems.length} of {currentLesson.actionChecklist.length} checked
            </span>
          </div>

          <div className="space-y-2">
            {currentLesson.actionChecklist.map((habit, hIdx) => {
              const itemId = `habit_${hIdx}`;
              const isChecked = completedItems.includes(itemId);
              return (
                <button
                  key={hIdx}
                  type="button"
                  onClick={() => onToggleChecklist(currentLesson.id, itemId)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                    isChecked
                      ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/40 text-slate-900 dark:text-slate-100'
                      : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                    isChecked 
                      ? 'bg-sky-600 border-sky-500 text-white' 
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                  }`}>
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className={isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''}>{habit}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Pagination & Finish */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={() => handleToggleComplete(currentLesson.id)}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
              isCurrentCompleted
                ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCurrentCompleted ? 'Mark Incomplete' : 'Mark as Complete (+8 pts)'}</span>
          </button>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {prevLesson && (
              <button
                onClick={() => setSelectedLessonId(prevLesson.id)}
                className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}
            {nextLesson ? (
              <button
                onClick={() => setSelectedLessonId(nextLesson.id)}
                className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-200 dark:border-sky-500/30"
              >
                <span>Next: {nextLesson.title.split('&')[0]}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onGoToQuiz}
                className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/40"
              >
                <span>Take Knowledge Quiz</span>
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Directory View
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Security Learning Modules</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Plain-language guides designed to build foundational online safety habits.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-sky-600 text-white font-bold'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Modules List */}
      <div className="space-y-3.5">
        {filteredLessons.map((lesson) => {
          const isCompleted = progress.completedLessons.includes(lesson.id);

          return (
            <div
              key={lesson.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                    {lesson.category.replace('_', ' ')}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{lesson.readTimeMinutes} min</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lesson.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  {lesson.subtitle}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                {isCompleted ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Completed</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    Not Started
                  </span>
                )}

                <button
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  {isCompleted ? 'Review' : 'Start Lesson'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
