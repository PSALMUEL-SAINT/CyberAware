import React, { useState } from 'react';
import { 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Paperclip, 
  ExternalLink, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Info,
  Smartphone,
  RotateCcw
} from 'lucide-react';
import { PhishingScenario } from '../types';
import { PHISHING_SCENARIOS } from '../data/phishingScenarios';

interface PhishingDetectiveProps {
  solvedScenarios: string[];
  onSolveScenario: (scenarioId: string) => void;
}

export const PhishingDetectiveView: React.FC<PhishingDetectiveProps> = ({
  solvedScenarios,
  onSolveScenario
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(PHISHING_SCENARIOS[0].id);
  const [inspectMode, setInspectMode] = useState<boolean>(false);
  const [userVerdict, setUserVerdict] = useState<'phishing' | 'legit' | null>(null);
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const scenario = PHISHING_SCENARIOS.find(s => s.id === selectedScenarioId) || PHISHING_SCENARIOS[0];

  const handleSelectScenario = (id: string) => {
    setSelectedScenarioId(id);
    setInspectMode(false);
    setUserVerdict(null);
    setIsEvaluated(false);
    setHoveredLink(null);
  };

  const handleSubmitVerdict = (verdict: 'phishing' | 'legit') => {
    setUserVerdict(verdict);
    setIsEvaluated(true);
    setInspectMode(true);

    const isCorrect = (verdict === 'phishing' && scenario.isPhishing) || (verdict === 'legit' && !scenario.isPhishing);
    if (isCorrect) {
      onSolveScenario(scenario.id);
    }
  };

  const handleResetCurrent = () => {
    setUserVerdict(null);
    setIsEvaluated(false);
    setInspectMode(false);
  };

  const isUserCorrect = isEvaluated && (
    (userVerdict === 'phishing' && scenario.isPhishing) ||
    (userVerdict === 'legit' && !scenario.isPhishing)
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Spot the Threat
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Practice identifying phishing emails and deceptive text messages in a safe simulation.
          </p>
        </div>

        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 self-start sm:self-center">
          Solved: {solvedScenarios.length} of {PHISHING_SCENARIOS.length}
        </span>
      </div>

      {/* Case Selector Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {PHISHING_SCENARIOS.map((sc, index) => {
          const isSelected = sc.id === scenario.id;
          const isSolved = solvedScenarios.includes(sc.id);

          return (
            <button
              key={sc.id}
              onClick={() => handleSelectScenario(sc.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                isSelected
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>Case {index + 1} ({sc.channel.toUpperCase()})</span>
              {isSolved && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Investigation Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Simulated Message (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {/* Top Toolbar */}
            <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {scenario.channel === 'email' ? 'Simulated Email Client' : 'Simulated Text Message'}
              </span>

              <button
                onClick={() => setInspectMode(!inspectMode)}
                className={`text-[11px] px-2.5 py-1 rounded font-medium border flex items-center space-x-1 transition-colors ${
                  inspectMode 
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{inspectMode ? 'Hide Clues' : 'Highlight Clues'}</span>
              </button>
            </div>

            {/* Email Header */}
            {scenario.channel === 'email' ? (
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2 text-xs">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {scenario.subject}
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div className={`p-1.5 rounded ${
                    inspectMode && scenario.redFlags.some(rf => rf.targetElement === 'sender')
                      ? 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-medium'
                      : ''
                  }`}>
                    <strong>From: </strong>{scenario.senderDisplay} &lt;{scenario.senderAddress}&gt;
                  </div>
                  <div>
                    <strong>Date: </strong>{scenario.dateStr}
                  </div>
                </div>

                {scenario.attachment && (
                  <div className="mt-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-mono">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span>{scenario.attachment.fileName}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Download Disabled</span>
                  </div>
                )}
              </div>
            ) : (
              /* SMS Header */
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center space-x-2 text-xs">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-slate-900 dark:text-white">{scenario.senderDisplay}</span>
                <span className="text-slate-400">({scenario.senderAddress})</span>
              </div>
            )}

            {/* Message Body */}
            <div className="p-4 sm:p-6 space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              {scenario.bodyText.map((p, pIdx) => {
                const isUrgency = (pIdx === 1 || pIdx === 2) && inspectMode && scenario.redFlags.some(rf => rf.targetElement === 'urgency');
                return (
                  <p key={pIdx} className={isUrgency ? 'bg-amber-100 dark:bg-amber-950/60 p-2 rounded border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200' : ''}>
                    {p}
                  </p>
                );
              })}

              {/* Simulated Link */}
              {scenario.simulatedLink && (
                <div className="pt-2">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredLink(scenario.simulatedLink?.hoverUrl || null)}
                      onMouseLeave={() => setHoveredLink(null)}
                      onClick={() => setHoveredLink(scenario.simulatedLink?.hoverUrl || null)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center space-x-1.5 ${
                        inspectMode && scenario.simulatedLink.isSuspicious
                          ? 'bg-rose-100 dark:bg-rose-950 border border-rose-400 text-rose-900 dark:text-rose-200'
                          : 'bg-sky-600 hover:bg-sky-500 text-white'
                      }`}
                    >
                      <span>{scenario.simulatedLink.anchorText}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    {/* Safe Hover Preview */}
                    {hoveredLink && (
                      <div className="absolute left-0 bottom-full mb-2 z-20 w-72 sm:w-80 p-3 rounded-xl bg-white dark:bg-slate-950 border border-sky-400 dark:border-sky-500 text-xs shadow-xl animate-fadeIn">
                        <span className="font-bold text-sky-700 dark:text-sky-400 block mb-1">🔍 Destination URL Preview:</span>
                        <p className="font-mono text-emerald-800 dark:text-emerald-300 break-all bg-slate-50 dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                          {hoveredLink}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                    <Info className="w-3 h-3" />
                    <span>Hover to preview link destination without clicking.</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detective Decision & Feedback (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3.5 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Your Verdict
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Is this message an authentic communication or a phishing attempt?
            </p>

            {!isEvaluated ? (
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleSubmitVerdict('phishing')}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-semibold text-xs flex items-center justify-center space-x-2 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Flag as Threat (Phishing)</span>
                </button>
                <button
                  onClick={() => handleSubmitVerdict('legit')}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold text-xs flex items-center justify-center space-x-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Mark as Safe (Legitimate)</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs animate-fadeIn">
                <div className={`p-3 rounded-xl border flex items-center space-x-2 ${
                  isUserCorrect 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200' 
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                }`}>
                  {isUserCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span className="font-semibold">
                    {isUserCorrect ? 'Correct analysis!' : 'Incorrect verdict.'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <strong className="text-slate-900 dark:text-white block">Safe Handling:</strong>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{scenario.safeAction}</p>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={handleResetCurrent}
                    className="w-1/2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Try Again</span>
                  </button>

                  <button
                    onClick={() => {
                      const nextIdx = (PHISHING_SCENARIOS.findIndex(s => s.id === scenario.id) + 1) % PHISHING_SCENARIOS.length;
                      handleSelectScenario(PHISHING_SCENARIOS[nextIdx].id);
                    }}
                    className="w-1/2 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center space-x-1"
                  >
                    <span>Next Case</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clues Breakdown */}
          {scenario.redFlags.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Identified Warning Signs ({scenario.redFlags.length})</span>
              </h4>

              <div className="space-y-2">
                {scenario.redFlags.map(rf => (
                  <div key={rf.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-0.5">
                    <span className="font-semibold text-amber-800 dark:text-amber-400 block">{rf.title}</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">{rf.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
