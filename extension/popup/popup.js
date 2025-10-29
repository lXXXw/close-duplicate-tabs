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
