import React, { useState } from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  BookOpen, 
  CheckSquare, 
  Search, 
  Award, 
  Info, 
  Menu, 
  X,
  Flame,
  Sun,
  Moon
} from 'lucide-react';
import { ActiveTab, UserProgressState } from '../types';
import { calculateCyberHygieneScore } from '../utils/scoring';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  progress: UserProgressState;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, progress }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hygieneScore = calculateCyberHygieneScore(progress);
  const { theme, toggleTheme } = useTheme();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'learning', label: 'Learning Center', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'detective', label: 'Phishing Detective', icon: <Search className="w-4 h-4" /> },
    { id: 'quiz', label: 'Interactive Quiz', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'progress', label: 'My Progress', icon: <Award className="w-4 h-4" /> },
    { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-xs dark:shadow-none transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center space-x-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg p-1 transition-colors"
            aria-label="CyberAware Home Dashboard"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-md shadow-sky-500/20 dark:shadow-sky-950/50">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  Cyber<span className="text-sky-600 dark:text-sky-400">Aware</span>
                </span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800/60">
                  Edu
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Digital Defense for Everyone</p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Controls: Theme Toggle, Streak, Score */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label={theme === 'light' ? 'Switch to Dark Mode (currently Light Mode)' : 'Switch to Light Mode (currently Dark Mode)'}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-400/20" />
                  <span className="text-slate-700 font-medium">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-sky-400 fill-sky-400/20" />
                  <span className="text-slate-300 font-medium">Dark</span>
                </>
              )}
            </button>

            {/* Streak indicator */}
            <div 
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 text-xs font-medium text-amber-800 dark:text-amber-300"
              title="Daily Learning Streak"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>{progress.streakDays}d Streak</span>
            </div>

            {/* Cyber Hygiene Pill */}
            <button
              onClick={() => handleNavClick('progress')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-300 dark:border-sky-800/70 text-xs font-semibold text-sky-900 dark:text-sky-200 transition-colors"
              title="View your Cyber Hygiene Score"
            >
              <span className="text-slate-500 dark:text-slate-400 font-normal">Score:</span>
              <span className="text-sky-700 dark:text-sky-300 font-bold">{hygieneScore}/100</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></div>
            </button>
          </div>

          {/* Mobile Menu & Theme Controls */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-sky-400" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                  isActive
                    ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Cyber Hygiene Score:</span>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/80 px-2 py-1 rounded border border-sky-200 dark:border-sky-800/60">
              {hygieneScore} / 100
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
