// Service worker for close-duplicate-tabs extension
// Handles keyboard shortcuts and tab management

/**
 * Extract base URL by removing query parameters and fragments
 * @param {string} url - The full URL
 * @returns {string} Base URL without params and fragments
 */
function getBaseUrl(url) {
  try {
    const urlObj = new URL(url);
    // Reason: Remove everything after ? and # to get the base URL
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    // Invalid URLs should not crash the function
    return url;
  }
}

/**
 * Group tabs by their base URL
 * @param {Array} tabs - Array of tab objects with id, url properties
 * @returns {Object} Object with base URLs as keys and arrays of tabs as values
 */
function groupTabsByBaseUrl(tabs) {
  return tabs.reduce((groups, tab) => {
    const baseUrl = getBaseUrl(tab.url);
    if (!groups[baseUrl]) {
      groups[baseUrl] = [];
    }
    groups[baseUrl].push(tab);
    return groups;
  }, {});
}

/**
 * Filter out special URLs that shouldn't be closed
 * @param {Array} tabs - Array of tab objects
 * @returns {Array} Filtered array of regular tabs
 */
function filterSpecialUrls(tabs) {
  const specialPrefixes = ['chrome://', 'about:', 'chrome-extension://', 'edge://'];
  return tabs.filter(tab => {
    return !specialPrefixes.some(prefix => tab.url.startsWith(prefix));
  });
}

/**
 * Find which tabs should be closed based on duplicate detection
 * Rule: If active tab is in the duplicate group, keep it. Otherwise keep the newest.
 * Never closes the currently focused tab.
 * @param {Array} tabs - Array of tab objects
 * @param {number} currentTabId - ID of the currently focused tab
 * @returns {Array} Array of tab IDs to close
 */
function findTabsToClose(tabs, currentTabId) {
  const filteredTabs = filterSpecialUrls(tabs);
  const grouped = groupTabsByBaseUrl(filteredTabs);

  const tabsToClose = [];

  Object.values(grouped).forEach(group => {
    if (group.length <= 1) {
      // Reason: No duplicates in this group, skip
      return;
    }

    // Sort by ID ascending (older tabs have lower IDs)
    group.sort((a, b) => a.id - b.id);

    // Determine which tab to keep in this group
    // Reason: If active tab is in this group, prioritize keeping it over the newest
    const isActiveTabInGroup = group.some(tab => tab.id === currentTabId);
    const tabToKeep = isActiveTabInGroup ? currentTabId : group[group.length - 1].id;

    // Close all others except the tab to keep
    group.forEach(tab => {
      if (tab.id !== tabToKeep) {
        tabsToClose.push(tab.id);
      }
    });
  });

  return tabsToClose;
}

/**
 * Get all tabs and the currently active tab
 * @returns {Promise<{tabs: Array, currentTabId: number}>}
 */
async function getAllTabsAndCurrent() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });

  return {
    tabs,
    currentTabId: currentTab[0]?.id || null,
  };
}

/**
 * Close specified tabs and store them for reopening
 * @param {Array} tabIds - Array of tab IDs to close
 */
async function closeAndStoreTabs(tabIds) {
  if (tabIds.length === 0) {
    return;
  }

  // Get tab details before closing (for reopening)
  const tabsToStore = [];
  for (const tabId of tabIds) {
    try {
      const tab = await chrome.tabs.get(tabId);
      tabsToStore.push({
        id: tab.id,
        url: tab.url,
        title: tab.title,
      });
    } catch {
      // Reason: Tab might not exist, skip it
      continue;
    }
  }

  // Reason: Store closed tabs before closing them
  await chrome.storage.local.set({
    lastClosedTabs: tabsToStore,
    closedTabsCount: tabIds.length,
  });

  // Close the tabs
  await chrome.tabs.remove(tabIds);
}

/**
 * Execute the default behavior: close duplicate tabs
 */
async function executeCloseDuplicates() {
  const { tabs, currentTabId } = await getAllTabsAndCurrent();
  const tabsToClose = findTabsToClose(tabs, currentTabId);
  await closeAndStoreTabs(tabsToClose);
}

/**
 * Execute a custom rule: find tabs matching regex and close them
 * @param {string} ruleName - Name of the rule (for logging)
 * @param {string} ruleRegex - Regex pattern to match URLs
 */
async function executeCustomRule(ruleName, ruleRegex) {
  console.log(`[CustomRule] Executing rule "${ruleName}" with pattern: ${ruleRegex}`);
  try {
    const { tabs, currentTabId } = await getAllTabsAndCurrent();
    console.log(`[CustomRule] Found ${tabs.length} total tabs, active tab ID: ${currentTabId}`);

    const filteredTabs = filterSpecialUrls(tabs);
    console.log(`[CustomRule] ${filteredTabs.length} regular tabs after filtering special URLs`);

    // Compile the regex pattern
    const pattern = new RegExp(ruleRegex);
    console.log(`[CustomRule] Compiled regex pattern`);

    // Find all tabs matching the regex pattern
    const matchingTabs = filteredTabs.filter(tab => {
      try {
        return pattern.test(tab.url);
      } catch {
        // If regex fails on a specific URL, skip it
        return false;
      }
    });

    console.log(`[CustomRule] Found ${matchingTabs.length} matching tabs`);

    if (matchingTabs.length === 0) {
      // Reason: No matching tabs found, nothing to close
      console.log(`[CustomRule] No matching tabs found`);
      return;
    }

    // Determine tabs to close
    // Reason: For custom rules, only keep the active tab if it matches the pattern
    const tabsToClose = [];
    const isActiveTabInMatches = matchingTabs.some(tab => tab.id === currentTabId);
    console.log(`[CustomRule] Active tab in matches: ${isActiveTabInMatches}`);

    matchingTabs.forEach(tab => {
      // Only keep the active tab if it's in the matching set
      if (tab.id === currentTabId && isActiveTabInMatches) {
        console.log(`[CustomRule] Keeping active tab ID ${tab.id}`);
        return;
      }
      // Close all other matching tabs
      tabsToClose.push(tab.id);
    });

    console.log(`[CustomRule] Will close ${tabsToClose.length} tabs:`, tabsToClose);
    await closeAndStoreTabs(tabsToClose);
    console.log(`[CustomRule] Rule execution complete`);
  } catch (error) {
    console.error(`[CustomRule] Error executing custom rule "${ruleName}":`, error);
    throw error;
  }
}

/**
 * Test a custom rule: find which tabs match the regex pattern
 * @param {string} ruleRegex - Regex pattern to test
 * @returns {Object} Object with matchingTabIds array
 */
async function testCustomRule(ruleRegex) {
  try {
    const { tabs } = await getAllTabsAndCurrent();
    const filteredTabs = filterSpecialUrls(tabs);

    // Compile the regex pattern
    const pattern = new RegExp(ruleRegex);

    // Find all tabs matching the regex pattern
    const matchingTabs = filteredTabs.filter(tab => {
      try {
        return pattern.test(tab.url);
      } catch {
        return false;
      }
    });

    return {
      matchingTabIds: matchingTabs.map(tab => tab.id),
      matchCount: matchingTabs.length,
    };
  } catch (error) {
    console.error('[TestCustomRule] Error:', error);
    throw error;
  }
}

/**
 * Restore the last closed tabs
 */
async function restoreLastClosedTabs() {
  const data = await chrome.storage.local.get(['lastClosedTabs']);
  const tabsToRestore = data.lastClosedTabs || [];

  if (tabsToRestore.length === 0) {
    return;
  }

  for (const tab of tabsToRestore) {
    await chrome.tabs.create({ url: tab.url });
  }

  // Clear the history after restoring
  await chrome.storage.local.remove(['lastClosedTabs', 'closedTabsCount']);
}

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'close-duplicates-default') {
    executeCloseDuplicates();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getClosedCount') {
    chrome.storage.local.get(['closedTabsCount'], (data) => {
      sendResponse({ count: data.closedTabsCount || 0 });
    });
    // Reason: Return true to indicate async response
    return true;
  }

  if (request.action === 'restoreLastClosed') {
    restoreLastClosedTabs().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'executeCloseDuplicates') {
    executeCloseDuplicates().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'executeCustomRule') {
    const { ruleName, ruleRegex } = request;
    executeCustomRule(ruleName, ruleRegex).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'testCustomRule') {
    const { ruleRegex } = request;
    testCustomRule(ruleRegex).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      sendResponse({ error: error.message });
    });
    return true;
  }
});
