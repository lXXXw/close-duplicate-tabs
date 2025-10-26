// Utility functions for duplicate tab detection and management
// These functions are pure and don't depend on Chrome APIs

/**
 * Extract base URL by removing query parameters and fragments
 * @param {string} url - The full URL
 * @returns {string} Base URL without params and fragments
 */
export function getBaseUrl(url) {
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
export function groupTabsByBaseUrl(tabs) {
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
export function filterSpecialUrls(tabs) {
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
export function findTabsToClose(tabs, currentTabId) {
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
