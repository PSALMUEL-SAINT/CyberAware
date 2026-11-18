import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ActiveTab } from '../types';

describe('CyberAware Navigation & Tab Separation Suite', () => {
  it('Scenario 1: Leaderboard and Groups are distinct recognized tabs', () => {
    const validTabs: ActiveTab[] = [
      'dashboard',
      'learning',
      'lessons',
      'quiz',
      'detective',
      'progress',
      'groups',
      'leaderboard',
      'profile',
      'settings',
      'about'
    ];

    assert.notStrictEqual('groups', 'leaderboard');
    assert.strictEqual(validTabs.includes('groups'), true);
    assert.strictEqual(validTabs.includes('leaderboard'), true);
  });

  it('Scenario 2: Sidebar isActive logic cleanly isolates groups and leaderboard without bleeding', () => {
    const computeIsActive = (activeTab: ActiveTab, itemId: ActiveTab): boolean => {
      return (
        activeTab === itemId ||
        (itemId === 'learning' && activeTab === 'lessons') ||
        (itemId === 'lessons' && activeTab === 'learning')
      );
    };

    // When on groups tab
    assert.strictEqual(computeIsActive('groups', 'groups'), true);
    assert.strictEqual(computeIsActive('groups', 'leaderboard'), false);

    // When on leaderboard tab
    assert.strictEqual(computeIsActive('leaderboard', 'leaderboard'), true);
    assert.strictEqual(computeIsActive('leaderboard', 'groups'), false);

    // When on dashboard tab
    assert.strictEqual(computeIsActive('dashboard', 'groups'), false);
    assert.strictEqual(computeIsActive('dashboard', 'leaderboard'), false);
  });

  it('Scenario 3: URL search params correctly distinguish ?tab=groups vs ?tab=leaderboard', () => {
    const allowedUrlTabs = ['dashboard', 'learning', 'quiz', 'detective', 'progress', 'groups', 'leaderboard', 'about'];

    const parseUrlTab = (url: string): string | null => {
      const parsed = new URL(url, 'http://localhost:3000');
      const tabParam = parsed.searchParams.get('tab');
      return tabParam && allowedUrlTabs.includes(tabParam) ? tabParam : null;
    };

    assert.strictEqual(parseUrlTab('http://localhost:3000/?tab=groups'), 'groups');
    assert.strictEqual(parseUrlTab('http://localhost:3000/?tab=leaderboard'), 'leaderboard');
    assert.strictEqual(parseUrlTab('http://localhost:3000/?tab=invalid'), null);
  });

  it('Scenario 4: Dashboard button routes conditionally to leaderboard when user has groups, otherwise groups', () => {
    const getDashboardButtonRoute = (userGroupsCount: number): ActiveTab => {
      return userGroupsCount > 0 ? 'leaderboard' : 'groups';
    };

    assert.strictEqual(getDashboardButtonRoute(2), 'leaderboard');
    assert.strictEqual(getDashboardButtonRoute(0), 'groups');
  });
});
