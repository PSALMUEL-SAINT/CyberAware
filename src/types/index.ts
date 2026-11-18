export type ActiveTab = 
  | 'landing'
  | 'dashboard' 
  | 'learning' 
  | 'lessons' 
  | 'quiz' 
  | 'detective' 
  | 'progress' 
  | 'groups' 
  | 'leaderboard' 
  | 'profile' 
  | 'settings' 
  | 'about';

export interface LessonSection {
  title: string;
  content: string[];
  takeaway: string;
  warningNotice?: string;
  practicalExample?: {
    good: string;
    bad: string;
    explanation: string;
  };
}

export interface LessonModule {
  id: string;
  title: string;
  subtitle: string;
  category: 'authentication' | 'phishing' | 'passwords' | 'social_engineering' | 'safe_browsing';
  readTimeMinutes: number;
  iconName: string;
  summary: string;
  sections: LessonSection[];
  actionChecklist: string[];
}

export type QuestionDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type QuestionType = 
  | 'multiple_choice'
  | 'select_all'
  | 'scenario'
  | 'log_analysis'
  | 'code_review'
  | 'troubleshooting';

export type AssessmentCategoryKey =
  | 'security_awareness_identity'
  | 'network_security'
  | 'os_endpoint_security'
  | 'web_appsec'
  | 'pentest_methodology'
  | 'soc_incident_response'
  | 'malware_ransomware'
  | 'cloud_devsecops'
  | 'cryptography_pki'
  | 'governance_risk_privacy'
  | 'emerging_threats_research';

export interface AssessmentCategoryMeta {
  key: AssessmentCategoryKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  subcategories: string[];
}

export type ReviewStatus = 'verified' | 'peer_reviewed' | 'draft' | 'community_submitted';

export interface QuizQuestion {
  id: string;
  topic: string; // High-level topic title (e.g. "Network Security", "Phishing & Identity")
  category: AssessmentCategoryKey | string;
  subcategory: string;
  subtopic?: string; // Explicit subtopic field
  difficulty: QuestionDifficulty;
  type: QuestionType;
  questionType?: QuestionType; // Alias for explicit compatibility
  question: string;
  scenario?: string; // backwards compatibility
  scenarioText?: string;
  logSnippet?: {
    source: string;
    log: string;
  };
  codeSnippet?: {
    language: string;
    code: string;
    highlightLines?: number[];
  };
  options: string[];
  correctAnswer: number; // Index of correct option (or primary answer)
  correctAnswers?: number[]; // Array of indices for multi-select
  explanation: string; // Detailed rationale
  tips?: string;
  distractorExplanations?: Record<number, string>;
  mitigation?: string;
  referenceFramework?: string; // e.g. "OWASP A03:2021", "MITRE ATT&CK T1059"
  provenance?: string; // Provenance/source standard citation (e.g. "NIST SP 800-63B / RFC 6238")
  reviewStatus?: ReviewStatus; // Review status ('verified', 'peer_reviewed', 'draft', etc.)
  creationDate?: string; // ISO 8601 creation timestamp
  lastVerifiedDate?: string; // ISO 8601 verification timestamp
  isCustom?: boolean; // Flag if user-created or dynamically generated
}

/**
 * Strict database record guaranteeing all 12 mandatory attributes
 */
export interface AssessmentDatabaseRecord extends QuizQuestion {
  subtopic: string;
  provenance: string;
  reviewStatus: ReviewStatus;
  creationDate: string;
  lastVerifiedDate: string;
}

export interface QuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QuestionBankStats {
  total: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<QuestionDifficulty, number>;
  byReviewStatus: Record<ReviewStatus, number>;
  customCount: number;
}


export interface RedFlag {
  id: string;
  title: string;
  description: string;
  targetElement: 'sender' | 'subject' | 'urgency' | 'link' | 'attachment' | 'grammar' | 'greeting';
}

export interface PhishingScenario {
  id: string;
  title: string;
  channel: 'email' | 'sms';
  senderDisplay: string;
  senderAddress: string;
  subject: string;
  dateStr: string;
  bodyText: string[];
  simulatedLink?: {
    anchorText: string;
    hoverUrl: string;
    isSuspicious: boolean;
  };
  attachment?: {
    fileName: string;
    fileSize: string;
    isSuspicious: boolean;
  };
  isPhishing: boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  redFlags: RedFlag[];
  safeAction: string;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  attemptId?: string;
  userId?: string;
  date: string;
  timestamp?: string;
  score: number;
  total: number;
  percentage: number;
  mode: 'practice' | 'exam';
  difficulty?: QuestionDifficulty | 'mixed';
  categoryFilter?: string;
  topicBreakdown: Record<string, { correct: number; total: number; percentage?: number }>;
  questionsAttempted?: string[];
  userAnswers?: Record<number, number[]>;
  questionAnswers?: Record<string, number[]> | Array<{ questionId: string; selectedOptions: number[] }>;
  verifiedAnswers?: Record<string, {
    isCorrect: boolean;
    expectedAnswers: number[];
    selectedAnswers: number[];
  }>;
  timeTakenSeconds?: number;
  completionDuration?: number;
  verifiedByServer?: boolean;
}

export interface UserProgressState {
  completedLessons: string[];
  completedChecklists: Record<string, string[]>; // lessonId -> itemIds
  quizAttempts: QuizAttempt[];
  solvedScenarios: string[];
  earnedBadges: string[];
  streakDays: number;
  lastVisitDate: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export type GroupRole = 'admin' | 'member';

export interface GroupMember {
  userId: string;
  userName: string;
  role: GroupRole;
  joinedAt: string;
  assessmentCount?: number;
  lastActive?: string;
  participationStatus?: 'active' | 'pending' | 'completed_assessments';
}

export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  isPublic?: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  isMember: boolean;
  currentUserRole?: GroupRole;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  role: GroupRole;
  totalPoints: number;
  completedAssessments: number;
  averageScore: number;
  highestScore: number;
  latestParticipationDate: string;
  joinedAt: string;
  isCurrentUser?: boolean;
}

export interface GroupLeaderboardResponse {
  success: boolean;
  groupId: string;
  groupName: string;
  inviteCode: string;
  memberCount: number;
  generatedAt: string;
  currentUserRank: number | null;
  leaderboard: LeaderboardEntry[];
  error?: string;
}

export interface UserStanding {
  groupId: string;
  groupName: string;
  inviteCode: string;
  rank: number;
  totalMembers: number;
  totalPoints: number;
  averageScore: number;
  completedAssessments: number;
}

export interface UserStandingsResponse {
  success: boolean;
  userId: string;
  standings: UserStanding[];
  error?: string;
}


