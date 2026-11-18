import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { QuizQuestion, QuestionDifficulty, QuizAttempt, SecurityGroup, GroupMember, UserProgressState } from './src/types';
import { QUIZ_QUESTIONS } from './src/data/quizData';
import { selectAssessmentQuestions, UserAssessmentHistory } from './src/utils/assessmentSelection';
import { checkForDuplicates } from './src/utils/duplicateDetector';
import { validateQuestion, normalizeQuestionRecord } from './src/utils/questionValidation';
import {
  validateAssessmentSubmission,
  calculateVerifiedAssessmentScore,
  checkDuplicateAttempt,
  DEFAULT_DEMO_USER
} from './src/utils/assessmentAttempts';
import { evaluateBadges } from './src/utils/scoring';
import {
  validateGroupCreation,
  createGroupRecord,
  validateJoinGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  enrichMemberParticipation,
  toGroupSummary
} from './src/utils/groupManagement';
import {
  calculateGroupLeaderboard,
  canAccessGroupLeaderboard,
  calculateUserStandings
} from './src/utils/groupLeaderboard';
import {
  UserAccount,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationPayload,
  evaluatePasswordEntropy,
  SESSION_TTL_MS,
  PUBLIC_REGISTRATION_ALLOWED_ROLES,
  QUESTION_REVIEWER_ROLES,
  isSessionTokenFormatValid,
  isSessionRecordExpired
} from './src/utils/authUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;

const app = express();

function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  }
  return 3000;
}

const PORT = resolvePort();
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Persistent server data storage paths
const DATA_DIR = path.join(ROOT_DIR, 'server-data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USER_HISTORY_FILE = path.join(DATA_DIR, 'user_history.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions_bank.json');
const ATTEMPTS_FILE = path.join(DATA_DIR, 'attempts.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Helper to read / write persistent JSON data
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Clean progress generator for fresh accounts
function createCleanProgressState(): UserProgressState {
  return {
    completedLessons: [],
    completedChecklists: {},
    quizAttempts: [],
    solvedScenarios: [],
    earnedBadges: [],
    streakDays: 0,
    lastVisitDate: new Date().toISOString().split('T')[0]
  };
}

// In-memory / persistent stores
let userHistories: Record<string, UserAssessmentHistory> = readJsonFile(USER_HISTORY_FILE, {});
let serverQuestions: QuizQuestion[] = readJsonFile(QUESTIONS_FILE, QUIZ_QUESTIONS);
let userAttemptsStore: Record<string, QuizAttempt[]> = readJsonFile(ATTEMPTS_FILE, {});
let groupsStore: SecurityGroup[] = readJsonFile(GROUPS_FILE, []);
let usersStore: Record<string, UserAccount> = readJsonFile(USERS_FILE, {});
let userProgressStore: Record<string, UserProgressState> = readJsonFile(PROGRESS_FILE, {});

// Active session token mapping: token -> { userId, createdAt, expiresAt }
// Stored persistently in server-data/sessions.json so sessions survive development server reboots.
// NOTE: JSON file storage is intended for single-instance/dev usage; multi-instance production requires shared session storage (e.g., Redis/Firestore/SQL).
interface StoredSessionRecord {
  userId: string;
  createdAt: number;
  expiresAt?: number;
}

let activeSessions: Record<string, StoredSessionRecord> = readJsonFile(SESSIONS_FILE, {});

// Remove any legacy hardcoded static demo_token_* entries or already-expired records on startup
let cleanedStartupSessions = false;
for (const [tok, rec] of Object.entries(activeSessions)) {
  if (!isSessionTokenFormatValid(tok) || isSessionRecordExpired(rec)) {
    delete activeSessions[tok];
    cleanedStartupSessions = true;
  }
}
if (cleanedStartupSessions) {
  writeJsonFile(SESSIONS_FILE, activeSessions);
}

function pruneInvalidSessions(sessions: Record<string, StoredSessionRecord>): boolean {
  let changed = false;
  const now = Date.now();
  for (const [tok, rec] of Object.entries(sessions)) {
    if (!isSessionTokenFormatValid(tok) || isSessionRecordExpired(rec, now)) {
      delete sessions[tok];
      changed = true;
    }
  }
  return changed;
}

function persistSession(token: string, userId: string): void {
  activeSessions = readJsonFile(SESSIONS_FILE, {});
  pruneInvalidSessions(activeSessions);
  const now = Date.now();
  activeSessions[token] = { userId, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  writeJsonFile(SESSIONS_FILE, activeSessions);
}

function removeSession(token: string): void {
  activeSessions = readJsonFile(SESSIONS_FILE, {});
  if (token && activeSessions[token]) {
    delete activeSessions[token];
    writeJsonFile(SESSIONS_FILE, activeSessions);
  }
}

function revokeUserSessions(userId: string): void {
  if (!userId) return;
  const target = userId.toLowerCase().trim();
  activeSessions = readJsonFile(SESSIONS_FILE, {});
  let changed = false;
  for (const [tok, rec] of Object.entries(activeSessions)) {
    if (rec?.userId && rec.userId.toLowerCase().trim() === target) {
      delete activeSessions[tok];
      changed = true;
    }
  }
  if (changed) {
    writeJsonFile(SESSIONS_FILE, activeSessions);
  }
}

/**
 * Strict User Lookup helper.
 * Searches usersStore strictly by normalized email or id (never by display name).
 */
function findUserByEmailOrId(identifier: string): UserAccount | undefined {
  if (!identifier || typeof identifier !== 'string') return undefined;
  const clean = identifier.toLowerCase().trim();
  if (!clean) return undefined;
  usersStore = readJsonFile(USERS_FILE, usersStore);

  if (usersStore[clean]) return usersStore[clean];
  if (usersStore[identifier.trim()]) return usersStore[identifier.trim()];

  return Object.values(usersStore).find(
    u =>
      (u.email && u.email.toLowerCase().trim() === clean) ||
      (u.id && u.id.toLowerCase().trim() === clean)
  );
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Extracts and verifies caller credentials from request headers with strict user isolation.
 * Always reloads SESSIONS_FILE so revoked or expired sessions cannot remain active in memory.
 * Rejects malformed, static demo_token_*, revoked, and expired tokens.
 */
function getVerifiedCallerId(req: Request): { callerId: string; token: string | null; isAuthenticated: boolean } {
  const token = extractBearerToken(req);
  if (!token || !isSessionTokenFormatValid(token)) {
    return { callerId: '', token: null, isAuthenticated: false };
  }

  activeSessions = readJsonFile(SESSIONS_FILE, {});
  const session = activeSessions[token];
  if (!session || !session.userId) {
    return { callerId: '', token: null, isAuthenticated: false };
  }

  if (isSessionRecordExpired(session)) {
    delete activeSessions[token];
    writeJsonFile(SESSIONS_FILE, activeSessions);
    return { callerId: '', token: null, isAuthenticated: false };
  }

  const user = findUserByEmailOrId(session.userId);
  if (!user) {
    return { callerId: '', token: null, isAuthenticated: false };
  }

  return { callerId: user.id, token, isAuthenticated: true };
}

// Rate limiter for /api/questions/propose
// Enforces a strict sliding window limit per authenticated user
interface RateLimitEntry {
  timestamps: number[];
}
const aiQuestionRateLimiter: Map<string, RateLimitEntry> = new Map();
const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const AI_RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per 60 seconds per user

function checkAiQuestionRateLimit(userId: string): { allowed: boolean; retryAfterSeconds: number; currentUsage: number } {
  const now = Date.now();
  const entry = aiQuestionRateLimiter.get(userId) || { timestamps: [] };

  // Evict timestamps older than the sliding window
  const activeTimestamps = entry.timestamps.filter(ts => now - ts < AI_RATE_LIMIT_WINDOW_MS);

  if (activeTimestamps.length >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const oldest = activeTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + AI_RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds, currentUsage: activeTimestamps.length };
  }

  activeTimestamps.push(now);
  aiQuestionRateLimiter.set(userId, { timestamps: activeTimestamps });
  return { allowed: true, retryAfterSeconds: 0, currentUsage: activeTimestamps.length };
}

// Seed default persistent users if empty
if (!usersStore || Object.keys(usersStore).length === 0) {
  const defaultPass = 'CyberAware2026!';
  const { salt: s1, hash: h1 } = hashPassword(defaultPass);
  const { salt: s2, hash: h2 } = hashPassword(defaultPass);
  const { salt: s3, hash: h3 } = hashPassword(defaultPass);

  usersStore = {
    'destinyivienagbor2005@gmail.com': {
      id: 'destinyivienagbor2005@gmail.com',
      email: 'destinyivienagbor2005@gmail.com',
      name: 'Destiny (Primary Learner)',
      role: 'Student / Learner',
      salt: s1,
      passwordHash: h1,
      createdAt: '2026-11-01T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
      isDemoUser: true
    },
    'judge.security@codesprint.org': {
      id: 'judge.security@codesprint.org',
      email: 'judge.security@codesprint.org',
      name: 'CodeSprint Security Judge',
      role: 'Security Evaluator',
      salt: s2,
      passwordHash: h2,
      createdAt: '2026-11-01T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
      isDemoUser: true
    },
    'alex.student@cyberaware.edu': {
      id: 'alex.student@cyberaware.edu',
      email: 'alex.student@cyberaware.edu',
      name: 'Alex Rivera (Peer Learner)',
      role: 'Student / Learner',
      salt: s3,
      passwordHash: h3,
      createdAt: '2026-11-01T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
      isDemoUser: true
    }
  };
  writeJsonFile(USERS_FILE, usersStore);
}

// Seed default persistent groups for CodeSprint demo users if empty
if (!groupsStore || groupsStore.length === 0) {
  groupsStore = [
    {
      id: 'grp_alpha_defense',
      name: 'Cyber Defense Squad Alpha',
      description: 'Foundational cyber defence study group covering phishing analysis, network hygiene, and SOC incident triage.',
      creatorId: 'destinyivienagbor2005@gmail.com',
      creatorName: 'Destiny (Primary Learner)',
      inviteCode: 'CYB101',
      createdAt: 'Nov 1, 2026',
      memberCount: 2,
      isPublic: true,
      members: [
        {
          userId: 'destinyivienagbor2005@gmail.com',
          userName: 'Destiny (Primary Learner)',
          role: 'admin',
          joinedAt: 'Nov 1, 2026',
          participationStatus: 'completed_assessments'
        },
        {
          userId: 'alex.student@cyberaware.edu',
          userName: 'Alex Rivera (Peer Learner)',
          role: 'member',
          joinedAt: 'Nov 2, 2026',
          participationStatus: 'active'
        }
      ]
    },
    {
      id: 'grp_codesprint_guild',
      name: 'CodeSprint Security Guild',
      description: 'Official CodeSprint 2026 evaluation cohort focused on advanced threat detection, OWASP Top 10 web security, and cloud forensics.',
      creatorId: 'judge.security@codesprint.org',
      creatorName: 'CodeSprint Security Judge',
      inviteCode: 'SPR920',
      createdAt: 'Nov 3, 2026',
      memberCount: 1,
      isPublic: true,
      members: [
        {
          userId: 'judge.security@codesprint.org',
          userName: 'CodeSprint Security Judge',
          role: 'admin',
          joinedAt: 'Nov 3, 2026',
          participationStatus: 'active'
        }
      ]
    }
  ];
  writeJsonFile(GROUPS_FILE, groupsStore);
}

// Ensure default user history exists
const DEFAULT_USER_ID = DEFAULT_DEMO_USER;
if (!userHistories[DEFAULT_USER_ID]) {
  userHistories[DEFAULT_USER_ID] = {
    userId: DEFAULT_USER_ID,
    seenQuestionIds: ['sec_auth_01', 'sec_auth_02'],
    answeredQuestionIds: ['sec_auth_01'],
    answeredResults: {
      sec_auth_01: { isCorrect: true, selectedOptions: [1], timestamp: new Date().toISOString() }
    },
    flaggedQuestionIds: []
  };
  writeJsonFile(USER_HISTORY_FILE, userHistories);
}

// Seed default initial attempt for default demo user if empty
if (!userAttemptsStore[DEFAULT_USER_ID] || userAttemptsStore[DEFAULT_USER_ID].length === 0) {
  userAttemptsStore[DEFAULT_USER_ID] = [
    {
      id: 'demo_init_attempt',
      userId: DEFAULT_USER_ID,
      mode: 'practice',
      date: new Date(Date.now() - 86400000 * 2).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      score: 8,
      total: 10,
      percentage: 80,
      difficulty: 'mixed',
      categoryFilter: 'all',
      topicBreakdown: {
        'Phishing': { correct: 3, total: 3, percentage: 100 },
        'Password Security': { correct: 2, total: 2, percentage: 100 },
        'Multi-Factor Authentication': { correct: 1, total: 2, percentage: 50 },
        'Social Engineering': { correct: 1, total: 2, percentage: 50 },
        'Safe Browsing': { correct: 1, total: 1, percentage: 100 }
      },
      timeTakenSeconds: 245,
      completionDuration: 245,
      questionsAttempted: ['sec_auth_01', 'sec_auth_02', 'sec_auth_03', 'sec_auth_04', 'net_sec_01'],
      verifiedByServer: true
    }
  ];
  writeJsonFile(ATTEMPTS_FILE, userAttemptsStore);
}

// Seed default initial learning progress for default demo user if empty
if (!userProgressStore[DEFAULT_USER_ID]) {
  userProgressStore[DEFAULT_USER_ID] = {
    completedLessons: ['phishing_101'],
    completedChecklists: {
      phishing_101: ['chk_hover_links', 'chk_sender_domain']
    },
    quizAttempts: userAttemptsStore[DEFAULT_USER_ID] || [],
    solvedScenarios: ['scenario_delivery_sms'],
    earnedBadges: ['first_step', 'quiz_starter', 'quiz_high_scorer'],
    streakDays: 3,
    lastVisitDate: new Date().toISOString().split('T')[0]
  };
  writeJsonFile(PROGRESS_FILE, userProgressStore);
}


// Gemini AI client initialization (Server-Side Only)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    })
  : null;

// ============================================================================
// AUTHENTICATION & IDENTITY ENDPOINTS
// ============================================================================

/**
 * GET /api/auth/demo-users
 * Returns available demo user profiles for 1-click evaluation and testing.
 */
app.get('/api/auth/demo-users', (req: Request, res: Response) => {
  usersStore = readJsonFile(USERS_FILE, usersStore);
  const demoAccounts = Object.values(usersStore)
    .filter(u => u.isDemoUser)
    .map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isDemo: true
    }));

  res.json({ success: true, users: demoAccounts });
});

/**
 * POST /api/auth/demo-login
 * Instant 1-click authentication restricted strictly to server-designated demo accounts.
 */
app.post('/api/auth/demo-login', (req: Request, res: Response) => {
  const { userId } = req.body || {};
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'A valid demo userId is required.' });
  }

  const user = findUserByEmailOrId(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Demo user account not found.' });
  }

  // Enforce server-side demo flag; ignore any client-provided role or demo flags
  if (user.isDemoUser !== true) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Demo login is permitted only for designated demo accounts.'
    });
  }

  const token = generateSessionToken(user.id);
  persistSession(token, user.id);

  user.lastLoginAt = new Date().toISOString();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  writeJsonFile(USERS_FILE, usersStore);

  res.json({
    success: true,
    message: `Signed in as ${user.name}.`,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isDemo: true,
      lastLoginAt: user.lastLoginAt
    },
    token
  });
});

/**
 * POST /api/auth/register
 * Validates user input, enforces ordinary learner role allowlist, prevents duplicate emails,
 * hashes credentials using crypto.scrypt, and initializes isolated user state.
 */
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, confirmPassword, role } = req.body || {};

  // 1. Validation
  const validation = validateRegistrationPayload({ name, email, password, confirmPassword });
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  // 2. Role allowlist validation: reject attempts to self-assign privileged/non-learner roles
  const allowedRole = PUBLIC_REGISTRATION_ALLOWED_ROLES[0];
  if (role !== undefined && role !== null && String(role).trim() !== '') {
    const requestedRole = String(role).trim();
    if (!PUBLIC_REGISTRATION_ALLOWED_ROLES.includes(requestedRole as any)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Public registration only allows the Student / Learner role.'
      });
    }
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 3. Duplicate email check
  if (findUserByEmailOrId(normalizedEmail)) {
    return res.status(409).json({
      success: false,
      error: 'An account with this email address already exists. Please sign in instead.'
    });
  }

  // 4. Hash password with secure salt
  const { salt, hash } = hashPassword(password);

  const newUser: UserAccount = {
    id: normalizedEmail,
    email: normalizedEmail,
    name: name.trim(),
    role: allowedRole,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    isDemoUser: false
  };

  usersStore[normalizedEmail] = newUser;
  writeJsonFile(USERS_FILE, usersStore);

  // 5. Initialize fresh, isolated learning progress, assessment history, and question history
  userProgressStore[normalizedEmail] = createCleanProgressState();
  writeJsonFile(PROGRESS_FILE, userProgressStore);

  userAttemptsStore[normalizedEmail] = [];
  writeJsonFile(ATTEMPTS_FILE, userAttemptsStore);

  userHistories[normalizedEmail] = {
    userId: normalizedEmail,
    seenQuestionIds: [],
    answeredQuestionIds: [],
    answeredResults: {},
    flaggedQuestionIds: []
  };
  writeJsonFile(USER_HISTORY_FILE, userHistories);

  // 6. Generate and persist session token across server reboots
  const token = generateSessionToken(normalizedEmail);
  persistSession(token, normalizedEmail);

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Welcome to CyberAware!',
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      createdAt: newUser.createdAt
    },
    token
  });
});

/**
 * POST /api/auth/login
 * Standard credential authentication with brute-force rate-limiting protection.
 * Supports email/id lookup, multi-hash verification, and persistent sessions.
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const user = findUserByEmailOrId(email);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email address or password.' });
  }

  // Brute-force lockout check
  if (user.lockedUntil) {
    const lockTime = new Date(user.lockedUntil).getTime();
    if (lockTime > Date.now()) {
      const remainingSeconds = Math.ceil((lockTime - Date.now()) / 1000);
      return res.status(423).json({
        success: false,
        error: `Account temporarily locked due to repeated failed login attempts. Please retry in ${remainingSeconds} seconds.`
      });
    } else {
      // Lockout expired: reset failed attempts counter
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }
  }

  const isValidPassword = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValidPassword) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-minute lockout
    }
    writeJsonFile(USERS_FILE, usersStore);

    const attemptsRemaining = Math.max(0, 5 - user.failedLoginAttempts);
    return res.status(401).json({
      success: false,
      error: attemptsRemaining > 0 
        ? `Invalid email address or password. ${attemptsRemaining} attempt(s) remaining before security lockout.`
        : 'Account locked for 5 minutes due to multiple failed authentication attempts.'
    });
  }

  // Successful login: reset failed attempts and lockout
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date().toISOString();
  writeJsonFile(USERS_FILE, usersStore);

  // Generate and persist session token across server reboots
  const token = generateSessionToken(user.id);
  persistSession(token, user.id);

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isDemo: !!user.isDemoUser,
      lastLoginAt: user.lastLoginAt
    },
    token
  });
});

/**
 * GET /api/auth/me
 * Retrieves profile of currently authenticated user using session token or demo identity header.
 */
app.get('/api/auth/me', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({ success: false, error: 'Not authenticated or user session expired.' });
  }

  const user = findUserByEmailOrId(callerId);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Not authenticated or user session expired.' });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isDemo: !!user.isDemoUser,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    }
  });
});

/**
 * POST /api/auth/logout
 * Terminates and removes the active session token from persistent storage.
 */
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = extractBearerToken(req);

  if (token && isSessionTokenFormatValid(token)) {
    removeSession(token);
  }

  res.json({ success: true, message: 'Signed out successfully.' });
});

/**
 * POST /api/auth/evaluate-password
 * Educational utility endpoint providing real-time password entropy and crack-time metrics.
 */
app.post('/api/auth/evaluate-password', (req: Request, res: Response) => {
  const { password } = req.body;
  const evaluation = evaluatePasswordEntropy(password || '');
  res.json({ success: true, evaluation });
});

/**
 * POST /api/auth/reset-password
 * Password reset is disabled until verified out-of-band recovery delivery is configured.
 * Never returns verification codes or accepts unauthenticated password resets.
 */
app.post('/api/auth/reset-password', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    error: 'Password reset is temporarily unavailable because verified out-of-band recovery delivery is not configured.'
  });
});

// ============================================================================
// ASSESSMENT & ATTEMPTS API ROUTES
// ============================================================================

/**
 * GET /api/user/attempts
 * Retrieves verified assessment history and scores for the specified demo user.
 * Enforces demo user isolation so one demo user cannot access another demo user's records.
 */
app.get('/api/user/attempts', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to access assessment attempts.'
    });
  }

  const requestedUserId = (req.query.userId as string) || callerId;

  if (requestedUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' is not authorized to access assessment records for '${requestedUserId}'.`
    });
  }

  // Reload latest attempts from file
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);
  const userAttempts = userAttemptsStore[callerId] || [];

  res.json({
    success: true,
    userId: callerId,
    totalAttempts: userAttempts.length,
    attempts: userAttempts
  });
});

/**
 * POST /api/user/attempts
 * Submits a completed assessment, validates questions, calculates verified scores using
 * the authoritative server question bank (protecting against client score manipulation),
 * prevents duplicate submissions, and persists to server-data/attempts.json.
 */
app.post('/api/user/attempts', (req: Request, res: Response) => {
  const payload = req.body;
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to submit assessment attempts.'
    });
  }

  const targetUserId = payload?.userId || callerId;

  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot submit assessment attempts on behalf of '${targetUserId}'.`
    });
  }

  // 2. Validate payload structure and questions against server question bank
  const validation = validateAssessmentSubmission(payload, serverQuestions);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: validation.error || 'Invalid assessment submission'
    });
  }

  // 3. Reload latest attempts and check for duplicate attempt ID
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);
  if (checkDuplicateAttempt(payload.id, userAttemptsStore)) {
    return res.status(409).json({
      success: false,
      error: `Duplicate submission: Assessment attempt '${payload.id}' has already been processed and recorded.`
    });
  }

  // 4. Calculate verified scores on the server using authoritative question bank
  const verifiedAttempt = calculateVerifiedAssessmentScore(payload, serverQuestions);

  // 5. Persist the attempt into server-data/attempts.json
  if (!userAttemptsStore[targetUserId]) {
    userAttemptsStore[targetUserId] = [];
  }
  userAttemptsStore[targetUserId].unshift(verifiedAttempt);
  writeJsonFile(ATTEMPTS_FILE, userAttemptsStore);

  // 6. Synchronize with user_history.json for no-repeat pool exclusion
  if (!userHistories[targetUserId]) {
    userHistories[targetUserId] = {
      userId: targetUserId,
      seenQuestionIds: [],
      answeredQuestionIds: [],
      answeredResults: {},
      flaggedQuestionIds: []
    };
  }
  const history = userHistories[targetUserId];
  for (const qId of verifiedAttempt.questionsAttempted) {
    if (!history.seenQuestionIds.includes(qId)) {
      history.seenQuestionIds.push(qId);
    }
    if (!history.answeredQuestionIds.includes(qId)) {
      history.answeredQuestionIds.push(qId);
    }
    if (verifiedAttempt.verifiedAnswers[qId]) {
      history.answeredResults[qId] = {
        isCorrect: verifiedAttempt.verifiedAnswers[qId].isCorrect,
        selectedOptions: verifiedAttempt.verifiedAnswers[qId].selectedAnswers,
        timestamp: verifiedAttempt.timestamp
      };
    }
  }
  writeJsonFile(USER_HISTORY_FILE, userHistories);

  // 7. Synchronize with userProgressStore
  userProgressStore = readJsonFile(PROGRESS_FILE, userProgressStore);
  if (!userProgressStore[targetUserId]) {
    userProgressStore[targetUserId] = createCleanProgressState();
  }
  userProgressStore[targetUserId].quizAttempts = userAttemptsStore[targetUserId];
  userProgressStore[targetUserId].earnedBadges = evaluateBadges(userProgressStore[targetUserId]);
  writeJsonFile(PROGRESS_FILE, userProgressStore);

  res.status(201).json({
    success: true,
    message: 'Assessment attempt verified and persisted successfully to server.',
    attempt: verifiedAttempt,
    attempts: userAttemptsStore[targetUserId]
  });
});

/**
 * GET /api/user/progress
 * Retrieves isolated persistent learning progress for the specified user.
 */
app.get('/api/user/progress', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to access learning progress.'
    });
  }

  const requestedUserId = (req.query.userId as string) || callerId;

  if (requestedUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot view learning progress for '${requestedUserId}'.`
    });
  }

  userProgressStore = readJsonFile(PROGRESS_FILE, userProgressStore);
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);

  let progress = userProgressStore[callerId];
  if (!progress) {
    progress = callerId === DEFAULT_DEMO_USER
      ? {
          completedLessons: ['phishing_101'],
          completedChecklists: { phishing_101: ['chk_hover_links', 'chk_sender_domain'] },
          quizAttempts: userAttemptsStore[callerId] || [],
          solvedScenarios: ['scenario_delivery_sms'],
          earnedBadges: ['first_step', 'quiz_starter', 'quiz_high_scorer'],
          streakDays: 3,
          lastVisitDate: new Date().toISOString().split('T')[0]
        }
      : createCleanProgressState();
    userProgressStore[callerId] = progress;
    writeJsonFile(PROGRESS_FILE, userProgressStore);
  }

  // Authoritative attempts injection
  progress.quizAttempts = userAttemptsStore[callerId] || [];

  res.json({
    success: true,
    userId: callerId,
    progress
  });
});

/**
 * POST /api/user/progress
 * Saves persistent learning progress scoped strictly to the authenticated caller.
 */
app.post('/api/user/progress', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to update learning progress.'
    });
  }

  const { userId, progress } = req.body;
  const targetUserId = userId || callerId;

  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot update learning progress for '${targetUserId}'.`
    });
  }

  if (!progress || typeof progress !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid progress data structure.' });
  }

  userProgressStore = readJsonFile(PROGRESS_FILE, userProgressStore);
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);

  const sanitized: UserProgressState = {
    completedLessons: Array.isArray(progress.completedLessons) ? progress.completedLessons : [],
    completedChecklists: typeof progress.completedChecklists === 'object' && progress.completedChecklists ? progress.completedChecklists : {},
    quizAttempts: userAttemptsStore[targetUserId] || [],
    solvedScenarios: Array.isArray(progress.solvedScenarios) ? progress.solvedScenarios : [],
    earnedBadges: Array.isArray(progress.earnedBadges) ? progress.earnedBadges : [],
    streakDays: typeof progress.streakDays === 'number' ? progress.streakDays : 0,
    lastVisitDate: progress.lastVisitDate || new Date().toISOString().split('T')[0]
  };

  sanitized.earnedBadges = evaluateBadges(sanitized);
  userProgressStore[targetUserId] = sanitized;
  writeJsonFile(PROGRESS_FILE, userProgressStore);

  res.json({
    success: true,
    userId: targetUserId,
    progress: sanitized
  });
});

// ============================================================================
// STAGE 3: SECURITY GROUPS & MEMBERSHIP ENDPOINTS
// ============================================================================

/**
 * GET /api/groups
 * Lists public group summaries and the caller's enrolled groups.
 * Redacts private groups from non-members and never leaks invite codes or creator IDs to non-members.
 */
app.get('/api/groups', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);
  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);

  const effectiveCaller = isAuthenticated && callerId ? callerId : '';
  const visibleGroups = groupsStore.filter(g => {
    const isMember =
      effectiveCaller !== '' &&
      g.members.some(m => m.userId.toLowerCase() === effectiveCaller.toLowerCase());
    return g.isPublic !== false || isMember;
  });

  const summaries = visibleGroups.map(g => toGroupSummary(g, effectiveCaller));
  res.json({ success: true, groups: summaries });
});

/**
 * POST /api/groups
 * Creates a new security group, assigns a unique 6-character code, and sets creator as admin.
 */
app.post('/api/groups', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to create a security group.'
    });
  }

  const requestedCreator = req.body.creatorId || callerId;
  if (requestedCreator !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot create a group on behalf of '${requestedCreator}'.`
    });
  }

  const { name, description, isPublic } = req.body;
  const validation = validateGroupCreation({ name, description, creatorId: requestedCreator });
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const existingCodes = groupsStore.map(g => g.inviteCode);
  const newGroup = createGroupRecord(name, description, requestedCreator, existingCodes);
  if (isPublic !== undefined) {
    newGroup.isPublic = !!isPublic;
  }

  groupsStore.unshift(newGroup);
  writeJsonFile(GROUPS_FILE, groupsStore);

  res.status(201).json({
    success: true,
    message: `Group '${newGroup.name}' created successfully with invitation code '${newGroup.inviteCode}'.`,
    group: newGroup
  });
});

/**
 * POST /api/groups/join
 * Joins an existing group using its 6-character invitation code (required for private groups) or public groupId.
 */
app.post('/api/groups/join', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to join a security group.'
    });
  }

  const targetUserId = req.body.userId || callerId;
  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot join a group on behalf of '${targetUserId}'.`
    });
  }

  const { inviteCode, groupId } = req.body;
  if (!inviteCode && !groupId) {
    return res.status(400).json({ success: false, error: 'Invitation code or group ID is required to join a group.' });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  let group: SecurityGroup | undefined;

  if (inviteCode) {
    const cleanCode = String(inviteCode).trim().toUpperCase();
    group = groupsStore.find(g => g.inviteCode.toUpperCase() === cleanCode);
  } else if (groupId) {
    group = groupsStore.find(g => g.id === groupId);
    if (group && group.isPublic === false) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Private groups require a valid invitation code to join.'
      });
    }
  }

  const validation = validateJoinGroup(group, targetUserId);
  if (!validation.valid) {
    return res.status(validation.status).json({ success: false, error: validation.error });
  }

  const updatedGroup = addMemberToGroup(group!, targetUserId);
  groupsStore = groupsStore.map(g => g.id === updatedGroup.id ? updatedGroup : g);
  writeJsonFile(GROUPS_FILE, groupsStore);

  res.status(200).json({
    success: true,
    message: `Successfully joined ${updatedGroup.name}!`,
    group: updatedGroup
  });
});

/**
 * GET /api/groups/:id
 * Retrieves full details for a group strictly for authenticated enrolled members.
 */
app.get('/api/groups/:id', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);
  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to view group details.'
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const group = groupsStore.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found.' });
  }

  const isMember = group.members.some(m => m.userId.toLowerCase() === callerId.toLowerCase());
  if (!isMember) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only enrolled group members may access group details and invitation codes.'
    });
  }

  res.json({ success: true, group });
});

/**
 * GET /api/groups/:id/members
 * Retrieves group members enriched with assessment stats strictly for enrolled members.
 */
app.get('/api/groups/:id/members', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);
  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to view group members.'
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const group = groupsStore.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found.' });
  }

  const isMember = group.members.some(m => m.userId.toLowerCase() === callerId.toLowerCase());
  if (!isMember) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only enrolled group members may access member rosters.'
    });
  }

  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);
  const enrichedMembers = enrichMemberParticipation(group.members, userAttemptsStore);
  res.json({ success: true, members: enrichedMembers });
});

/**
 * POST /api/groups/:id/leave
 * Allows a member to leave a group.
 */
app.post('/api/groups/:id/leave', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to leave a security group.'
    });
  }

  const targetUserId = req.body.userId || callerId;
  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot remove another user from a group using leave action.`
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const group = groupsStore.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found.' });
  }

  const result = removeMemberFromGroup(group, targetUserId, callerId);
  if (!result.success || !result.group) {
    return res.status(result.status).json({ success: false, error: result.error });
  }

  groupsStore = groupsStore.map(g => g.id === result.group!.id ? result.group! : g);
  writeJsonFile(GROUPS_FILE, groupsStore);

  res.json({
    success: true,
    message: `Successfully left ${group.name}.`,
    group: result.group
  });
});

/**
 * DELETE /api/groups/:id/members/:memberId
 * Allows a group administrator to remove a member.
 */
app.delete('/api/groups/:id/members/:memberId', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to manage group members.'
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const group = groupsStore.find(g => g.id === req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found.' });
  }

  const result = removeMemberFromGroup(group, req.params.memberId, callerId);
  if (!result.success || !result.group) {
    return res.status(result.status).json({ success: false, error: result.error });
  }

  groupsStore = groupsStore.map(g => g.id === result.group!.id ? result.group! : g);
  writeJsonFile(GROUPS_FILE, groupsStore);

  res.json({
    success: true,
    message: `Member '${req.params.memberId}' removed from ${group.name}.`,
    group: result.group
  });
});

/**
 * GET /api/groups/:id/leaderboard
 * Computes and returns the fair competitive leaderboard for a security group.
 * Strictly calculates scores from server-verified attempts in attempts.json.
 * Excludes outsiders, prevents duplicate attempts, and enforces tie-breaking rules.
 */
app.get('/api/groups/:id/leaderboard', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to view group leaderboards.'
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  const group = groupsStore.find(g => g.id === req.params.id);

  const authCheck = canAccessGroupLeaderboard(group, callerId);
  if (!authCheck.allowed) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.reason });
  }

  // Load server-verified attempts
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);
  const leaderboard = calculateGroupLeaderboard(group!, userAttemptsStore, callerId);
  const currentUserEntry = leaderboard.find(e => e.isCurrentUser);
  const isMember = group!.members.some(m => m.userId.toLowerCase() === callerId.toLowerCase());

  res.json({
    success: true,
    groupId: group!.id,
    groupName: group!.name,
    inviteCode: isMember ? group!.inviteCode : '',
    memberCount: group!.members.length,
    generatedAt: new Date().toISOString(),
    currentUserRank: currentUserEntry ? currentUserEntry.rank : null,
    leaderboard
  });
});

/**
 * GET /api/leaderboard/me
 * Retrieves current demo user's standings and rankings across all groups they belong to.
 */
app.get('/api/leaderboard/me', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to view personal leaderboard standings.'
    });
  }

  const targetUserId = (req.query.userId as string) || callerId;

  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot view personal standings for '${targetUserId}'.`
    });
  }

  groupsStore = readJsonFile(GROUPS_FILE, groupsStore);
  userAttemptsStore = readJsonFile(ATTEMPTS_FILE, userAttemptsStore);

  const standings = calculateUserStandings(groupsStore, userAttemptsStore, targetUserId);

  res.json({
    success: true,
    userId: targetUserId,
    totalGroupsEnrolled: standings.length,
    standings
  });
});

/**
 * GET /api/user/history
 * Fetches user assessment history across sessions and devices with strict user isolation
 */
app.get('/api/user/history', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to access question history.'
    });
  }

  const targetUserId = (req.query.userId as string) || callerId;

  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot access question history for '${targetUserId}'.`
    });
  }

  userHistories = readJsonFile(USER_HISTORY_FILE, userHistories);
  if (!userHistories[callerId]) {
    userHistories[callerId] = {
      userId: callerId,
      seenQuestionIds: [],
      answeredQuestionIds: [],
      answeredResults: {},
      flaggedQuestionIds: []
    };
    writeJsonFile(USER_HISTORY_FILE, userHistories);
  }
  res.json({ success: true, history: userHistories[callerId] });
});

/**
 * POST /api/user/history/record
 * Records presented questions, answered questions, and flagged questions strictly for authenticated caller
 */
app.post('/api/user/history/record', (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to record question history.'
    });
  }

  const { userId, presentedIds = [], answeredUpdates = {}, flaggedIds = [] } = req.body;
  const targetUserId = userId || callerId;

  if (targetUserId !== callerId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Authenticated user '${callerId}' cannot update question history for '${targetUserId}'.`
    });
  }

  userHistories = readJsonFile(USER_HISTORY_FILE, userHistories);
  if (!userHistories[callerId]) {
    userHistories[callerId] = {
      userId: callerId,
      seenQuestionIds: [],
      answeredQuestionIds: [],
      answeredResults: {},
      flaggedQuestionIds: []
    };
  }

  const history = userHistories[callerId];

  // Update seenQuestionIds
  for (const id of presentedIds) {
    if (!history.seenQuestionIds.includes(id)) {
      history.seenQuestionIds.push(id);
    }
  }

  // Update answeredQuestionIds and results
  for (const [qId, result] of Object.entries(answeredUpdates)) {
    if (!history.answeredQuestionIds.includes(qId)) {
      history.answeredQuestionIds.push(qId);
    }
    history.answeredResults[qId] = result as { isCorrect: boolean; selectedOptions: number[]; timestamp: string };
  }

  // Update flagged questions
  if (Array.isArray(flaggedIds)) {
    history.flaggedQuestionIds = Array.from(new Set([...history.flaggedQuestionIds, ...flaggedIds]));
  }

  writeJsonFile(USER_HISTORY_FILE, userHistories);
  res.json({ success: true, history });
});

/**
 * POST /api/assessment/select
 * Server-side selection engine with strict no-repeat guarantee & verified caller isolation
 */
app.post('/api/assessment/select', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to select assessment questions.'
    });
  }

  const {
    userId,
    category = 'all',
    difficulty = 'all',
    type = 'all',
    count = 10,
    mode = 'assessment',
    reviewFilter = 'all',
    searchQuery = ''
  } = req.body || {};

  if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
    if (String(userId).toLowerCase().trim() !== callerId.toLowerCase().trim()) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Authenticated user '${callerId}' cannot select assessments or modify question history for '${userId}'.`
      });
    }
  }

  userHistories = readJsonFile(USER_HISTORY_FILE, userHistories);
  const userHistory = userHistories[callerId] || {
    userId: callerId,
    seenQuestionIds: [],
    answeredQuestionIds: [],
    answeredResults: {},
    flaggedQuestionIds: []
  };

  const selectionResult = selectAssessmentQuestions(serverQuestions, userHistory, {
    category,
    difficulty,
    type,
    count,
    mode,
    reviewFilter,
    searchQuery
  });

  // Automatically register newly delivered questions into seen history if in assessment mode
  if (mode === 'assessment' && selectionResult.questions.length > 0) {
    const presented = selectionResult.questions.map(q => q.id);
    for (const id of presented) {
      if (!userHistory.seenQuestionIds.includes(id)) {
        userHistory.seenQuestionIds.push(id);
      }
    }
    userHistories[callerId] = userHistory;
    writeJsonFile(USER_HISTORY_FILE, userHistories);
  }

  res.json({
    success: true,
    result: selectionResult
  });
});

/**
 * GET /api/questions
 * Returns questions from server bank (optionally filtered by review status)
 */
app.get('/api/questions', (req: Request, res: Response) => {
  const status = req.query.status as string;
  let list = serverQuestions;
  if (status) {
    list = list.filter(q => q.reviewStatus === status);
  }
  res.json({ success: true, questions: list });
});

/**
 * POST /api/questions/review
 * Approves, modifies, or rejects pending review questions.
 * Restricted strictly to server-verified privileged reviewer roles.
 */
app.post('/api/questions/review', (req: Request, res: Response) => {
  const { callerId, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to review assessment questions.'
    });
  }

  const callerAccount = findUserByEmailOrId(callerId);
  if (!callerAccount) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authenticated account record not found.'
    });
  }

  const callerRole = (callerAccount.role || '').toLowerCase().trim();
  if (!QUESTION_REVIEWER_ROLES.has(callerRole)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only authorized evaluators, educators, or administrators may review assessment questions.'
    });
  }

  const { questionId, action, updatedData } = req.body; // action: 'approve' | 'reject' | 'update'

  const idx = serverQuestions.findIndex(q => q.id === questionId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Question not found' });
  }

  if (action === 'reject') {
    serverQuestions.splice(idx, 1);
    writeJsonFile(QUESTIONS_FILE, serverQuestions);
    return res.json({ success: true, message: 'Question rejected and removed' });
  }

  if (action === 'approve') {
    serverQuestions[idx].reviewStatus = 'verified';
    serverQuestions[idx].lastVerifiedDate = new Date().toISOString();
    writeJsonFile(QUESTIONS_FILE, serverQuestions);
    return res.json({ success: true, question: serverQuestions[idx] });
  }

  if (action === 'update' && updatedData) {
    const normalized = normalizeQuestionRecord({ ...serverQuestions[idx], ...updatedData });
    const validation = validateQuestion(normalized);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }
    serverQuestions[idx] = normalized;
    writeJsonFile(QUESTIONS_FILE, serverQuestions);
    return res.json({ success: true, question: normalized });
  }

  res.status(400).json({ success: false, error: 'Invalid review action' });
});

/**
 * POST /api/questions/propose
 * Proposes new questions grounded in approved references (NIST, OWASP, MITRE, RFC)
 * Validates 12 required fields and detects near-duplicates before storing as pending review.
 * Protected with mandatory session authentication, rate limiting (5 req/min), and input bounds validation.
 */
app.post('/api/questions/propose', async (req: Request, res: Response) => {
  const { callerId, token, isAuthenticated } = getVerifiedCallerId(req);

  if (!isAuthenticated || !callerId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: A valid session token is required to propose or generate assessment questions.'
    });
  }

  // Rate Limiting check per authenticated user
  const rateLimit = checkAiQuestionRateLimit(callerId);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded: You have submitted too many question generation requests. Please wait ${rateLimit.retryAfterSeconds} second(s) before trying again.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds
    });
  }

  // Validate payload
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body: Expected a JSON object.'
    });
  }

  const {
    category = 'network_security',
    difficulty = 'intermediate',
    count = 1,
    focusSubtopic = ''
  } = req.body;

  const parsedCount = parseInt(String(count), 10);
  if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 5) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: count must be an integer between 1 and 5.'
    });
  }

  if (typeof category !== 'string' || category.trim().length === 0 || category.trim().length > 64) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: category must be a non-empty string under 64 characters.'
    });
  }

  const validDifficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
  const normalizedDifficulty = typeof difficulty === 'string' ? difficulty.toLowerCase().trim() : '';
  if (!validDifficulties.includes(normalizedDifficulty)) {
    return res.status(400).json({
      success: false,
      error: `Invalid request: difficulty must be one of: ${validDifficulties.join(', ')}.`
    });
  }

  if (typeof focusSubtopic === 'string' && focusSubtopic.length > 200) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: focusSubtopic cannot exceed 200 characters.'
    });
  }

  const safeCategory = category.trim();
  const safeSubtopic = typeof focusSubtopic === 'string' ? focusSubtopic.trim() : '';

  try {
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'AI service unavailable: GEMINI_API_KEY is not configured.'
      });
    }

    const prompt = `You are a cybersecurity assessment architect.
Generate ${parsedCount} high-quality, technically accurate cybersecurity assessment question(s) strictly grounded in approved industry frameworks:
- NIST SP 800-53 / NIST SP 800-63B
- OWASP Top 10 (2021) or API Security Top 10
- MITRE ATT&CK Enterprise Framework
- IETF RFCs (e.g., RFC 6238 TOTP, RFC 8446 TLS 1.3, RFC 7231 HTTP/1.1)
- CIS Critical Security Controls v8

Requirements:
1. Target Category: "${safeCategory}"
2. Target Difficulty: "${normalizedDifficulty}" (must be beginner, intermediate, advanced, or expert)
3. Specific Subtopic: "${safeSubtopic || 'core concepts in ' + safeCategory}"
4. Include 4 distinct, plausible answer options. Exactly ONE option must be correct.
5. Provide a rigorous explanation detailing why the correct answer is right and why the other options are insufficient.
6. Ground the question with explicit citation in "provenance" (e.g., "NIST SP 800-63B Section 5.1.1.2", "MITRE ATT&CK T1059.001", "OWASP A03:2021").
7. Do not create trivial or duplicate questions. Create realistic scenarios, protocol analysis, or defensive engineering assessments.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING, description: 'High-level topic title' },
              subtopic: { type: Type.STRING, description: 'Specific subtopic' },
              difficulty: {
                type: Type.STRING,
                description: 'beginner, intermediate, advanced, or expert'
              },
              type: {
                type: Type.STRING,
                description: 'multiple_choice, scenario, log_analysis, code_review, troubleshooting, or select_all'
              },
              question: { type: Type.STRING, description: 'Clear question prompt' },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of 4 distinct answer choices'
              },
              correctAnswer: {
                type: Type.INTEGER,
                description: '0-based index of correct option'
              },
              explanation: {
                type: Type.STRING,
                description: 'In-depth explanation and rationale'
              },
              provenance: {
                type: Type.STRING,
                description: 'Specific standard citation (NIST, OWASP, MITRE, RFC)'
              }
            },
            required: ['topic', 'subtopic', 'difficulty', 'type', 'question', 'options', 'correctAnswer', 'explanation', 'provenance']
          }
        }
      }
    });

    const text = response.text || '[]';
    let rawItems: any[] = [];
    try {
      rawItems = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to parse AI structured response' });
    }

    const proposedList: QuizQuestion[] = [];
    const duplicateRejections: Array<{ question: string; reason: string; similarity: number }> = [];
    const validationErrors: string[] = [];

    for (const raw of rawItems) {
      // 1. Check for exact and near-duplicates against existing bank
      const dupCheck = checkForDuplicates(raw.question, serverQuestions, 0.65);
      if (dupCheck.isDuplicate) {
        duplicateRejections.push({
          question: raw.question,
          reason: `Rejected as ${dupCheck.reason} (${Math.round(dupCheck.maxSimilarity * 100)}% match with ${dupCheck.matchedQuestionId})`,
          similarity: dupCheck.maxSimilarity
        });
        continue;
      }

      // 2. Normalize and format
      const normalized = normalizeQuestionRecord(raw);
      normalized.id = `ai_gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      normalized.category = category;
      normalized.isCustom = true;
      // Stored separately as pending review / draft until human reviewed
      normalized.reviewStatus = 'draft';
      normalized.creationDate = new Date().toISOString();
      normalized.lastVerifiedDate = new Date().toISOString();

      // 3. Validate 12 mandatory fields
      const validation = validateQuestion(normalized);
      if (!validation.isValid) {
        validationErrors.push(...validation.errors);
        continue;
      }

      // Add to server bank as pending review
      serverQuestions.unshift(normalized);
      proposedList.push(normalized);
    }

    writeJsonFile(QUESTIONS_FILE, serverQuestions);

    res.json({
      success: true,
      proposedCount: proposedList.length,
      proposedQuestions: proposedList,
      duplicateRejections,
      validationErrors
    });
  } catch (error: any) {
    console.error('Error generating questions with Gemini:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate questions via AI service'
    });
  }
});

// Vite Middleware for Development / Static Serve for Production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0', hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CyberAware full-stack engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
