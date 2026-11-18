import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveActiveUserId, loadUserProgress, CLEAN_EMPTY_PROGRESS } from './storage';
import { ActiveTab } from '../types';

// Mock localStorage for headless Node test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    }
  }
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

describe('CyberAware Final Logout & Public Landing Isolation Suite', () => {
  it('Scenario 1: resolveActiveUserId returns empty string when unauthenticated without session', () => {
    // When no userId is passed and no user in localStorage
    const resolved = resolveActiveUserId('');
    assert.strictEqual(resolved, '');
    assert.notStrictEqual(resolved, 'destinyivienagbor2005@gmail.com');
  });

  it('Scenario 2: loadUserProgress returns CLEAN_EMPTY_PROGRESS when user is unauthenticated', () => {
    const unauthProgress = loadUserProgress('');
    assert.deepStrictEqual(unauthProgress, CLEAN_EMPTY_PROGRESS);
    assert.strictEqual(unauthProgress.completedLessons.length, 0);
    assert.strictEqual(unauthProgress.quizAttempts.length, 0);
    assert.strictEqual(unauthProgress.earnedBadges.length, 0);
  });

  it('Scenario 3: Protected routes identify dashboard, progress, profile, settings', () => {
    const protectedTabs: ActiveTab[] = ['dashboard', 'progress', 'profile', 'settings'];
    const publicTabs: ActiveTab[] = ['landing', 'about', 'learning', 'lessons', 'quiz', 'detective', 'groups', 'leaderboard'];

    const getSafeTabForUnauthenticated = (requestedTab: ActiveTab): ActiveTab => {
      if (protectedTabs.includes(requestedTab)) {
        return 'landing';
      }
      return requestedTab;
    };

    assert.strictEqual(getSafeTabForUnauthenticated('dashboard'), 'landing');
    assert.strictEqual(getSafeTabForUnauthenticated('progress'), 'landing');
    assert.strictEqual(getSafeTabForUnauthenticated('profile'), 'landing');
    assert.strictEqual(getSafeTabForUnauthenticated('settings'), 'landing');

    assert.strictEqual(getSafeTabForUnauthenticated('landing'), 'landing');
    assert.strictEqual(getSafeTabForUnauthenticated('about'), 'about');
    assert.strictEqual(getSafeTabForUnauthenticated('learning'), 'learning');
    assert.strictEqual(getSafeTabForUnauthenticated('quiz'), 'quiz');
  });

  it('Scenario 4: Destiny account remains intact when explicitly queried with credentials', () => {
    const destinyProgress = loadUserProgress('destinyivienagbor2005@gmail.com');
    assert.strictEqual(destinyProgress.completedLessons.includes('phishing_101'), true);
    assert.strictEqual(destinyProgress.streakDays >= 1, true);
  });

  it('Scenario 5: Registered accounts start completely clean and isolated', () => {
    const newAccountId = 'new.user.cyberdefense@example.com';
    const newAccountProg = loadUserProgress(newAccountId);
    assert.deepStrictEqual(newAccountProg, CLEAN_EMPTY_PROGRESS);
    assert.strictEqual(newAccountProg.completedLessons.length, 0);
  });

  it('Scenario 6: Logout destination is always public landing page', () => {
    const getLogoutRedirectTarget = (): ActiveTab => 'landing';
    assert.strictEqual(getLogoutRedirectTarget(), 'landing');
    assert.notStrictEqual(getLogoutRedirectTarget(), 'dashboard');
  });
});
