import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  X, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  KeyRound, 
  RefreshCw, 
  ShieldCheck,
  Check,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { evaluatePasswordClient, resetPasswordRequest } from '../services/authApi';
import { UserRole } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose,
  initialMode = 'login' 
}) => {
  const { login, register, demoLogin, demoUsers } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Student / Learner');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset password states
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Status & feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode when initialMode changes
  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, isOpen]);

  // Live password entropy analysis
  const passwordEntropy = evaluatePasswordClient(mode === 'forgot' ? newPassword : password);

  if (!isOpen) return null;

  const handleModeSwitch = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResetStep('request');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({ email: email.trim(), password, rememberMe });
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid credentials.');
      } else {
        setSuccessMessage('Successfully authenticated!');
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both entries.');
      return;
    }

    if (passwordEntropy.score < 2) {
      setErrorMessage('Please choose a stronger passphrase with at least 8 characters and varied character types.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed.');
      } else {
        setSuccessMessage('Account created successfully! Welcome to CyberAware.');
        setTimeout(() => onClose(), 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsSubmitting(true);
    try {
      if (resetStep === 'request') {
        const res = await resetPasswordRequest({ email: email.trim() });
        if (!res.success) {
          setErrorMessage(res.error || 'Password recovery is currently unavailable.');
        } else {
          setResetStep('verify');
          setSuccessMessage(res.message || 'Recovery instructions processed.');
        }
      } else {
        const res = await resetPasswordRequest({
          email: email.trim(),
          verificationCode,
          newPassword
        });
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update password.');
        } else {
          setSuccessMessage(res.message || 'Password successfully updated.');
          setTimeout(() => {
            setMode('login');
            setPassword('');
          }, 1200);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Reset request error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoClick = async (userId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const res = await demoLogin(userId);
      if (res.success) {
        setSuccessMessage(`Signed in as ${res.user?.name}!`);
        setTimeout(() => onClose(), 500);
      } else {
        setErrorMessage(res.error || 'Demo login failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-fadeIn">
      {/* Background overlay click */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all flex flex-col max-h-[92vh]">
        
        {/* Dark Navy Header Section (CyberAware Visual Identity) */}
        <div className="bg-[#0B132B] px-6 py-5 border-b border-slate-800 text-white shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-lg text-white tracking-tight">
                  Cyber<span className="text-sky-400">Aware</span>
                </span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  SEC-AUTH
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Defensive Cybersecurity Awareness & Training Hub
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 shrink-0 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all px-2 ${
              mode === 'login'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all px-2 ${
              mode === 'register'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
          {mode === 'forgot' && (
            <span className="pb-3 text-sm font-semibold border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 px-2">
              Password Reset
            </span>
          )}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-800 dark:text-rose-200 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 flex items-start space-x-3 text-emerald-800 dark:text-emerald-200 text-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Quick Demo Evaluation Section for Competition Judges */}
          {mode === 'login' && (
            <div className="p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>CodeSprint 2026 Evaluation — 1-Click Access</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Demo Mode</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Click any profile below to instantly authenticate and evaluate persistent attempts, group rankings, and question integrity:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickDemoClick('destinyivienagbor2005@gmail.com')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600 text-left transition-all shadow-2xs group cursor-pointer"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400">
                    Destiny
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                    Primary Learner
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoClick('judge.security@codesprint.org')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600 text-left transition-all shadow-2xs group cursor-pointer"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400">
                    Security Judge
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                    CodeSprint Evaluator
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoClick('alex.student@cyberaware.edu')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600 text-left transition-all shadow-2xs group cursor-pointer"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white block group-hover:text-sky-600 dark:group-hover:text-sky-400">
                    Alex Rivera
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                    Peer Student
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Form 1: Standard Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="learner@cyberaware.edu"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password / Passphrase
                  </label>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('forgot')}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    Forgot passphrase?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secure password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 border-slate-300 dark:border-slate-700 focus:ring-sky-500"
                  />
                  <span>Remember active session</span>
                </label>
                <span className="text-[11px] text-slate-400">Default password: CyberAware2026!</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to CyberAware</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form 2: Registration Form with Educational Password Meter */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Morgan Vance"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="morgan@cyberaware.edu"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Learning Track / Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                >
                  <option value="Student / Learner">Student / Learner (Foundations & Labs)</option>
                </select>
              </div>

              {/* Password Field with Live Entropy Meter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Passphrase (NIST SP 800-63B Compliant)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong passphrase (e.g. River-Castle-98!)"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Educational Password Strength Meter */}
                {password.length > 0 && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Entropy Strength:</span>
                      <span className="font-bold" style={{ color: passwordEntropy.color }}>
                        {passwordEntropy.label}
                      </span>
                    </div>

                    {/* Progress Bar with 4 segments */}
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[0, 1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: step < passwordEntropy.score ? passwordEntropy.color : '#e2e8f0'
                          }}
                        />
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Offline GPU resistance:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {passwordEntropy.estimatedCrackTime}
                      </span>
                    </div>

                    {/* Character requirement chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                        passwordEntropy.hasMinLength 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordEntropy.hasMinLength ? <Check className="w-3 h-3" /> : '•'}
                        <span>8+ chars</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                        passwordEntropy.hasUppercase 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordEntropy.hasUppercase ? <Check className="w-3 h-3" /> : '•'}
                        <span>Uppercase</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                        passwordEntropy.hasLowercase 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordEntropy.hasLowercase ? <Check className="w-3 h-3" /> : '•'}
                        <span>Lowercase</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                        passwordEntropy.hasNumber 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordEntropy.hasNumber ? <Check className="w-3 h-3" /> : '•'}
                        <span>Numbers</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                        passwordEntropy.hasSpecialChar 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {passwordEntropy.hasSpecialChar ? <Check className="w-3 h-3" /> : '•'}
                        <span>Symbol (!@#)</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Passphrase
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your passphrase"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] text-rose-500 mt-1">Passphrases do not match yet.</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Security Tip: Passphrase Length Beats Complexity
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Combining 3 or 4 random words (like &quot;Solar-Hawk-Coffee-99&quot;) generates superior mathematical entropy compared to short, convoluted passwords.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Protected Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Create Secure Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form 3: Simulated Password Reset */}
          {mode === 'forgot' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <span className="font-bold flex items-center space-x-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Out-of-Band Password Recovery Simulation</span>
                </span>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                  In production, recovery codes are transmitted securely via secondary authenticated channels to prevent account takeover.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="learner@cyberaware.edu"
                    disabled={resetStep === 'verify'}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {resetStep === 'verify' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter verification code"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 font-mono text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Passphrase
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new secure passphrase"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
                >
                  Back to Sign In
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{resetStep === 'request' ? 'Request Recovery Code' : 'Update Passphrase'}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer with Security Disclaimer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Server-side scrypt hashing with per-user salt</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">CyberAware v2.6</span>
        </div>
      </div>
    </div>
  );
};
