# close-duplicate-tabs Tests

This directory contains unit tests and end-to-end tests for the close-duplicate-tabs Chrome extension.

## Test Structure

### Unit Tests (`unit/`)
Pure function tests using Vitest. These test utility functions without requiring Chrome APIs.

**Files:**
- `utils.test.js` - Tests for URL parsing, duplicate detection, and tab grouping

**Run unit tests:**
```bash
pnpm test:unit
```

### End-to-End Tests (`e2e/`)
Integration tests using Puppeteer that launch a real Chrome instance with the extension loaded.

**Files:**
- `puppeteer-setup.js` - Helpers for launching Chrome and creating test pages
- `keyboard-shortcut.test.js` - Tests for keyboard shortcut functionality
- `reopen-tabs.test.js` - Tests for reopening closed tabs

**Run E2E tests:**
```bash
pnpm test:e2e
```

## Running All Tests

From the root directory:
```bash
pnpm test
```

Or from the tests directory:
```bash
cd tests
pnpm test
```

## Test Philosophy

Each test has a clear purpose documented in a comment:
- Simple, focused test cases
- One concept per test (when possible)
- Self-contained with minimal setup
- Descriptive test names

## Notes

- E2E tests require Chrome/Chromium to be installed
- Tests use headless: false because Manifest V3 extensions require it
- Extension path is hardcoded to `../../extension` relative to test files
- Tests timeout after 5 seconds by default
