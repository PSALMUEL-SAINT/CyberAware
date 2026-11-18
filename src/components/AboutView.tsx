import React from 'react';
import { 
  ShieldCheck, 
  Info, 
  CheckCircle2, 
  Users, 
  ExternalLink, 
  Lock, 
  ArrowRight,
  Shield,
  Lightbulb
} from 'lucide-react';
import { ActiveTab } from '../types';

interface AboutViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  const goldenRules = [
    {
      title: 'Inspect Before You Click',
      desc: 'Hover over or long-press links to inspect the actual destination domain before clicking.'
    },
    {
      title: 'Length Beats Convoluted Complexity',
      desc: 'A 4-word passphrase (e.g. "coffee-tulip-galaxy-winter") takes centuries to brute-force, while an 8-character password can be cracked quickly.'
    },
    {
      title: 'Enable MFA Everywhere Possible',
      desc: 'Multi-factor authentication (especially via Authenticator apps) blocks over 99% of automated credential attacks.'
    },
    {
      title: 'Never Reuse Passwords',
      desc: 'If one forum suffers a breach, attackers will immediately test that password against your email and banking.'
    },
    {
      title: 'Pause on Artificial Panic',
      desc: 'Scammers pressure you with tight deadlines to stop you from thinking critically. Slow down and verify.'
    },
    {
      title: 'Verify Out-of-Band',
      desc: 'If an email asks for urgent gift cards or direct deposit changes, call the person directly on a trusted phone number.'
    },
    {
      title: 'HTTPS Means Encrypted, Not Safe',
      desc: 'HTTPS encrypts data in transit, but cybercriminals put SSL certificates on phishing sites too.'
    },
    {
      title: 'Treat Public Wi-Fi as Untrusted',
      desc: 'Avoid logging into banking on unencrypted open cafe or airport Wi-Fi without a VPN or mobile hotspot.'
    },
    {
      title: 'Audit Browser Extensions',
      desc: 'Rogue browser extensions can read data across visited sites. Remove extensions you do not actively use.'
    },
    {
      title: 'Safely Store Recovery Codes',
      desc: 'Print or save your MFA backup recovery codes in an encrypted or physical location—never in a plaintext note.'
    }
  ];

  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          About CyberAware
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          Demystifying online safety with practical, beginner-friendly cybersecurity education.
        </p>
      </div>

      {/* Prominent Educational Disclaimer */}
      <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 space-y-2">
        <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Educational Platform Notice</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <strong>No Professional Certification:</strong> CyberAware is a free educational tool designed to improve personal cybersecurity awareness and digital hygiene. It does not confer accredited professional industry certifications (such as CISSP, CompTIA Security+, or CEH) nor does it provide formal commercial security audits.
        </p>
      </div>

      {/* Core Mission */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Our Mission</h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          CyberAware was created for students, families, and everyday internet users. In a world where automated botnets and phishing attacks target millions of inboxes daily, practical digital hygiene shouldn't require an IT degree.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          All progress data is stored locally in your browser (via <code className="text-sky-600 dark:text-sky-400">localStorage</code>) with zero third-party tracking or account requirements.
        </p>
      </div>

      {/* 10 Golden Rules */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">The 10 Golden Rules of Digital Defense</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Memorize these principles to prevent the vast majority of consumer cyber attacks.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {goldenRules.map((rule, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-xs text-slate-900 dark:text-white">{rule.title}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-6">{rule.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Public Resources */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Trusted Public Resources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <a 
            href="https://www.cisa.gov/resources-tools" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:text-sky-600"
          >
            <span>CISA Cyber Tips</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a 
            href="https://ssd.eff.org" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300 hover:text-sky-600"
          >
            <span>EFF Surveillance Self-Defense</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
