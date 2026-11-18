import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { evaluatePasswordStrength } from '../utils/scoring';

export const PasswordStrengthTool: React.FC = () => {
  const [inputVal, setInputVal] = useState('correct-horse-battery-2026!');
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);

  const analysis = evaluatePasswordStrength(inputVal);

  const presets = [
    { label: 'Common Weak', value: 'password123' },
    { label: 'Short Complex', value: 'P@ss!9' },
    { label: 'Long Passphrase', value: 'forest-orbit-tulip-winter-88' },
    { label: 'Ultra Entropy', value: 'Correct-Horse-Battery-Staple-2026!' }
  ];

  const handleCopy = () => {
    if (!inputVal) return;
    navigator.clipboard?.writeText(inputVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBarColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return 'bg-rose-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-sky-500';
      case 4:
        return 'bg-emerald-500';
      default:
        return 'bg-slate-300 dark:bg-slate-700';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/10 border border-sky-300 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">Interactive Password & Passphrase Lab</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Test how entropy and length protect against modern GPU brute-force attacks</p>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-full self-start sm:self-center">
          <Sparkles className="w-3.5 h-3.5" />
          <span>100% Client-Side Simulation</span>
        </div>
      </div>

      {/* Preset selector pills */}
      <div className="mt-4">
        <label className="text-xs text-slate-600 dark:text-slate-400 mb-2 block font-medium">Try Sample Credentials to Compare:</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setInputVal(preset.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                inputVal === preset.value
                  ? 'bg-sky-100 dark:bg-sky-500/20 border-sky-400 dark:border-sky-500/60 text-sky-800 dark:text-sky-300 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <div className="mt-4 relative">
        <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
          <input
            type={showPassword ? 'text' : 'password'}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type or paste a sample password..."
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none font-mono"
            aria-label="Password input test"
          />
          <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 ml-2">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors p-1"
              title={showPassword ? 'Hide characters' : 'Show characters'}
              aria-label={showPassword ? 'Hide characters' : 'Show characters'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors p-1"
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Strength Meter */}
      <div className="mt-4">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-slate-500 dark:text-slate-400">Strength Rating:</span>
          <span className={`font-semibold ${
            analysis.score >= 3 ? 'text-emerald-600 dark:text-emerald-400' : analysis.score === 2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {analysis.level} ({analysis.score}/4)
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-2">
          {[0, 1, 2, 3].map((step) => (
            <div
              key={step}
              className={`rounded-full transition-colors ${
                step <= analysis.score - 1 ? getBarColor(analysis.score) : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Crack Time Estimate & Length */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            {analysis.score >= 3 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Est. Brute-Force Crack Time</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{analysis.crackTimeEstimate}</div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Length Check</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {inputVal.length} characters
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            inputVal.length >= 14
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
              : inputVal.length >= 8
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
          }`}>
            {inputVal.length >= 14 ? 'Ideal' : inputVal.length >= 8 ? 'Acceptable' : 'Too Short'}
          </span>
        </div>
      </div>

      {/* Character criteria checklist */}
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className={`px-2 py-1 rounded border flex items-center space-x-1 ${
          analysis.hasLength ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}>
          <span>{analysis.hasLength ? '✓' : '○'} 12+ chars</span>
        </span>
        <span className={`px-2 py-1 rounded border flex items-center space-x-1 ${
          analysis.hasUpper ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}>
          <span>{analysis.hasUpper ? '✓' : '○'} Uppercase</span>
        </span>
        <span className={`px-2 py-1 rounded border flex items-center space-x-1 ${
          analysis.hasLower ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}>
          <span>{analysis.hasLower ? '✓' : '○'} Lowercase</span>
        </span>
        <span className={`px-2 py-1 rounded border flex items-center space-x-1 ${
          analysis.hasNumber ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}>
          <span>{analysis.hasNumber ? '✓' : '○'} Numbers</span>
        </span>
        <span className={`px-2 py-1 rounded border flex items-center space-x-1 ${
          analysis.hasSymbol ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
        }`}>
          <span>{analysis.hasSymbol ? '✓' : '○'} Symbols</span>
        </span>
      </div>

      {/* Advice list */}
      {analysis.feedback.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <div className="flex items-center space-x-1.5 text-sky-700 dark:text-sky-400 font-semibold mb-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Cyber Hygiene Recommendations:</span>
          </div>
          {analysis.feedback.map((item, idx) => (
            <p key={idx} className="text-slate-600 dark:text-slate-300 leading-relaxed">• {item}</p>
          ))}
        </div>
      )}
    </div>
  );
};
