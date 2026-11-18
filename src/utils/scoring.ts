import { QuizAttempt, UserProgressState, Badge, QuizQuestion } from '../types';

export const ALL_BADGES: Badge[] = [
  {
    id: 'first_step',
    name: 'First Defense',
    description: 'Completed your first security lesson',
    icon: 'Shield',
    tier: 'bronze'
  },
  {
    id: 'all_lessons',
    name: 'Master Scholar',
    description: 'Completed all 5 core cybersecurity modules',
    icon: 'Award',
    tier: 'gold'
  },
  {
    id: 'detective_ace',
    name: 'Phishing Hunter',
    description: 'Inspected and analyzed at least 3 phishing scenarios',
    icon: 'Search',
    tier: 'silver'
  },
  {
    id: 'detective_grandmaster',
    name: 'Eagle Eye',
    description: 'Solved all 5 Phishing Detective scenarios correctly',
    icon: 'Eye',
    tier: 'gold'
  },
  {
    id: 'quiz_starter',
    name: 'Test Taker',
    description: 'Completed your first CyberAware quiz',
    icon: 'FileCheck',
    tier: 'bronze'
  },
  {
    id: 'quiz_high_scorer',
    name: 'Security Shield',
    description: 'Scored 80% or higher on the CyberAware quiz',
    icon: 'Zap',
    tier: 'silver'
  },
  {
    id: 'quiz_perfectionist',
    name: 'Cyber Sentinel',
    description: 'Scored 100% on the comprehensive quiz',
    icon: 'Crown',
    tier: 'platinum'
  },
  {
    id: 'assessment_explorer',
    name: 'Domain Explorer',
    description: 'Completed assessments across multiple cybersecurity domains',
    icon: 'Compass',
    tier: 'bronze'
  },
  {
    id: 'domain_specialist',
    name: 'Security Specialist',
    description: 'Scored 80% or higher on an Advanced or Expert assessment',
    icon: 'ShieldCheck',
    tier: 'gold'
  },
  {
    id: 'grand_architect',
    name: 'Principal Sentinel',
    description: 'Achieved Master score in the comprehensive assessment engine',
    icon: 'Sparkles',
    tier: 'platinum'
  }
];

export function calculateLessonProgress(completedLessonCount: number, totalLessons = 5): number {
  if (totalLessons <= 0) return 0;
  const pct = Math.round((completedLessonCount / totalLessons) * 100);
  return Math.min(100, Math.max(0, pct));
}

export function calculateCyberHygieneScore(state: UserProgressState, totalLessons = 5, totalScenarios = 5): number {
  // Lessons contribute up to 40 points
  const lessonScore = totalLessons > 0 ? (state.completedLessons.length / totalLessons) * 40 : 0;

  // Detective scenarios contribute up to 30 points
  const detectiveScore = totalScenarios > 0 ? (state.solvedScenarios.length / totalScenarios) * 30 : 0;

  // Best quiz score contributes up to 30 points
  let bestQuizPct = 0;
  if (state.quizAttempts.length > 0) {
    bestQuizPct = Math.max(...state.quizAttempts.map(q => q.percentage));
  }
  const quizScore = (bestQuizPct / 100) * 30;

  const total = Math.round(lessonScore + detectiveScore + quizScore);
  return Math.min(100, Math.max(0, total));
}

export function calculateQuizStats(attempts: QuizAttempt[]): {
  totalAttempts: number;
  bestScorePct: number;
  latestScorePct: number;
  averageScorePct: number;
  passedCount: number;
} {
  if (!attempts || attempts.length === 0) {
    return {
      totalAttempts: 0,
      bestScorePct: 0,
      latestScorePct: 0,
      averageScorePct: 0,
      passedCount: 0
    };
  }

  const totalAttempts = attempts.length;
  const bestScorePct = Math.max(...attempts.map(a => a.percentage));
  const latestScorePct = attempts[attempts.length - 1].percentage;
  const sumPct = attempts.reduce((acc, curr) => acc + curr.percentage, 0);
  const averageScorePct = Math.round(sumPct / totalAttempts);
  const passedCount = attempts.filter(a => a.percentage >= 70).length;

  return {
    totalAttempts,
    bestScorePct,
    latestScorePct,
    averageScorePct,
    passedCount
  };
}

export function evaluateQuestionAnswer(
  question: QuizQuestion,
  selectedIndices: number[] = []
): { isCorrect: boolean; partialScore: number; correctCount: number; expectedCount: number } {
  // If question provides correctAnswers array or array correctAnswer (e.g. multi-select or standard)
  const expectedAnswers = (question.correctAnswers && question.correctAnswers.length > 0)
    ? [...question.correctAnswers].sort((a, b) => a - b)
    : (Array.isArray(question.correctAnswer) ? [...(question.correctAnswer as any)].sort((a, b) => a - b) : [question.correctAnswer]);

  const userSelection = [...selectedIndices].sort((a, b) => a - b);

  if (userSelection.length === 0) {
    return {
      isCorrect: false,
      partialScore: 0,
      correctCount: 0,
      expectedCount: expectedAnswers.length
    };
  }

  // Exact match
  const isExactMatch = 
    userSelection.length === expectedAnswers.length &&
    userSelection.every((val, idx) => val === expectedAnswers[idx]);

  // Partial match: how many chosen were correct vs incorrect
  let correctlyChosen = 0;
  let incorrectlyChosen = 0;

  userSelection.forEach(idx => {
    if (expectedAnswers.includes(idx)) {
      correctlyChosen++;
    } else {
      incorrectlyChosen++;
    }
  });

  const netCorrect = Math.max(0, correctlyChosen - incorrectlyChosen);
  const partialScore = Math.round((netCorrect / expectedAnswers.length) * 100);

  return {
    isCorrect: isExactMatch,
    partialScore,
    correctCount: correctlyChosen,
    expectedCount: expectedAnswers.length
  };
}

export function calculateAssessmentDomainBreakdown(
  questions: QuizQuestion[],
  userAnswers: Record<number, number[]>
): Record<string, { correct: number; total: number; percentage: number; topic: string }> {
  const breakdown: Record<string, { correct: number; total: number; percentage: number; topic: string }> = {};

  questions.forEach((q, idx) => {
    const domainKey = q.category || q.topic || 'General Security';
    if (!breakdown[domainKey]) {
      breakdown[domainKey] = {
        correct: 0,
        total: 0,
        percentage: 0,
        topic: q.topic || domainKey
      };
    }
    breakdown[domainKey].total += 1;

    const selected = userAnswers[idx] || [];
    const evaluation = evaluateQuestionAnswer(q, selected);
    if (evaluation.isCorrect) {
      breakdown[domainKey].correct += 1;
    }
  });

  // Calculate percentages
  Object.keys(breakdown).forEach(key => {
    const item = breakdown[key];
    item.percentage = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
  });

  return breakdown;
}

export interface ProficiencyRating {
  tier: 'apprentice' | 'specialist' | 'practitioner' | 'sentinel';
  title: string;
  badgeLabel: string;
  summary: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export function getProficiencyLevel(percentage: number): ProficiencyRating {
  if (percentage >= 90) {
    return {
      tier: 'sentinel',
      title: 'Principal Security Sentinel',
      badgeLabel: 'Master / Principal Level',
      summary: 'Exceptional deep-domain cybersecurity instinct across defensive architecture, threat analysis, and protocols.',
      colorClass: 'text-violet-600 dark:text-violet-400',
      bgClass: 'bg-violet-50 dark:bg-violet-950/40',
      borderClass: 'border-violet-300 dark:border-violet-800'
    };
  }
  if (percentage >= 75) {
    return {
      tier: 'practitioner',
      title: 'Senior Cyber Practitioner',
      badgeLabel: 'Practitioner Level',
      summary: 'Strong analytical skills, solid understanding of attack vectors, incident triage, and secure system configurations.',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderClass: 'border-emerald-300 dark:border-emerald-800'
    };
  }
  if (percentage >= 60) {
    return {
      tier: 'specialist',
      title: 'Security Specialist / Analyst',
      badgeLabel: 'Specialist Level',
      summary: 'Solid grasp of core cybersecurity concepts, common vulnerabilities, and defensive best practices.',
      colorClass: 'text-sky-600 dark:text-sky-400',
      bgClass: 'bg-sky-50 dark:bg-sky-500/10',
      borderClass: 'border-sky-300 dark:border-sky-800'
    };
  }
  return {
    tier: 'apprentice',
    title: 'Foundational Cyber Apprentice',
    badgeLabel: 'Foundational Level',
    summary: 'Developing core awareness. Keep exploring the learning modules and practicing scenario exercises to build instincts.',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-300 dark:border-amber-800'
  };
}

export function evaluateBadges(state: UserProgressState, totalLessons = 5, totalScenarios = 5): string[] {
  const earned = new Set<string>(state.earnedBadges || []);

  if (state.completedLessons.length >= 1) {
    earned.add('first_step');
  }
  if (state.completedLessons.length >= totalLessons) {
    earned.add('all_lessons');
  }
  if (state.solvedScenarios.length >= 3) {
    earned.add('detective_ace');
  }
  if (state.solvedScenarios.length >= totalScenarios) {
    earned.add('detective_grandmaster');
  }
  if (state.quizAttempts.length >= 1) {
    earned.add('quiz_starter');
  }
  if (state.quizAttempts.some(a => a.percentage >= 80)) {
    earned.add('quiz_high_scorer');
  }
  if (state.quizAttempts.some(a => a.percentage === 100)) {
    earned.add('quiz_perfectionist');
  }

  // Assessment engine badges
  const distinctTopics = new Set<string>();
  state.quizAttempts.forEach(attempt => {
    if (attempt.topicBreakdown) {
      Object.keys(attempt.topicBreakdown).forEach(t => distinctTopics.add(t));
    }
  });

  if (distinctTopics.size >= 3 || state.quizAttempts.length >= 3) {
    earned.add('assessment_explorer');
  }

  if (state.quizAttempts.some(a => a.percentage >= 80 && a.total >= 8)) {
    earned.add('domain_specialist');
  }

  if (state.quizAttempts.some(a => a.percentage >= 90 && a.total >= 10)) {
    earned.add('grand_architect');
  }

  return Array.from(earned);
}

export interface BadgeSummaryStats {
  totalAttempts: number;
  bestPercentage: number;
  seenTopics: string[];
  qualifiedDomainSpecialist: boolean;
  qualifiedGrandArchitect: boolean;
}

/**
 * O(1) badge evaluator driven by pre-aggregated user statistics.
 * Produces identical badge sets to evaluateBadges() without scanning full attempt history.
 */
export function evaluateBadgesFromSummary(
  progress: Pick<UserProgressState, 'completedLessons' | 'solvedScenarios' | 'earnedBadges'>,
  stats: BadgeSummaryStats,
  totalLessons = 5,
  totalScenarios = 5
): string[] {
  const earned = new Set<string>(progress.earnedBadges || []);

  if ((progress.completedLessons || []).length >= 1) {
    earned.add('first_step');
  }
  if ((progress.completedLessons || []).length >= totalLessons) {
    earned.add('all_lessons');
  }
  if ((progress.solvedScenarios || []).length >= 3) {
    earned.add('detective_ace');
  }
  if ((progress.solvedScenarios || []).length >= totalScenarios) {
    earned.add('detective_grandmaster');
  }
  if (stats.totalAttempts >= 1) {
    earned.add('quiz_starter');
  }
  if (stats.bestPercentage >= 80) {
    earned.add('quiz_high_scorer');
  }
  if (stats.bestPercentage >= 100) {
    earned.add('quiz_perfectionist');
  }

  const distinctTopicCount = new Set(stats.seenTopics || []).size;
  if (distinctTopicCount >= 3 || stats.totalAttempts >= 3) {
    earned.add('assessment_explorer');
  }

  if (stats.qualifiedDomainSpecialist) {
    earned.add('domain_specialist');
  }

  if (stats.qualifiedGrandArchitect) {
    earned.add('grand_architect');
  }

  return Array.from(earned);
}

export interface PasswordAnalysis {
  score: number; // 0 to 4
  level: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
  feedback: string[];
  crackTimeEstimate: string;
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordAnalysis {
  if (!password) {
    return {
      score: 0,
      level: 'Very Weak',
      feedback: ['Enter a password to check its strength.'],
      crackTimeEstimate: 'Instant',
      hasLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSymbol: false
    };
  }

  const feedback: string[] = [];
  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let points = 0;

  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (password.length >= 16) points++;
  if (hasUpper && hasLower) points++;
  if (hasNumber) points++;
  if (hasSymbol) points++;

  // Penalties for obvious patterns
  const commonWeak = ['password', '123456', 'qwerty', 'admin', 'welcome', 'login', 'letmein'];
  const isCommon = commonWeak.some(w => password.toLowerCase().includes(w));
  if (isCommon) {
    points = Math.max(0, points - 2);
    feedback.push('Contains easily guessable dictionary words or sequences.');
  }

  if (password.length < 8) {
    feedback.push('Too short! Minimum recommended is 12 characters.');
  } else if (password.length < 12) {
    feedback.push('Good length, but 14-16+ characters (or a 4-word passphrase) is even safer.');
  }

  if (!hasUpper || !hasLower) {
    feedback.push('Mix uppercase and lowercase letters.');
  }
  if (!hasNumber) {
    feedback.push('Include numbers.');
  }
  if (!hasSymbol) {
    feedback.push('Include special symbols (!@#$%^&*).');
  }

  if (points >= 5 && password.length >= 14) {
    return {
      score: 4,
      level: 'Very Strong',
      feedback: feedback.length ? feedback : ['Excellent! This passphrase has immense entropy and resistance against cracking.'],
      crackTimeEstimate: 'Thousands of centuries',
      hasLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol
    };
  }

  if (points >= 4) {
    return {
      score: 3,
      level: 'Strong',
      feedback: feedback.length ? feedback : ['Strong password. Safe against automated brute force attacks.'],
      crackTimeEstimate: 'Years to decades',
      hasLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol
    };
  }

  if (points >= 3) {
    return {
      score: 2,
      level: 'Moderate',
      feedback,
      crackTimeEstimate: 'A few days to weeks',
      hasLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol
    };
  }

  if (points >= 2) {
    return {
      score: 1,
      level: 'Weak',
      feedback,
      crackTimeEstimate: 'Minutes to hours',
      hasLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol
    };
  }

  return {
    score: 0,
    level: 'Very Weak',
    feedback,
    crackTimeEstimate: 'Seconds or instant',
    hasLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol
  };
}

/**
 * Option-level detailed explanation structure providing clear rationale
 * for both correct answers and incorrect distractors.
 */
export interface OptionAnalysis {
  optionIndex: number;
  optionText: string;
  isCorrect: boolean;
  label: string;
  badgeClass: string;
  rationale: string;
}

export function getOptionAnalysis(
  question: QuizQuestion,
  optionIndex: number,
  userSelectedIndices: number[] = []
): OptionAnalysis {
  const expectedAnswers = question.correctAnswers && question.correctAnswers.length > 0
    ? question.correctAnswers
    : [question.correctAnswer];
  
  const isCorrect = expectedAnswers.includes(optionIndex);
  const isUserSelected = userSelectedIndices.includes(optionIndex);
  const optionText = question.options[optionIndex] || `Option ${optionIndex + 1}`;

  // If question provides explicit distractor explanation
  if (!isCorrect && question.distractorExplanations && question.distractorExplanations[optionIndex]) {
    return {
      optionIndex,
      optionText,
      isCorrect: false,
      label: isUserSelected ? 'Selected (Flawed Approach)' : 'Incorrect Alternative',
      badgeClass: isUserSelected
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      rationale: question.distractorExplanations[optionIndex]
    };
  }

  if (isCorrect) {
    return {
      optionIndex,
      optionText,
      isCorrect: true,
      label: isUserSelected ? 'Correct Selection' : 'Accurate / Standard-Compliant Choice',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      rationale: question.explanation || 'This option represents the defensible, standards-compliant countermeasure based on established security frameworks.'
    };
  }

  // Generate targeted educational rationale for distractor
  let distractorRationale = '';
  const optLower = optionText.toLowerCase();

  if (optLower.includes('sms') || optLower.includes('text message')) {
    distractorRationale = 'SMS verification is vulnerable to SIM-swapping, SS7 telecom routing interception, and lack of cryptographic domain binding.';
  } else if (optLower.includes('restart') || optLower.includes('reboot') || optLower.includes('wipe')) {
    distractorRationale = 'Premature rebooting or wiping destroys volatile memory (RAM), forensic evidence, active command-and-control sockets, and malicious running processes.';
  } else if (optLower.includes('vpn') && (optLower.includes('sufficient') || optLower.includes('replace'))) {
    distractorRationale = 'A VPN encrypts the transport channel but does not inspect payload contents or prevent authenticated lateral traversal in a Zero Trust environment.';
  } else if (optLower.includes('ignore') || optLower.includes('delete without')) {
    distractorRationale = 'Ignoring alerts or deleting suspicious material without reporting leaves security teams blind to active adversary reconnaissance campaigns.';
  } else if (optLower.includes('client-side') || optLower.includes('frontend')) {
    distractorRationale = 'Client-side controls can be easily bypassed by attackers intercepting or crafting raw HTTP/API requests using proxies like Burp Suite.';
  } else if (optLower.includes('shared') || optLower.includes('hardcoded') || optLower.includes('default')) {
    distractorRationale = 'Hardcoded secrets, shared credentials, and default accounts violate least privilege and create instant vulnerability to credential stuffing.';
  } else {
    distractorRationale = `This choice does not mitigate the underlying risk. In professional security operations, relying on this action fails to satisfy the technical requirement outlined in ${question.referenceFramework || question.provenance || 'NIST guidelines'}.`;
  }

  return {
    optionIndex,
    optionText,
    isCorrect: false,
    label: isUserSelected ? 'Selected (Flawed Mitigation)' : 'Incorrect Option',
    badgeClass: isUserSelected
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    rationale: distractorRationale
  };
}

export interface WeakTopicRecommendation {
  topicKey: string;
  topicLabel: string;
  accuracy: number;
  totalAnswered: number;
  correctCount: number;
  urgency: 'high' | 'medium' | 'good';
  suggestedLessonId?: string;
  suggestedLessonTitle?: string;
  suggestedDrillTopic: string;
  remediationAdvice: string;
}

const TOPIC_LESSON_MAP: Record<string, { lessonId: string; lessonTitle: string; advice: string }> = {
  security_awareness_identity: {
    lessonId: 'phishing_101',
    lessonTitle: 'Phishing & Email Deception',
    advice: 'Review email header provenance (SPF/DKIM/DMARC), MFA authentication factors, and credential hygiene practices.'
  },
  network_security: {
    lessonId: 'safe_browsing',
    lessonTitle: 'Safe Browsing & Network Hygiene',
    advice: 'Reinforce TLS handshake mechanics, DNSSEC, packet inspection, and Zero Trust microsegmentation principles.'
  },
  os_endpoint_security: {
    lessonId: 'mfa_security',
    lessonTitle: 'Multi-Factor Authentication (MFA)',
    advice: 'Deepen understanding of Active Directory Kerberos delegation, Linux permission baselines, and EDR process telemetry.'
  },
  web_appsec: {
    lessonId: 'safe_browsing',
    lessonTitle: 'Safe Browsing & Network Hygiene',
    advice: 'Study OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, IDOR) and server-side input sanitization/parameterization.'
  },
  pentest_methodology: {
    lessonId: 'social_engineering',
    lessonTitle: 'Social Engineering & Human Hacking',
    advice: 'Focus on scoping boundaries, OSINT passive reconnaissance, and systematic vulnerability remediation reporting.'
  },
  soc_incident_response: {
    lessonId: 'safe_browsing',
    lessonTitle: 'Safe Browsing & Network Hygiene',
    advice: 'Master the 6-step PICERL incident response lifecycle, SIEM log correlation, and volatile memory preservation.'
  },
  malware_ransomware: {
    lessonId: 'safe_browsing',
    lessonTitle: 'Safe Browsing & Network Hygiene',
    advice: 'Study MITRE ATT&CK persistence mechanisms, ransomware kill-chains, and offline immutable backup strategies.'
  },
  cloud_devsecops: {
    lessonId: 'mfa_security',
    lessonTitle: 'Multi-Factor Authentication (MFA)',
    advice: 'Revisit cloud IAM least-privilege policies, container isolation baselines, and pipeline secrets scanning.'
  },
  cryptography_pki: {
    lessonId: 'password_security',
    lessonTitle: 'Password Security & Passphrases',
    advice: 'Review cryptographic primitives: asymmetric RSA/ECC vs symmetric AES-GCM, salt/pepper hashing, and PKI trust chains.'
  },
  governance_risk_privacy: {
    lessonId: 'social_engineering',
    lessonTitle: 'Social Engineering & Human Hacking',
    advice: 'Strengthen threat modeling methodologies (STRIDE), quantitative risk scoring, and privacy compliance frameworks.'
  },
  emerging_threats_research: {
    lessonId: 'safe_browsing',
    lessonTitle: 'Safe Browsing & Network Hygiene',
    advice: 'Examine software supply chain attestations (SLSA/SBOM), AI prompt injection mitigations, and zero-day triage.'
  }
};

/**
 * Analyzes previous performance across attempts and history to detect weak domains
 * and provide actionable remediation suggestions.
 */
export function identifyWeakTopicsAndRecommendations(
  attempts: QuizAttempt[],
  userHistory?: {
    answeredResults?: Record<string, { isCorrect: boolean }>;
  } | null
): WeakTopicRecommendation[] {
  const domainTotals: Record<string, { correct: number; total: number; label: string }> = {};

  // Aggregate from past QuizAttempts
  attempts.forEach(attempt => {
    if (attempt.topicBreakdown) {
      Object.entries(attempt.topicBreakdown).forEach(([domain, stats]) => {
        if (!domainTotals[domain]) {
          domainTotals[domain] = { correct: 0, total: 0, label: domain };
        }
        domainTotals[domain].correct += stats.correct;
        domainTotals[domain].total += stats.total;
      });
    }
  });

  const recommendations: WeakTopicRecommendation[] = [];

  Object.entries(domainTotals).forEach(([domainKey, stats]) => {
    if (stats.total === 0) return;
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    const mapping = TOPIC_LESSON_MAP[domainKey] || {
      lessonId: 'phishing_101',
      lessonTitle: 'Core Cyber Defense Foundations',
      advice: 'Review defensive fundamentals and practice targeted scenario questions in this domain.'
    };

    let urgency: 'high' | 'medium' | 'good' = 'good';
    if (accuracy < 60) {
      urgency = 'high';
    } else if (accuracy < 75) {
      urgency = 'medium';
    }

    // Include topics that have room for improvement or have been attempted
    recommendations.push({
      topicKey: domainKey,
      topicLabel: domainKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      accuracy,
      totalAnswered: stats.total,
      correctCount: stats.correct,
      urgency,
      suggestedLessonId: mapping.lessonId,
      suggestedLessonTitle: mapping.lessonTitle,
      suggestedDrillTopic: domainKey,
      remediationAdvice: mapping.advice
    });
  });

  // Sort by urgency (high first, then medium, then by accuracy ascending)
  return recommendations.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, good: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.accuracy - b.accuracy;
  });
}

export interface DomainMasterySummary {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  percentage: number;
  masteryTier: 'novice' | 'developing' | 'proficient' | 'master';
  tierLabel: string;
  badgeClass: string;
  lessonId?: string;
  lessonTitle?: string;
}

export function calculateComprehensiveMastery(
  attempts: QuizAttempt[],
  allCategoryKeys: string[]
): Record<string, DomainMasterySummary> {
  const result: Record<string, DomainMasterySummary> = {};

  allCategoryKeys.forEach(key => {
    const mapping = TOPIC_LESSON_MAP[key];
    result[key] = {
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      attempted: 0,
      correct: 0,
      percentage: 0,
      masteryTier: 'novice',
      tierLabel: 'Novice (Needs Practice)',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      lessonId: mapping?.lessonId,
      lessonTitle: mapping?.lessonTitle
    };
  });

  // Aggregate
  attempts.forEach(attempt => {
    if (attempt.topicBreakdown) {
      Object.entries(attempt.topicBreakdown).forEach(([k, stats]) => {
        if (!result[k]) {
          const mapping = TOPIC_LESSON_MAP[k];
          result[k] = {
            key: k,
            label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            attempted: 0,
            correct: 0,
            percentage: 0,
            masteryTier: 'novice',
            tierLabel: 'Novice (Needs Practice)',
            badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            lessonId: mapping?.lessonId,
            lessonTitle: mapping?.lessonTitle
          };
        }
        result[k].attempted += stats.total;
        result[k].correct += stats.correct;
      });
    }
  });

  // Calculate percentage and mastery tier
  Object.keys(result).forEach(key => {
    const item = result[key];
    if (item.attempted > 0) {
      item.percentage = Math.round((item.correct / item.attempted) * 100);
      if (item.percentage >= 90) {
        item.masteryTier = 'master';
        item.tierLabel = 'Master / Sentinel';
        item.badgeClass = 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-300 dark:border-violet-800';
      } else if (item.percentage >= 75) {
        item.masteryTier = 'proficient';
        item.tierLabel = 'Proficient';
        item.badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      } else if (item.percentage >= 50) {
        item.masteryTier = 'developing';
        item.tierLabel = 'Developing';
        item.badgeClass = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-800';
      } else {
        item.masteryTier = 'novice';
        item.tierLabel = 'Novice (Needs Practice)';
        item.badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      }
    }
  });

  return result;
}

