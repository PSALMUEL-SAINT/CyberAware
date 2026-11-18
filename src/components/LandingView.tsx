import React from 'react';
import { 
  Shield, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  BookOpen, 
  ClipboardCheck, 
  TrendingUp, 
  Users, 
  Trophy, 
  Lock, 
  Mail, 
  Key, 
  Globe, 
  Sparkles,
  Zap,
  Award,
  ChevronRight,
  Sun,
  Moon,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActiveTab } from '../types';
import { LESSONS_DATA } from '../data/lessonsData';

interface LandingViewProps {
  onNavigate: (tab: ActiveTab, subTarget?: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, openAuthModal, demoLogin, demoUsers } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleStartLearning = () => {
    if (isAuthenticated) {
      onNavigate('dashboard');
    } else {
      openAuthModal('register');
    }
  };

  const handleOpenLogin = () => {
    openAuthModal('login');
  };

  const handleExploreCourses = () => {
    onNavigate('learning');
  };

  const handleExplicitDemo = async (userId: string) => {
    const res = await demoLogin(userId);
    if (res.success) {
      onNavigate('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B132B] text-slate-900 dark:text-slate-100 transition-colors">
      {/* 1. Public Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                  Cyber<span className="text-sky-500">Aware</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded border border-sky-200/60 dark:border-sky-800/60">
                  EduPlatform
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Security Awareness & Defense Hub
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => {
                const el = document.getElementById('features-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              Platform Features
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('curriculum-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              Curriculum
            </button>
            <button
              onClick={() => onNavigate('learning')}
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              Course Preview
            </button>
            <button
              onClick={() => onNavigate('about')}
              className="px-3 py-2 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              About & Trust
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {isAuthenticated && user ? (
              <button
                onClick={() => onNavigate('dashboard')}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition-all"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleOpenLogin}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>

                <button
                  onClick={handleStartLearning}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Get Started</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-white via-sky-50/20 to-transparent dark:from-[#0B132B] dark:via-slate-900/40 dark:to-[#0B132B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Tagline Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/70 text-xs font-semibold text-sky-700 dark:text-sky-300 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-sky-500" />
              <span>Cybersecurity Education & Awareness Hub</span>
            </div>

            {/* Main Headline & Tagline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Know the Threat. <br />
              <span className="text-sky-600 dark:text-sky-400">Stop the Attack.</span>
            </h1>

            {/* Subtitle explaining what learners can do */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              An interactive cybersecurity awareness platform designed for everyday internet users, students, and practitioners. Learn to identify phishing schemes, build resilient password habits, configure multi-factor authentication, and defend against social engineering through hands-on simulations.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={handleStartLearning}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2 group"
              >
                <span>Get Started / Create Account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={handleOpenLogin}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4 text-slate-500" />
                <span>Existing User? Log In</span>
              </button>

              <button
                onClick={handleExploreCourses}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>Browse Lessons</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Trust and Feature Metric Badges */}
            <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>5 Domains</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">10 Practical Lessons</p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Verified Quizzes</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Authoritative Grading</p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Zap className="w-4 h-4" />
                  <span>Phishing Sandbox</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Interactive Email Analysis</p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                  <Trophy className="w-4 h-4" />
                  <span>Cohort Teams</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fair Leaderboards</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Features Section (Pastel Card Design) */}
      <section id="features-section" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            Hands-On Cybersecurity Training
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Everything you need to stay safe online
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A comprehensive curriculum combined with simulated threat detection and server-verified skill assessments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Interactive Lessons */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Foundational Cybersecurity Lessons
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Step-by-step guides covering phishing indicators, credential security, multi-factor authentication, Wi-Fi hygiene, and social engineering defenses with practical checklists.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Actionable checklists for every lesson</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Good vs Bad practical examples</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Warning notices and high-impact takeaways</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Phishing Detective Simulator */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Phishing Detective Simulator
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Analyze realistic email threats in a safe sandbox. Inspect suspicious senders, mismatched link destinations, psychological triggers, and dangerous attachments.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Simulated inbox and delivery scenarios</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Immediate red-flag breakdown & explanations</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Interactive clue revelation</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Diagnostic Assessments */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Authoritative Skill Assessments
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Test your knowledge with randomized diagnostic assessments graded authoritatively on the server. Get detailed domain performance metrics and targeted review recommendations.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Single-choice and multi-select formats</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Domain breakdown across categories</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Server-verified score integrity</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Supporting Secondary Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Progress & Badges */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Personal Progress Tracking & Achievement Badges
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Every registered account tracks its own isolated learning milestones. Monitor your Cyber Hygiene Score, unlock Bronze through Platinum badges, and review your historical attempt records.
              </p>
            </div>
          </div>

          {/* Security Groups & Fair Leaderboards */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-5">
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Security Squads & Cohort Leaderboards
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Collaborate with peers by creating security groups with instant 6-character invitation codes. Compete on a transparent leaderboard calculated strictly using server-verified scores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Curriculum Overview Section */}
      <section id="curriculum-section" className="py-16 sm:py-20 bg-slate-100/70 dark:bg-slate-900/40 border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                Structured Modules
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                Explore the Awareness Curriculum
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Curated by cybersecurity educators for maximum practical retention.
              </p>
            </div>

            <button
              onClick={handleExploreCourses}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
            >
              <span>View all lessons</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LESSONS_DATA.slice(0, 6).map((lesson, idx) => {
              const categoryColorMap: Record<string, string> = {
                phishing: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                passwords: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                authentication: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
                social_engineering: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                safe_browsing: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              };

              return (
                <div
                  key={lesson.id}
                  onClick={() => onNavigate('learning', lesson.id)}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:border-sky-400 dark:hover:border-sky-600 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${categoryColorMap[lesson.category] || 'bg-slate-100 text-slate-700'}`}>
                        {lesson.category.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {lesson.readTimeMinutes} min read
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {lesson.title}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {lesson.summary}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                    <span className="text-[11px] font-medium">{lesson.actionChecklist.length} action checklist items</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Evaluation / Demo Accounts Card (Explicit Selection Only) */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-200/80 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Evaluator & Judge Quick Test Options</span>
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Evaluating the CyberAware Platform?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              You can test the platform instantly with pre-configured evaluation accounts, or register your own fresh account to verify isolated zero-progress initialization. Demo accounts are never activated automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
            <button
              onClick={() => handleExplicitDemo('destinyivienagbor2005@gmail.com')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <span>Test as Destiny (Learner)</span>
            </button>

            <button
              onClick={() => handleExplicitDemo('judge.security@codesprint.org')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <span>Test as Judge (Evaluator)</span>
            </button>

            <button
              onClick={() => openAuthModal('register')}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register New User</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Call To Action Footer Banner */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-sky-600 to-sky-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Start Defending Your Digital Presence Today
          </h2>
          <p className="text-sm sm:text-base text-sky-100 max-w-2xl mx-auto leading-relaxed">
            Join students and professionals learning how to detect phishing attempts, avoid credential theft, and keep their networks safe.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleStartLearning}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
            >
              Create Free Account
            </button>
            <button
              onClick={handleOpenLogin}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-800/60 hover:bg-sky-800 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              Log In to Existing Account
            </button>
          </div>
        </div>
      </section>

      {/* 7. Public Footer */}
      <footer className="py-8 bg-white dark:bg-[#070D1F] border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">CyberAware</span>
            <span>— Educational Awareness Platform</span>
          </div>

          <div className="flex items-center space-x-6">
            <button
              onClick={() => onNavigate('learning')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Curriculum
            </button>
            <button
              onClick={() => onNavigate('about')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              About & Terms
            </button>
            <button
              onClick={handleOpenLogin}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
