import React, { useState } from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap,
  ClipboardCheck, 
  TrendingUp, 
  Users,
  Trophy,
  User,
  Settings,
  LogOut,
  LogIn,
  Sun, 
  Moon, 
  Menu, 
  X,
  ChevronRight,
  Info
} from 'lucide-react';
import { ActiveTab, UserProgressState } from '../types';
import { useTheme } from '../context/ThemeContext';
import { calculateLessonProgress } from '../utils/scoring';
import { LESSONS_DATA } from '../data/lessonsData';
import { DEMO_USER_PROFILES, DEFAULT_DEMO_USER } from '../utils/assessmentAttempts';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  progress: UserProgressState;
  currentUserId?: string;
  onLogout?: () => void;
  onChangeUser?: (userId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onSelectTab, 
  progress,
  currentUserId = '',
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user: authUser, logout: authLogout, openAuthModal } = useAuth();

  const lessonPct = calculateLessonProgress(progress.completedLessons.length, LESSONS_DATA.length);
  const displayName = authUser?.name || (currentUserId && DEMO_USER_PROFILES[currentUserId]?.name) || 'Public Visitor';
  const displayRole = authUser?.role || (currentUserId && DEMO_USER_PROFILES[currentUserId]?.role) || 'Guest';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'learning', 
      label: 'Learning Centre', 
      icon: <BookOpen className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'lessons', 
      label: 'Lessons', 
      icon: <GraduationCap className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'quiz', 
      label: 'Assessments', 
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'progress', 
      label: 'My Progress', 
      icon: <TrendingUp className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'groups', 
      label: 'Security Groups', 
      icon: <Users className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'leaderboard', 
      label: 'Leaderboard', 
      icon: <Trophy className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'profile', 
      label: 'Profile', 
      icon: <User className="w-4 h-4 shrink-0" /> 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: <Settings className="w-4 h-4 shrink-0" /> 
    },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const handleLogoutClick = async () => {
    setMobileMenuOpen(false);
    if (onLogout) {
      onLogout();
    }
    await authLogout();
  };

  return (
    <>
      {/* Mobile Top Header (Dark Navy) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-[#0B132B] text-white border-b border-slate-800 transition-colors">
        <button
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center space-x-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg"
          aria-label="CyberAware Dashboard"
        >
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight">
              Cyber<span className="text-sky-400">Aware</span>
            </span>
          </div>
        </button>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer (Dark Navy) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0B132B] text-slate-200 border-r border-slate-800 p-5 z-50 justify-between overflow-y-auto">
            <div>
              {/* Brand Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-800 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white tracking-tight">
                      Cyber<span className="text-sky-400">Aware</span>
                    </span>
                    <p className="text-[11px] text-slate-400">Security Learning Hub</p>
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Menu */}
              <nav className="space-y-1" aria-label="Mobile Navigation">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id || 
                    (item.id === 'learning' && activeTab === 'lessons') ||
                    (item.id === 'lessons' && activeTab === 'learning');

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30 shadow-xs'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-sky-400" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer Area */}
            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="flex items-center space-x-2">
                  {theme === 'light' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                  <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
                </span>
                <span className="text-[10px] text-slate-400">Toggle</span>
              </button>

              {authUser ? (
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('login');
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-sky-400 hover:bg-white/5 transition-colors font-semibold"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Slim Dark Navy Sidebar */}
      <aside 
        className="hidden lg:flex flex-col w-60 shrink-0 min-h-screen sticky top-0 bg-[#0B132B] border-r border-slate-800/80 p-4 justify-between transition-colors z-20 shadow-sm"
        aria-label="Desktop Sidebar"
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center space-x-3 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl px-2 py-1.5 transition-colors group"
            aria-label="CyberAware Dashboard"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-xs group-hover:bg-sky-400 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base text-white tracking-tight">
                  Cyber<span className="text-sky-400">Aware</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Security Learning Platform</p>
            </div>
          </button>

          {/* Primary Navigation Menu */}
          <nav className="space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id || 
                (item.id === 'learning' && activeTab === 'lessons') ||
                (item.id === 'lessons' && activeTab === 'learning');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30 shadow-xs'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Controls: Theme Toggle, User, and Logout */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          {/* Quick Curriculum Progress Pill */}
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">Curriculum Progress</span>
              <span className="font-bold text-sky-400">{lessonPct}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-sky-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${lessonPct}%` }}
              />
            </div>
          </div>

          {/* User Profile Info Card */}
          <div 
            onClick={() => openAuthModal(authUser ? 'login' : 'login')}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-between text-xs cursor-pointer transition-colors group"
            title={authUser ? "Switch User" : "Sign In to Your Account"}
            role="button"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {authUser ? displayInitial : <LogIn className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <span className="text-white font-semibold truncate block text-xs group-hover:text-sky-300 transition-colors">
                  {authUser ? displayName : 'Sign In'}
                </span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {authUser ? displayRole : 'Access your progress'}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-sky-400 font-semibold group-hover:underline">
              {authUser ? 'Switch' : 'Login'}
            </span>
          </div>

          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
            aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            <span className="flex items-center space-x-2">
              {theme === 'light' ? (
                <Moon className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </span>
            <span className="text-[10px] text-slate-400">Toggle</span>
          </button>

          {/* Logout / Landing Button */}
          {authUser ? (
            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          ) : (
            <button
              onClick={() => handleNavClick('landing')}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-sky-400 hover:bg-white/5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Landing Page</span>
            </button>
          )}

          {/* Subtle About link */}
          <button
            onClick={() => handleNavClick('about')}
            className="w-full text-center text-[10px] text-slate-500 hover:text-slate-400 transition-colors block pt-1"
          >
            About & Educational Terms
          </button>
        </div>
      </aside>
    </>
  );
};
