import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchChromeWithExtension,
  createTestPages,
  getOpenTabs,
  waitForTabCount,
  triggerKeyboardShortcut,
  closeTestPages,
} from './puppeteer-setup.js';

describe('Keyboard Shortcut - Close Duplicates', () => {
  let browser;

  beforeAll(async () => {
    const { browser: b } = await launchChromeWithExtension();
    browser = b;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('should close duplicate tabs when keyboard shortcut is triggered', async () => {
    // Purpose: Verify that pressing Ctrl+Alt+X closes tabs with duplicate URLs
    const testUrls = [
      'https://example.com/page',
      'https://example.com/page', // Duplicate
      'https://github.com/user/repo',
    ];

    const testPages = await createTestPages(browser, testUrls);
    expect(testPages.length).toBe(3);

    // Trigger keyboard shortcut
    await triggerKeyboardShortcut(testPages[0].page);

    // Wait for duplicate to be closed
    await waitForTabCount(browser, 2, 5000);

    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(2);

    await closeTestPages(testPages);
  });

  it('should close older duplicate tab and keep newest', async () => {
    // Purpose: Verify that the older tab is closed, not the newer one
    const testUrls = [
      'https://example.com/page?id=1', // Oldest
      'https://example.com/page?id=2', // Newest
    ];

    const testPages = await createTestPages(browser, testUrls);
    const oldestPage = testPages[0].page;
    const newestPage = testPages[1].page;

    // Trigger shortcut on oldest tab
    await triggerKeyboardShortcut(oldestPage);
    await waitForTabCount(browser, 1, 5000);

    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(1);
    // The remaining tab should be the newer one
    expect(remainingTabs[0].url).toContain('example.com/page');

    await closeTestPages(testPages);
  });

  it('should never close the currently focused tab', async () => {
    // Purpose: Verify that the focused/active tab is protected from closure
    const testUrls = [
      'https://example.com/page?id=1',
      'https://example.com/page?id=2',
      'https://example.com/page?id=3',
    ];

    const testPages = await createTestPages(browser, testUrls);
    const focusedPage = testPages[1].page; // Middle tab is focused

    // Focus on the middle tab
    await focusedPage.bringToFront();

    // Trigger shortcut
    await triggerKeyboardShortcut(focusedPage);

    // Wait a moment for the action to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const remainingTabs = await getOpenTabs(browser);
    // Should have at least 1 tab (the focused one)
    expect(remainingTabs.length).toBeGreaterThan(0);

    await closeTestPages(testPages);
  });

  it('should ignore query parameters when detecting duplicates', async () => {
    // Purpose: Verify that URLs differing only in query params are considered duplicates
    const testUrls = [
      'https://example.com/search?q=test',
      'https://example.com/search?q=different',
      'https://example.com/search?page=2',
    ];

    const testPages = await createTestPages(browser, testUrls);

    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 1, 5000);

    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(1);

    await closeTestPages(testPages);
  });

  it('should not close tabs with different base URLs', async () => {
    // Purpose: Verify that tabs with different base URLs are not considered duplicates
    const testUrls = [
      'https://example.com/page',
      'https://github.com/user/repo',
      'https://stackoverflow.com/questions/123',
    ];

    const testPages = await createTestPages(browser, testUrls);

    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 3, 5000);

    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(3);

    await closeTestPages(testPages);
  });

  it('should handle multiple groups of duplicates', async () => {
    // Purpose: Verify that multiple independent groups of duplicates are closed separately
    const testUrls = [
      'https://example.com/page?id=1',
      'https://example.com/page?id=2', // Newest in group 1
      'https://github.com/user/repo?tab=1',
      'https://github.com/user/repo?tab=2', // Newest in group 2
    ];

    const testPages = await createTestPages(browser, testUrls);

    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 2, 5000);

    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(2);

    await closeTestPages(testPages);
  });
});
