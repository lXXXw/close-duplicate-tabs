# close-duplicate-tabs - Project Planning

## Project Overview
A Chrome extension that allows users to close duplicate tabs based on predefined and custom regex rules, with the ability to reopen recently closed tabs.

## Goals
- Provide predefined rules for common duplicate-closing scenarios (e.g., ignore URL parameters)
- Allow users to define custom regex rules to match tab URLs
- Close duplicate tabs automatically (keeping only the newest one per URL pattern)
- Allow users to reopen tabs closed by the last trigger
- Simple, intuitive popup interface for managing rules and triggering actions
- Personal use case, but extensible for Chrome Web Store publication

## Architecture

### File Structure
```
close-duplicate-tabs/
├── manifest.json           # Chrome extension manifest
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic
├── background.js          # Service worker for tab operations
├── icons/
│   └── icon-128.png       # Extension icon (128x128)
└── README.md
```

### Key Components

1. **manifest.json**
   - Permissions: tabs, storage
   - Background service worker
   - Popup action entry point
   - Manifest version: 3
   - Keyboard shortcuts: Cmd+Shift+X (macOS) / Ctrl+Shift+X (other OS)

2. **popup.html/css/js**
   - Display list of predefined rules as buttons
   - Display list of custom rules as buttons
   - "Add Rule" button and form modal (name + regex input)
   - Delete button (x) on hover for custom rules
   - "Reopen Last Closed" button (conditional - only shows if tabs were closed)
   - Display count of tabs closed in last action (near reopen button)

3. **background.js**
   - Define predefined rules with explicit matching logic
   - Match tabs against rule patterns (both predefined and custom)
   - Identify duplicates based on rule type
   - Close older tabs, keep newest
   - Store closed tab info for reopening
   - Restore tabs on user request
   - Handle keyboard shortcut commands for default behavior

## Keyboard Shortcuts

### Default Behavior Trigger (Cmd+Shift+X on Mac / Ctrl+Shift+X on Windows/Linux)
- Closes tabs with duplicate URLs (base URL only, ignoring query params)
- Keeps only the most recently created tab for each unique base URL
- **Important**: Never closes the currently-focused/active tab
- Stores closed tab info for potential reopening via "Reopen Last Closed" button

## Data Model

### Custom Rules Storage (chrome.storage.sync)
```
{
  "rules": [
    { "id": "custom-1", "name": "GitHub Issues", "regex": "https://github\\.com/.*/issues/.*" },
    { "id": "custom-2", "name": "Stack Overflow", "regex": "https://stackoverflow\\.com/.*" }
  ]
}
```

### Closed Tabs Storage (chrome.storage.local)
```
{
  "lastClosedTabs": [
    { "id": 123, "url": "https://example.com", "title": "Example" },
    { "id": 124, "url": "https://github.com/user/repo", "title": "Repo" }
  ],
  "closedTabsCount": 2
}
```

## Predefined Rules (Hard-coded in background.js)

### Rule 1: "Close Duplicates (Ignore Params)"
- **Description**: Matches tabs and considers them duplicates if the base URL is the same, ignoring query parameters and fragments
- **Logic**:
  - Extract base URL by removing everything after `?` and `#`
  - Compare base URLs for duplicates
  - Example: `https://example.com/page?id=1` and `https://example.com/page?id=2` are duplicates
- **Scope**: Matches all http/https URLs

## Implementation Details

### Duplicate Detection Algorithm
1. Get all open tabs
2. Filter out special URLs (chrome://, about://, extension://, etc.)
3. Apply rule's matching logic:
   - For predefined rules: use explicit logic
   - For custom rules: test URL against regex pattern
4. For matching tabs:
   - Group by the effective URL (base URL for ignore_params, full URL for regex)
   - Sort each group by tab creation order (oldest first)
   - For each group:
     - If the active/focused tab is in the group, keep it and close all others
     - If the active tab is NOT in the group, keep the newest and close all others
5. Store closed tab info for potential reopening

### URL Filtering
- Ignore special URLs: `chrome://`, `about:`, `chrome-extension://`, `edge://`
- Match only regular http/https URLs

### Reopen Functionality
- Remember only the tabs closed by the last trigger event
- On "Reopen Last Closed" click, restore all previously closed tabs
- Clear history after reopen or on extension reload

## Style & Code Guidelines
- Vanilla JavaScript (no frameworks, no build tools)
- Use descriptive function names and add comments for non-obvious logic
- Use modules and functions for code management
- Keep functions short - no huge functions(more than 200 lines-of-code)
- Follow Chrome extension best practices (MV3)
- Consistent naming: camelCase for variables/functions, snake_case for storage keys
- Add inline "Reason:" comments explaining the _why_ for non-obvious logic

## Browser Support
- Chrome latest version

## Future Enhancements (not in scope)
- Preview of which tabs will be closed before action
- Enable/disable individual rules
- Regex testing tool in UI
- Statistics/analytics on closed tabs
- Additional predefined rules
