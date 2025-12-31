// Options page script

const SETTINGS_KEY = 'settings';
const DB_KEY = 'downloadHistory';

const DEFAULT_SETTINGS = {
  baseFolder: 'Stockpile',
  enabled: true,
  sites: {
    motionelements: {
      enabled: true,
      name: 'MotionElements',
      categoryMap: {
        'video': 'Video',
        'music': 'BGM',
        'sound-effects': 'SE',
        'motion-graphics-template': 'Mogrt',
        'premiere-pro-template': 'Preset',
        'after-effects-template': 'AE_Template',
        'stock-video': 'Video',
        'stock-music': 'BGM',
        'stock-sound-effect': 'SE'
      }
    },
    audiio: {
      enabled: true,
      name: 'Audiio',
      categoryMap: {
        'music': 'BGM',
        'sfx': 'SE',
        'sound-effects': 'SE'
      }
    }
  }
};

// DOM Elements
const baseFolderInput = document.getElementById('baseFolder');
const enableToggle = document.getElementById('enableToggle');
const motionElementsEnabled = document.getElementById('motionElementsEnabled');
const audiioEnabled = document.getElementById('audiioEnabled');
const motionElementsMappings = document.getElementById('motionElementsMappings');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const clearDataBtn = document.getElementById('clearDataBtn');
const statusEl = document.getElementById('status');

let currentSettings = null;

/**
 * Load settings
 */
async function loadSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  currentSettings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };

  // Merge nested objects properly
  if (result[SETTINGS_KEY]?.sites) {
    currentSettings.sites = {
      ...DEFAULT_SETTINGS.sites,
      ...result[SETTINGS_KEY].sites
    };
  }

  return currentSettings;
}

/**
 * Save settings
 */
async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: currentSettings });
}

/**
 * Populate form with settings
 */
function populateForm(settings) {
  baseFolderInput.value = settings.baseFolder || 'Stockpile';
  enableToggle.checked = settings.enabled !== false;
  motionElementsEnabled.checked = settings.sites?.motionelements?.enabled !== false;
  audiioEnabled.checked = settings.sites?.audiio?.enabled !== false;

  // Render category mappings
  renderMappings(settings.sites?.motionelements?.categoryMap || {});
}

/**
 * Render category mappings
 */
function renderMappings(mappings) {
  motionElementsMappings.innerHTML = Object.entries(mappings)
    .map(([key, value]) => `
      <div class="mapping-row">
        <input type="text" value="${escapeHtml(key)}" data-original="${escapeHtml(key)}" class="mapping-key" placeholder="Site category">
        <span class="arrow">&rarr;</span>
        <input type="text" value="${escapeHtml(value)}" class="mapping-value" placeholder="Folder name">
      </div>
    `)
    .join('');
}

/**
 * Collect form data
 */
function collectFormData() {
  currentSettings.baseFolder = baseFolderInput.value.trim() || 'Stockpile';
  currentSettings.enabled = enableToggle.checked;

  if (!currentSettings.sites) currentSettings.sites = {};

  // MotionElements
  if (!currentSettings.sites.motionelements) {
    currentSettings.sites.motionelements = { ...DEFAULT_SETTINGS.sites.motionelements };
  }
  currentSettings.sites.motionelements.enabled = motionElementsEnabled.checked;

  // Collect mappings
  const mappings = {};
  motionElementsMappings.querySelectorAll('.mapping-row').forEach(row => {
    const key = row.querySelector('.mapping-key').value.trim();
    const value = row.querySelector('.mapping-value').value.trim();
    if (key && value) {
      mappings[key] = value;
    }
  });
  currentSettings.sites.motionelements.categoryMap = mappings;

  // Audiio
  if (!currentSettings.sites.audiio) {
    currentSettings.sites.audiio = { ...DEFAULT_SETTINGS.sites.audiio };
  }
  currentSettings.sites.audiio.enabled = audiioEnabled.checked;

  return currentSettings;
}

/**
 * Show status message
 */
function showStatus(message, type = 'success') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
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
 * Export data
 */
async function exportData() {
  const result = await chrome.storage.local.get([SETTINGS_KEY, DB_KEY]);

  const exportData = {
    settings: result[SETTINGS_KEY],
    downloads: result[DB_KEY] || [],
    exportedAt: new Date().toISOString()
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `stockpile-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Data exported successfully');
}

/**
 * Import data
 */
async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.settings) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: data.settings });
    }

    if (data.downloads && Array.isArray(data.downloads)) {
      // Merge with existing downloads
      const result = await chrome.storage.local.get(DB_KEY);
      const existing = result[DB_KEY] || [];
      const existingIds = new Set(existing.map(r => r.id));

      const newRecords = data.downloads.filter(r => !existingIds.has(r.id));
      const merged = [...newRecords, ...existing];

      await chrome.storage.local.set({ [DB_KEY]: merged });
      showStatus(`Imported ${newRecords.length} new records`);
    } else {
      showStatus('Data imported successfully');
    }

    // Reload settings
    await loadSettings();
    populateForm(currentSettings);
  } catch (error) {
    showStatus('Failed to import: ' + error.message, 'error');
  }
}

/**
 * Clear all data
 */
async function clearAllData() {
  if (!confirm('Are you sure you want to clear all download history? This cannot be undone.')) {
    return;
  }

  if (!confirm('This is your last chance. Delete all data?')) {
    return;
  }

  await chrome.storage.local.remove(DB_KEY);
  showStatus('All download history cleared');
}

// Event Listeners
saveBtn.addEventListener('click', async () => {
  collectFormData();
  await saveSettings();
  showStatus('Settings saved');
});

exportBtn.addEventListener('click', exportData);

importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    importData(file);
    importFile.value = '';
  }
});

clearDataBtn.addEventListener('click', clearAllData);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  populateForm(currentSettings);
});
