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
});
