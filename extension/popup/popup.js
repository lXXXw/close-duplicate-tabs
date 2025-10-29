// Popup UI logic for close-duplicate-tabs extension

const predefinedRulesContainer = document.getElementById('predefinedRulesContainer');
const customRulesContainer = document.getElementById('customRulesContainer');
const addRuleBtn = document.getElementById('addRuleBtn');
const addRuleModal = document.getElementById('addRuleModal');
const addRuleForm = document.getElementById('addRuleForm');
const closeModalBtn = document.querySelector('.close');
const reopenBtn = document.getElementById('reopenBtn');
const reopenSection = document.getElementById('reopenSection');
const closedCountSpan = document.getElementById('closedCount');

/**
 * Send message to background service worker
 * @param {Object} message - Message object
 * @returns {Promise}
 */
function sendToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/**
 * Delete a custom rule
 */
async function deleteRule(ruleId) {
  if (!confirm('Delete this rule?')) return;

  const data = await chrome.storage.sync.get(['rules']);
  const rules = (data.rules || []).filter((r) => r.id !== ruleId);
  await chrome.storage.sync.set({ rules });
  loadPopupData();
}

/**
 * Edit a custom rule - open modal with current values
 */
function editRule(rule) {
  document.querySelector('.modal-content h2').textContent = 'Edit Custom Rule';
  document.getElementById('ruleName').value = rule.name;
  document.getElementById('ruleRegex').value = rule.regex;
  addRuleModal.setAttribute('data-edit-id', rule.id);
  addRuleModal.style.display = 'flex';
}

/**
 * Test a custom rule - show which tabs would be closed
 */
async function testRule(rule) {
  try {
    const response = await sendToBackground({
      action: 'testCustomRule',
      ruleRegex: rule.regex,
    });

    if (response.matchingTabIds && response.matchingTabIds.length > 0) {
      alert(`Found ${response.matchingTabIds.length} matching tabs.\n\nTab IDs: ${response.matchingTabIds.join(', ')}`);
    } else {
      alert('No matching tabs found for this rule.');
    }
  } catch (error) {
    alert(`Error testing rule: ${error.message}`);
  }
}

/**
 * Execute a custom rule by sending it to the background service worker
 */
async function executeRule(rule) {
  try {
    console.log('Executing custom rule:', rule.name, 'Pattern:', rule.regex);
    const response = await sendToBackground({
      action: 'executeCustomRule',
      ruleName: rule.name,
      ruleRegex: rule.regex,
    });
    console.log('Custom rule response:', response);
    // Refresh popup data to show updated closed count
    await loadPopupData();
  } catch (error) {
    console.error('Error executing custom rule:', error);
    alert(`Error executing rule "${rule.name}": ${error.message}`);
  }
}

/**
 * Handle predefined rule click
 */
function handlePredefinedRuleClick(ruleType) {
  if (ruleType === 'ignore-params') {
    // The utility functions handle this
    sendToBackground({ action: 'executeCloseDuplicates' });
  }
}

/**
 * Handle reopen button click
 */
async function handleReopen() {
  await sendToBackground({ action: 'restoreLastClosed' });
  updateReopenButton();
}

/**
 * Handle add/edit rule form submission
 */
async function handleAddRule(e) {
  e.preventDefault();

  const name = document.getElementById('ruleName').value.trim();
  const regex = document.getElementById('ruleRegex').value.trim();

  if (!name || !regex) {
    alert('Please fill in all fields');
    return;
  }

  // Validate regex
  try {
    new RegExp(regex);
  } catch {
    alert('Invalid regex pattern');
    return;
  }

  const data = await chrome.storage.sync.get(['rules']);
  let rules = data.rules || [];

  const editId = addRuleModal.getAttribute('data-edit-id');

  if (editId) {
    // Edit mode: update existing rule
    rules = rules.map((r) =>
      r.id === editId ? { ...r, name, regex } : r
    );
    addRuleModal.removeAttribute('data-edit-id');
  } else {
    // Add mode: create new rule
    const newRule = {
      id: `custom-${Date.now()}`,
      name,
      regex,
    };
    rules.push(newRule);
  }

  await chrome.storage.sync.set({ rules });

  addRuleForm.reset();
  addRuleModal.style.display = 'none';
  // Reset modal title for next use
  document.querySelector('.modal-content h2').textContent = 'Add Custom Rule';
  loadPopupData();
}

/**
 * Initialize modal
 */
function initModal() {
  addRuleBtn.addEventListener('click', () => {
    addRuleModal.style.display = 'flex';
  });

  closeModalBtn.addEventListener('click', () => {
    addRuleModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === addRuleModal) {
      addRuleModal.style.display = 'none';
    }
  });

  addRuleForm.addEventListener('submit', handleAddRule);
}

/**
 * Load all popup data in parallel
 */
async function loadPopupData() {
  // Reason: Fetch both storage calls in parallel for faster popup display
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['rules']),
    chrome.storage.local.get(['closedTabsCount']),
  ]);

  // Update UI with fetched data
  const rules = syncData.rules || [];
  const count = localData.closedTabsCount || 0;

  // Render custom rules
  customRulesContainer.innerHTML = '';
  if (rules.length === 0) {
    customRulesContainer.innerHTML = '<p style="color: #999; font-size: 12px;">No custom rules yet</p>';
  } else {
    const fragment = document.createDocumentFragment();
    rules.forEach((rule) => {
      const ruleBtn = document.createElement('button');
      ruleBtn.className = 'rule-btn custom';
      ruleBtn.textContent = rule.name;
      ruleBtn.type = 'button';

      // Test button
      const testBtn = document.createElement('button');
      testBtn.className = 'rule-action-btn rule-test-btn';
      const testImg = document.createElement('img');
      testImg.src = chrome.runtime.getURL('icons/test.png');
      testImg.alt = 'Test';
      testBtn.appendChild(testImg);
      testBtn.title = 'Test this rule';
      testBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        testRule(rule);
      });

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'rule-action-btn rule-edit-btn';
      const editImg = document.createElement('img');
      editImg.src = chrome.runtime.getURL('icons/edit.png');
      editImg.alt = 'Edit';
      editBtn.appendChild(editImg);
      editBtn.title = 'Edit this rule';
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editRule(rule);
      });

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rule-action-btn rule-delete-btn';
      const deleteImg = document.createElement('img');
      deleteImg.src = chrome.runtime.getURL('icons/delete.png');
      deleteImg.alt = 'Delete';
      deleteBtn.appendChild(deleteImg);
      deleteBtn.title = 'Delete this rule';
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteRule(rule.id);
      });

      ruleBtn.appendChild(testBtn);
      ruleBtn.appendChild(editBtn);
      ruleBtn.appendChild(deleteBtn);

      ruleBtn.addEventListener('click', () => {
        executeRule(rule);
      });

      fragment.appendChild(ruleBtn);
    });
    customRulesContainer.appendChild(fragment);
  }

  // Update reopen button
  if (count > 0) {
    reopenSection.style.display = 'block';
    closedCountSpan.textContent = `(${count} tab${count > 1 ? 's' : ''} closed)`;
  } else {
    reopenSection.style.display = 'none';
  }
}

/**
 * Initialize all listeners and load data
 */
function init() {
  // Set up predefined rule buttons
  const predefinedBtn = predefinedRulesContainer.querySelector('.rule-btn');
  if (predefinedBtn) {
    predefinedBtn.addEventListener('click', () => {
      handlePredefinedRuleClick('ignore-params');
    });
  }

  // Set up reopen button
  reopenBtn.addEventListener('click', handleReopen);

  // Initialize modal
  initModal();

  // Load all data in parallel
  loadPopupData();

  // Reason: Refresh reopen button when popup is opened/focused
  window.addEventListener('focus', () => {
    loadPopupData();
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
