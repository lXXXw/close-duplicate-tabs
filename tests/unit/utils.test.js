import { describe, it, expect } from 'vitest';
import {
  getBaseUrl,
  groupTabsByBaseUrl,
  filterSpecialUrls,
  findTabsToClose,
} from '../../extension/utils.js';

describe('getBaseUrl', () => {
  it('extracts base URL without query parameters', () => {
    const url = 'https://example.com/page?id=1&name=test';
    expect(getBaseUrl(url)).toBe('https://example.com/page');
  });

  it('extracts base URL without fragments', () => {
    const url = 'https://example.com/page#section';
    expect(getBaseUrl(url)).toBe('https://example.com/page');
  });

  it('extracts base URL removing both params and fragments', () => {
    const url = 'https://example.com/page?id=1#section';
    expect(getBaseUrl(url)).toBe('https://example.com/page');
  });

  it('returns URL without params or fragments unchanged', () => {
    const url = 'https://example.com/page';
    expect(getBaseUrl(url)).toBe('https://example.com/page');
  });

  it('handles URLs with different protocols', () => {
    const httpUrl = 'http://example.com/page?id=1';
    expect(getBaseUrl(httpUrl)).toBe('http://example.com/page');
  });

  it('gracefully handles invalid URLs', () => {
    const invalidUrl = 'not a url';
    // Should not crash, just return the input
    expect(() => getBaseUrl(invalidUrl)).not.toThrow();
  });
});

describe('groupTabsByBaseUrl', () => {
  it('groups tabs with same base URL together', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page?id=1' },
      { id: 2, url: 'https://example.com/page?id=2' },
      { id: 3, url: 'https://example.com/other' },
    ];
    const groups = groupTabsByBaseUrl(tabs);

    expect(Object.keys(groups).length).toBe(2);
    expect(groups['https://example.com/page'].length).toBe(2);
    expect(groups['https://example.com/other'].length).toBe(1);
  });

  it('returns empty object for empty tab array', () => {
    expect(groupTabsByBaseUrl([])).toEqual({});
  });

  it('creates one group per unique base URL', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/user/repo' },
      { id: 2, url: 'https://github.com/other/repo' },
      { id: 3, url: 'https://stackoverflow.com/questions/123' },
    ];
    const groups = groupTabsByBaseUrl(tabs);

    expect(Object.keys(groups).length).toBe(3);
  });
});

describe('filterSpecialUrls', () => {
  it('removes chrome:// URLs', () => {
    const tabs = [
      { id: 1, url: 'chrome://settings' },
      { id: 2, url: 'https://example.com' },
    ];
    const filtered = filterSpecialUrls(tabs);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('removes about: URLs', () => {
    const tabs = [
      { id: 1, url: 'about:blank' },
      { id: 2, url: 'https://example.com' },
    ];
    const filtered = filterSpecialUrls(tabs);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('removes chrome-extension:// URLs', () => {
    const tabs = [
      { id: 1, url: 'chrome-extension://abc123/popup.html' },
      { id: 2, url: 'https://example.com' },
    ];
    const filtered = filterSpecialUrls(tabs);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('removes edge:// URLs', () => {
    const tabs = [
      { id: 1, url: 'edge://settings' },
      { id: 2, url: 'https://example.com' },
    ];
    const filtered = filterSpecialUrls(tabs);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('returns empty array when all URLs are special', () => {
    const tabs = [
      { id: 1, url: 'chrome://settings' },
      { id: 2, url: 'about:blank' },
    ];
    expect(filterSpecialUrls(tabs).length).toBe(0);
  });
});

describe('Custom Rule Matching', () => {
  /**
   * Helper function to match tabs against a regex pattern
   * Used for testing custom rule logic
   */
  function matchTabsAgainstRegex(tabs, regexPattern) {
    try {
      const pattern = new RegExp(regexPattern);
      return tabs.filter(tab => pattern.test(tab.url));
    } catch {
      return [];
    }
  }

  /**
   * Determine which tabs to close for a custom rule
   * Keeps active tab if it matches, otherwise keeps newest
   */
  function findTabsToCloseForCustomRule(tabs, regexPattern, currentTabId) {
    const matchingTabs = matchTabsAgainstRegex(tabs, regexPattern);

    if (matchingTabs.length <= 1) {
      return [];
    }

    const tabsToClose = [];
    const isActiveTabInMatches = matchingTabs.some(tab => tab.id === currentTabId);

    matchingTabs.forEach(tab => {
      if (tab.id === currentTabId && isActiveTabInMatches) {
        return;
      }
      if (!isActiveTabInMatches && tab.id === matchingTabs[matchingTabs.length - 1].id) {
        return;
      }
      tabsToClose.push(tab.id);
    });

    return tabsToClose;
  }

  it('matches tabs using regex pattern', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/user/repo' },
      { id: 2, url: 'https://github.com/other/repo' },
      { id: 3, url: 'https://stackoverflow.com/questions/123' },
    ];
    const pattern = 'github\\.com';
    const matched = matchTabsAgainstRegex(tabs, pattern);
    expect(matched.length).toBe(2);
    expect(matched[0].id).toBe(1);
    expect(matched[1].id).toBe(2);
  });

  it('handles invalid regex gracefully', () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
    ];
    const matched = matchTabsAgainstRegex(tabs, '[invalid(regex');
    expect(matched.length).toBe(0);
  });

  it('closes non-active matching tabs, keeping the active one', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/user/repo1' },
      { id: 2, url: 'https://github.com/user/repo2' },
      { id: 3, url: 'https://github.com/user/repo3' },
    ];
    const pattern = 'github\\.com';
    const toClose = findTabsToCloseForCustomRule(tabs, pattern, 2); // Tab 2 is active
    expect(toClose).not.toContain(2);
    expect(toClose).toContain(1);
    expect(toClose).toContain(3);
  });

  it('closes matching tabs except newest, when active tab does not match', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/user/repo1' },
      { id: 2, url: 'https://github.com/user/repo2' },
      { id: 3, url: 'https://example.com' },
    ];
    const pattern = 'github\\.com';
    const toClose = findTabsToCloseForCustomRule(tabs, pattern, 3); // Tab 3 is active but doesn't match
    expect(toClose).toContain(1);
    expect(toClose).not.toContain(2); // Keep newest matching
    expect(toClose).not.toContain(3); // Active tab never closed
  });

  it('returns empty array when less than 2 tabs match', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/user/repo' },
      { id: 2, url: 'https://example.com' },
    ];
    const pattern = 'github\\.com';
    const toClose = findTabsToCloseForCustomRule(tabs, pattern, 999);
    expect(toClose.length).toBe(0);
  });

  it('handles complex regex patterns', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/search?q=test' },
      { id: 2, url: 'https://example.com/search?q=another' },
      { id: 3, url: 'https://example.com/page' },
    ];
    const pattern = '/search\\?'; // Match any search URL
    const matched = matchTabsAgainstRegex(tabs, pattern);
    expect(matched.length).toBe(2);
  });
});

describe('findTabsToClose', () => {
  it('identifies duplicate tabs to close, keeping newest when no active tab in group', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page?id=1' },
      { id: 2, url: 'https://example.com/page?id=2' },
      { id: 3, url: 'https://example.com/page?id=3' },
    ];
    const toClose = findTabsToClose(tabs, 999); // Active tab is not in this group
    // Should close tabs 1 and 2, keep the newest (tab 3)
    expect(toClose).toContain(1);
    expect(toClose).toContain(2);
    expect(toClose).not.toContain(3);
  });

  it('keeps active tab even if it is not the newest', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page' },
      { id: 2, url: 'https://example.com/page' },
      { id: 3, url: 'https://example.com/page' },
    ];
    const toClose = findTabsToClose(tabs, 2); // Tab 2 is active but not newest
    // Should keep tab 2 (active) and close tabs 1 and 3
    expect(toClose).toContain(1);
    expect(toClose).toContain(3);
    expect(toClose).not.toContain(2);
  });

  it('returns empty array when no duplicates exist', () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://github.com' },
      { id: 3, url: 'https://stackoverflow.com' },
    ];
    expect(findTabsToClose(tabs, 999).length).toBe(0);
  });

  it('ignores special URLs and only processes regular URLs', () => {
    const tabs = [
      { id: 1, url: 'chrome://settings' },
      { id: 2, url: 'https://example.com' },
      { id: 3, url: 'https://example.com?id=1' },
      { id: 4, url: 'about:blank' },
    ];
    const toClose = findTabsToClose(tabs, 999);
    // Should not include special URL tabs, should close tab 2
    expect(toClose).not.toContain(1);
    expect(toClose).toContain(2);
    expect(toClose).not.toContain(4);
  });

  it('handles single tab with no duplicates', () => {
    const tabs = [{ id: 1, url: 'https://example.com' }];
    expect(findTabsToClose(tabs, 999).length).toBe(0);
  });

  it('handles multiple groups of duplicates, keeping newest in each group', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://example.com/page1?id=1' },
      { id: 3, url: 'https://example.com/page2' },
      { id: 4, url: 'https://example.com/page2?id=1' },
    ];
    const toClose = findTabsToClose(tabs, 999); // Active tab is not in any group
    // Should close tab 1 (keep 2 - newest in group 1) and tab 3 (keep 4 - newest in group 2)
    expect(toClose).toContain(1);
    expect(toClose).not.toContain(2);
    expect(toClose).toContain(3);
    expect(toClose).not.toContain(4);
  });

  it('prioritizes active tab in one group while keeping newest in other groups', () => {
    const tabs = [
      { id: 1, url: 'https://example.com/page1' },
      { id: 2, url: 'https://example.com/page1?id=1' },
      { id: 3, url: 'https://example.com/page2' },
      { id: 4, url: 'https://example.com/page2?id=1' },
    ];
    const toClose = findTabsToClose(tabs, 1); // Tab 1 is active (but not newest in its group)
    // Should keep tab 1 (active in group 1) and close tab 2
    // Should keep tab 4 (newest in group 2) and close tab 3
    expect(toClose).not.toContain(1);
    expect(toClose).toContain(2);
    expect(toClose).toContain(3);
    expect(toClose).not.toContain(4);
  });
});
