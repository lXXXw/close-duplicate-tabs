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
 * Load and display custom rules
 */
async function loadCustomRules() {
  const data = await chrome.storage.sync.get(['rules']);
  const rules = data.rules || [];

  customRulesContainer.innerHTML = '';

  if (rules.length === 0) {
    customRulesContainer.innerHTML = '<p style="color: #999; font-size: 12px;">No custom rules yet</p>';
    return;
  }

  rules.forEach((rule) => {
    const ruleBtn = document.createElement('button');
    ruleBtn.className = 'rule-btn custom';
    ruleBtn.textContent = rule.name;
    ruleBtn.type = 'button';

    // Add delete functionality on right-click or via a delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: red;
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
    `;

    ruleBtn.style.position = 'relative';
    ruleBtn.appendChild(deleteBtn);

    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteRule(rule.id);
    });

    ruleBtn.addEventListener('click', () => {
      executeRule(rule);
    });

    customRulesContainer.appendChild(ruleBtn);
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
  loadCustomRules();
}

/**
 * Execute a rule (currently placeholder for future implementation)
 */
function executeRule(rule) {
  // Placeholder: In future, this can execute custom regex-based rules
  console.log('Executing rule:', rule);
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
 * Update the reopen button visibility and closed count
 */
async function updateReopenButton() {
  const data = await chrome.storage.local.get(['closedTabsCount']);
  const count = data.closedTabsCount || 0;

  if (count > 0) {
    reopenSection.style.display = 'block';
    closedCountSpan.textContent = `(${count} tab${count > 1 ? 's' : ''} closed)`;
  } else {
    reopenSection.style.display = 'none';
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
 * Handle add rule form submission
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
  const rules = data.rules || [];

  const newRule = {
    id: `custom-${Date.now()}`,
    name,
    regex,
  };

  rules.push(newRule);
  await chrome.storage.sync.set({ rules });

  addRuleForm.reset();
  addRuleModal.style.display = 'none';
  loadCustomRules();
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

  // Load custom rules and update reopen button
  loadCustomRules();
  updateReopenButton();

  // Reason: Refresh reopen button when popup is opened/focused
  window.addEventListener('focus', updateReopenButton);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
