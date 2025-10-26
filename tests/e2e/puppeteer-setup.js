// Puppeteer setup and helpers for extension testing

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../extension');

/**
 * Launch Chrome with the extension loaded
 * @returns {Promise<{browser: Browser, extensionPageUrl: string}>}
 */
export async function launchChromeWithExtension() {
  const browser = await puppeteer.launch({
    headless: false, // Reason: Extensions require headless: false for Manifest V3
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--enable-automation',
      '--no-first-run',
      '--password-store=basic',
      '--use-mock-volume-service',
    ],
  });

  // Get extension page URL
  const extensionPageUrl = await getExtensionPageUrl(browser);

  return { browser, extensionPageUrl };
}

/**
 * Get the extension's background page URL
 * @param {Browser} browser
 * @returns {Promise<string>}
 */
export async function getExtensionPageUrl(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (target) =>
      target.type() === 'background_page' &&
      target.url().includes('chrome-extension://')
  );

  if (!extensionTarget) {
    throw new Error('Could not find extension background page');
  }

  return extensionTarget.url();
}

/**
 * Create test pages (tabs) with specific URLs
 * @param {Browser} browser
 * @param {Array<string>} urls - URLs to open
 * @returns {Promise<Array<{url: string, page: Page}>>}
 */
export async function createTestPages(browser, urls) {
  const pages = [];

  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    } catch {
      // Some URLs might not load, but that's okay for testing
      await page.goto('about:blank');
    }
    pages.push({ url, page });
  }

  return pages;
}

/**
 * Get all open tabs in the current window
 * @param {Browser} browser
 * @returns {Promise<Array>}
 */
export async function getOpenTabs(browser) {
  const pages = await browser.pages();
  const tabs = [];

  for (const page of pages) {
    const url = page.url();
    if (!url.startsWith('chrome-extension://') && !url.startsWith('about:blank')) {
      tabs.push({ url, page });
    }
  }

  return tabs;
}

/**
 * Wait for a specific number of tabs to be closed
 * @param {Browser} browser
 * @param {number} expectedTabCount - Expected number of remaining tabs
 * @param {number} timeout - Max wait time in ms
 */
export async function waitForTabCount(browser, expectedTabCount, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const pages = await browser.pages();
    // Count non-extension, non-blank pages
    const regularPages = pages.filter(
      (p) =>
        !p.url().startsWith('chrome-extension://') &&
        p.url() !== 'about:blank'
    );

    if (regularPages.length === expectedTabCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timeout waiting for ${expectedTabCount} tabs. Current count: ${(await browser.pages()).length}`
  );
}

/**
 * Trigger keyboard shortcut (Ctrl+Alt+X on Windows/Linux, Cmd+Option+X on Mac)
 * @param {Page} page - Page to trigger shortcut on
 */
export async function triggerKeyboardShortcut(page) {
  // Reason: Use keyboard event to simulate the shortcut
  await page.keyboard.press('Escape'); // Ensure page is focused
  await page.keyboard.down('Control');
  await page.keyboard.down('Alt');
  await page.keyboard.press('KeyX');
  await page.keyboard.up('Alt');
  await page.keyboard.up('Control');
}

/**
 * Close all test pages except the extension background page
 * @param {Array<{page: Page}>} pages - Pages to close
 */
export async function closeTestPages(pages) {
  for (const { page } of pages) {
    try {
      await page.close();
    } catch {
      // Ignore errors if page is already closed
    }
  }
}
