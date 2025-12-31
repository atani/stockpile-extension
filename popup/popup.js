// Popup script for Stockpile extension

/**
 * Apply i18n translations to elements with data-i18n attributes
 */
function applyI18n() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) el.textContent = message;
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(key);
    if (message) el.placeholder = message;
  });

  // Titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const message = chrome.i18n.getMessage(key);
    if (message) el.title = message;
  });
}

/**
 * Get i18n message
 */
function i18n(key) {
  return chrome.i18n.getMessage(key) || key;
}

// Import from lib (need to use dynamic import for popup)
const DB_KEY = 'downloadHistory';
const SETTINGS_KEY = 'settings';

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const siteFilter = document.getElementById('siteFilter');
const downloadList = document.getElementById('downloadList');
const totalCount = document.getElementById('totalCount');
const settingsBtn = document.getElementById('settingsBtn');
const exportBtn = document.getElementById('exportBtn');

// State
let allRecords = [];
let currentFilters = {
  query: '',
  category: '',
  site: ''
};

/**
 * Load settings
 */
async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = result[SETTINGS_KEY] || { enabled: true };
  enableToggle.checked = settings.enabled !== false;
}

/**
 * Save settings
 */
async function saveSettings(updates) {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...result[SETTINGS_KEY], ...updates };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

/**
 * Load all records
 */
async function loadRecords() {
  const result = await chrome.storage.local.get(DB_KEY);
  allRecords = result[DB_KEY] || [];
  return allRecords;
}

/**
 * Filter records based on current filters
 */
function filterRecords(records) {
  return records.filter(record => {
    // Text search
    if (currentFilters.query) {
      const query = currentFilters.query.toLowerCase();
      const titleMatch = record.title?.toLowerCase().includes(query);
      const tagMatch = record.tags?.some(t => t.toLowerCase().includes(query));
      const fileMatch = record.fileName?.toLowerCase().includes(query);
      if (!titleMatch && !tagMatch && !fileMatch) return false;
    }

    // Category filter
    if (currentFilters.category && record.category !== currentFilters.category) {
      return false;
    }

    // Site filter
    if (currentFilters.site && record.site !== currentFilters.site) {
      return false;
    }

    return true;
  });
}

/**
 * Get unique values from records
 */
function getUniqueValues(records, key) {
  return [...new Set(records.map(r => r[key]).filter(Boolean))].sort();
}

/**
 * Populate filter dropdowns
 */
function populateFilters() {
  const categories = getUniqueValues(allRecords, 'category');
  const sites = getUniqueValues(allRecords, 'site');

  // Category filter
  categoryFilter.innerHTML = `<option value="">${i18n('allCategories')}</option>`;
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });

  // Site filter
  siteFilter.innerHTML = `<option value="">${i18n('allSites')}</option>`;
  sites.forEach(site => {
    const option = document.createElement('option');
    option.value = site;
    option.textContent = site;
    siteFilter.appendChild(option);
  });
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Within 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) {
      const mins = Math.floor(diff / (60 * 1000));
      return mins < 1 ? 'Just now' : `${mins}m ago`;
    }
    return `${hours}h ago`;
  }

  // Within 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d ago`;
  }

  // Older
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Render download list
 */
function renderDownloads(records) {
  totalCount.textContent = records.length;

  if (records.length === 0) {
    downloadList.innerHTML = `<div class="empty-state">${i18n('noDownloads')}</div>`;
    return;
  }

  downloadList.innerHTML = records.slice(0, 50).map(record => `
    <div class="download-item" data-id="${record.id}" data-path="${record.filePath || ''}">
      <div class="download-item-header">
        <span class="download-title">${escapeHtml(record.title || record.fileName || 'Unknown')}</span>
        <span class="download-category">${escapeHtml(record.category || 'Other')}</span>
      </div>
      <div class="download-meta">
        <span class="download-site">${escapeHtml(record.site || 'Unknown')}</span>
        <span class="download-date">${formatDate(record.downloadedAt)}</span>
        ${record.duration ? `<span class="download-duration">${escapeHtml(record.duration)}</span>` : ''}
      </div>
      ${record.tags && record.tags.length > 0 ? `
        <div class="download-tags">
          ${record.tags.slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add click handlers
  downloadList.querySelectorAll('.download-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.dataset.path;
      if (path) {
        // Copy path to clipboard
        navigator.clipboard.writeText(path).then(() => {
          item.style.background = '#e8f5e9';
          setTimeout(() => {
            item.style.background = '';
          }, 300);
        });
      }
    });
  });
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export records
 */
async function exportRecords() {
  const records = await loadRecords();

  if (records.length === 0) {
    alert('No records to export');
    return;
  }

  const json = JSON.stringify(records, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `stockpile-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Refresh display
 */
async function refresh() {
  await loadRecords();
  populateFilters();
  const filtered = filterRecords(allRecords);
  renderDownloads(filtered);
}

// Event Listeners
enableToggle.addEventListener('change', () => {
  saveSettings({ enabled: enableToggle.checked });
  updateToggleLabel();
});

searchInput.addEventListener('input', () => {
  currentFilters.query = searchInput.value;
  const filtered = filterRecords(allRecords);
  renderDownloads(filtered);
});

categoryFilter.addEventListener('change', () => {
  currentFilters.category = categoryFilter.value;
  const filtered = filterRecords(allRecords);
  renderDownloads(filtered);
});

siteFilter.addEventListener('change', () => {
  currentFilters.site = siteFilter.value;
  const filtered = filterRecords(allRecords);
  renderDownloads(filtered);
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

exportBtn.addEventListener('click', exportRecords);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  await loadSettings();
  await refresh();
  updateToggleLabel();
});

/**
 * Update toggle label based on state
 */
function updateToggleLabel() {
  const label = document.querySelector('.toggle-label');
  if (label) {
    label.textContent = enableToggle.checked ? i18n('autoOrganizeEnabled') : i18n('autoOrganizeDisabled');
  }
}
