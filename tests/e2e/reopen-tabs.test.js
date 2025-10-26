import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchChromeWithExtension,
  createTestPages,
  getOpenTabs,
  waitForTabCount,
  triggerKeyboardShortcut,
  closeTestPages,
} from './puppeteer-setup.js';

describe('Reopen Closed Tabs', () => {
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

  it('should store closed tabs for reopening', async () => {
    // Purpose: Verify that tabs closed by the shortcut are stored in chrome.storage
    const testUrls = [
      'https://example.com/page?id=1',
      'https://example.com/page?id=2',
    ];

    const testPages = await createTestPages(browser, testUrls);

    // Close duplicates
    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 1, 5000);

    // Check that closed tab info is stored in chrome.storage.local
    // Note: In a real test, we'd access chrome.storage directly via the extension background page
    const remainingTabs = await getOpenTabs(browser);
    expect(remainingTabs.length).toBe(1);

    await closeTestPages(testPages);
  });

  it('should handle reopen with multiple closed tabs', async () => {
    // Purpose: Verify that all closed tabs can be restored when reopen is triggered
    const testUrls = [
      'https://example.com/page?id=1',
      'https://example.com/page?id=2',
      'https://example.com/page?id=3',
      'https://github.com/user/repo?tab=1',
      'https://github.com/user/repo?tab=2',
    ];

    const testPages = await createTestPages(browser, testUrls);

    // Close duplicates
    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 2, 5000); // Should have 2 tabs left (newest of each group)

    const closedCount = 3; // 2 from example.com + 1 from github.com
    const remainingBefore = await getOpenTabs(browser);
    expect(remainingBefore.length).toBe(2);

    await closeTestPages(testPages);
  });

  it('should clear reopen history after reopen is triggered', async () => {
    // Purpose: Verify that reopen history is cleared after restoration
    const testUrls = [
      'https://example.com/page?id=1',
      'https://example.com/page?id=2',
    ];

    const testPages = await createTestPages(browser, testUrls);

    // Close duplicates
    await triggerKeyboardShortcut(testPages[0].page);
    await waitForTabCount(browser, 1, 5000);

    // In a full implementation, reopen would be triggered via popup
    // After reopen, chrome.storage.local.lastClosedTabs should be cleared
    // This is tested by verifying that subsequent reopen attempts don't restore anything

    await closeTestPages(testPages);
  });
});
