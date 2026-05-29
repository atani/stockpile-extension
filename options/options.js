// Options page script

/**
 * Apply i18n translations to elements with data-i18n attributes
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) el.textContent = message;
  });
}

/**
 * Get i18n message
 */
function i18n(key) {
  return chrome.i18n.getMessage(key) || key;
}

import { getPaidStatus, openPaymentPage } from '../lib/extpay.js';

const SETTINGS_KEY = 'settings';
const DB_KEY = 'downloadHistory';

const DEFAULT_SETTINGS = {
  baseFolder: 'Stockpile',
  enabled: true,
  pro: {
    driveSyncEnabled: false,
    driveSyncSettings: true,
    driveSyncHistory: true,
    driveSyncExports: true,
    devOverride: false,
    driveWebClientId: ''
  },
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
    },
    artlist: {
      enabled: true,
      name: 'Artlist',
      categoryMap: {}
    },
    epidemicsound: {
      enabled: true,
      name: 'Epidemic Sound',
      categoryMap: {}
    },
    envato: {
      enabled: true,
      name: 'Envato',
      categoryMap: {}
    }
  }
};

// DOM Elements
const baseFolderInput = document.getElementById('baseFolder');
const enableToggle = document.getElementById('enableToggle');
const motionElementsEnabled = document.getElementById('motionElementsEnabled');
const audiioEnabled = document.getElementById('audiioEnabled');
const motionElementsMappings = document.getElementById('motionElementsMappings');
const artlistEnabled = document.getElementById('artlistEnabled');
const epidemicSoundEnabled = document.getElementById('epidemicSoundEnabled');
const envatoEnabled = document.getElementById('envatoEnabled');
const driveSyncEnabled = document.getElementById('driveSyncEnabled');
const driveSyncSettings = document.getElementById('driveSyncSettings');
const driveSyncHistory = document.getElementById('driveSyncHistory');
const driveSyncExports = document.getElementById('driveSyncExports');
const proDevOverride = document.getElementById('proDevOverride');
const driveSyncStatus = document.getElementById('driveSyncStatus');
const driveWebClientId = document.getElementById('driveWebClientId');
const upgradeBtn = document.getElementById('upgradeBtn');
const driveSyncNowBtn = document.getElementById('driveSyncNowBtn');
const proStatusEl = document.getElementById('proStatus');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const clearDataBtn = document.getElementById('clearDataBtn');
const downloadMacScript = document.getElementById('downloadMacScript');
const downloadWinScript = document.getElementById('downloadWinScript');
const statusEl = document.getElementById('status');
const saveStatusEl = document.getElementById('saveStatus');

let currentSettings = null;
let isProUser = false;
let isDevOverride = false;

// Auto-extract scripts content
const MAC_SCRIPT = `#!/bin/bash
# Stockpile Auto-Extract Script for macOS
# Automatically extracts ZIP files and removes __MACOSX folders
#
# Usage:
#   1. Edit WATCH_DIR below to your Stockpile download folder
#   2. Run: chmod +x auto-extract-mac.sh
#   3. Run: ./auto-extract-mac.sh
#
# For automatic execution, set up as a LaunchAgent (see README)

# === CONFIGURATION ===
# Change this to your Stockpile download folder
WATCH_DIR="$HOME/Downloads/Stockpile"

# === SCRIPT ===
if [ ! -d "$WATCH_DIR" ]; then
  echo "Error: Directory not found: $WATCH_DIR"
  echo "Please edit WATCH_DIR in this script to match your Stockpile folder."
  exit 1
fi

echo "Stockpile Auto-Extract"
echo "======================"
echo "Watching: $WATCH_DIR"
echo ""

# Find and extract all ZIP files
find "$WATCH_DIR" -name "*.zip" -type f | while read zipfile; do
  dir=$(dirname "$zipfile")
  filename=$(basename "$zipfile" .zip)

  echo "Extracting: $filename"

  # Extract to same directory (exclude __MACOSX)
  unzip -o -q "$zipfile" -d "$dir" -x "__MACOSX/*"

  # Remove the zip file
  rm "$zipfile"

  echo "  Done!"
done

# Clean up any remaining __MACOSX folders
find "$WATCH_DIR" -name "__MACOSX" -type d -exec rm -rf {} + 2>/dev/null

echo ""
echo "All ZIP files extracted!"
`;

const WIN_SCRIPT = `# Stockpile Auto-Extract Script for Windows
# Automatically extracts ZIP files and removes __MACOSX folders
#
# Usage:
#   1. Edit $WatchDir below to your Stockpile download folder
#   2. Right-click this file and select "Run with PowerShell"
#
# For automatic execution, set up as a Scheduled Task (see README)

# === CONFIGURATION ===
# Change this to your Stockpile download folder
$WatchDir = "$env:USERPROFILE\\Downloads\\Stockpile"

# === SCRIPT ===
if (-not (Test-Path $WatchDir)) {
    Write-Host "Error: Directory not found: $WatchDir" -ForegroundColor Red
    Write-Host "Please edit \`$WatchDir in this script to match your Stockpile folder."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Stockpile Auto-Extract" -ForegroundColor Green
Write-Host "======================"
Write-Host "Watching: $WatchDir"
Write-Host ""

# Find all ZIP files
$zipFiles = Get-ChildItem -Path $WatchDir -Filter "*.zip" -Recurse -File

if ($zipFiles.Count -eq 0) {
    Write-Host "No ZIP files found."
} else {
    foreach ($zipFile in $zipFiles) {
        $destDir = $zipFile.DirectoryName
        $fileName = $zipFile.BaseName

        Write-Host "Extracting: $fileName"

        try {
            Expand-Archive -Path $zipFile.FullName -DestinationPath $destDir -Force

            # Remove __MACOSX folder if exists
            $macosxPath = Join-Path $destDir "__MACOSX"
            if (Test-Path $macosxPath) {
                Remove-Item -Path $macosxPath -Recurse -Force
                Write-Host "  Removed __MACOSX folder"
            }

            Remove-Item -Path $zipFile.FullName -Force
            Write-Host "  Done!"
        } catch {
            Write-Host "  Error: $_" -ForegroundColor Red
        }
    }
}

# Clean up any remaining __MACOSX folders
Get-ChildItem -Path $WatchDir -Filter "__MACOSX" -Recurse -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "All ZIP files extracted!" -ForegroundColor Green
Read-Host "Press Enter to exit"
`;

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

  if (result[SETTINGS_KEY]?.pro) {
    currentSettings.pro = {
      ...DEFAULT_SETTINGS.pro,
      ...result[SETTINGS_KEY].pro
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
  artlistEnabled.checked = settings.sites?.artlist?.enabled !== false;
  epidemicSoundEnabled.checked = settings.sites?.epidemicsound?.enabled !== false;
  envatoEnabled.checked = settings.sites?.envato?.enabled !== false;
  driveSyncEnabled.checked = settings.pro?.driveSyncEnabled === true;
  driveSyncSettings.checked = settings.pro?.driveSyncSettings !== false;
  driveSyncHistory.checked = settings.pro?.driveSyncHistory !== false;
  driveSyncExports.checked = settings.pro?.driveSyncExports !== false;
  proDevOverride.checked = settings.pro?.devOverride === true;
  driveWebClientId.value = settings.pro?.driveWebClientId || '';

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
  if (!currentSettings.pro) currentSettings.pro = { ...DEFAULT_SETTINGS.pro };

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

  // Pro sites
  if (!currentSettings.sites.artlist) {
    currentSettings.sites.artlist = { ...DEFAULT_SETTINGS.sites.artlist };
  }
  if (!currentSettings.sites.epidemicsound) {
    currentSettings.sites.epidemicsound = { ...DEFAULT_SETTINGS.sites.epidemicsound };
  }
  if (!currentSettings.sites.envato) {
    currentSettings.sites.envato = { ...DEFAULT_SETTINGS.sites.envato };
  }

  currentSettings.pro.devOverride = proDevOverride.checked;
  currentSettings.pro.driveWebClientId = driveWebClientId.value.trim();

  currentSettings.sites.artlist.enabled = artlistEnabled.checked;
  currentSettings.sites.epidemicsound.enabled = epidemicSoundEnabled.checked;
  currentSettings.sites.envato.enabled = envatoEnabled.checked;

  if (isProUser || currentSettings.pro.devOverride) {
    currentSettings.pro.driveSyncEnabled = driveSyncEnabled.checked;
    currentSettings.pro.driveSyncSettings = driveSyncSettings.checked;
    currentSettings.pro.driveSyncHistory = driveSyncHistory.checked;
    currentSettings.pro.driveSyncExports = driveSyncExports.checked;
  }

  return currentSettings;
}

function updateProUI(paid) {
  isProUser = paid;
  if (proStatusEl) {
    proStatusEl.textContent = paid ? i18n('proStatusActive') : i18n('proStatusInactive');
  }

  document.querySelectorAll('[data-pro-input]').forEach((input) => {
    input.disabled = !(paid || isDevOverride);
  });

  if (driveSyncNowBtn) {
    driveSyncNowBtn.disabled = !(paid || isDevOverride);
  }

  if (upgradeBtn) {
    upgradeBtn.style.display = paid ? 'none' : 'inline-block';
  }
}

async function refreshProStatus() {
  const result = await getPaidStatus();
  const settings = await loadSettings();
  isDevOverride = settings?.pro?.devOverride === true;
  updateProUI(!!result.paid || isDevOverride);
}

function validateProSitePackSelections() {
  if (!isProUser) {
    artlistEnabled.checked = false;
    epidemicSoundEnabled.checked = false;
    envatoEnabled.checked = false;
  }
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

function showSaveStatus(message, type = 'success') {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message || '';
  saveStatusEl.className = `save-status${type === 'error' ? ' error' : ''}`;
  if (type === 'success') {
    setTimeout(() => {
      if (saveStatusEl.textContent === message) {
        saveStatusEl.textContent = '';
      }
    }, 2500);
  }
}

function showDriveSyncStatus(message, type = 'success') {
  if (!driveSyncStatus) return;
  driveSyncStatus.textContent = message || '';
  driveSyncStatus.className = `pro-inline-status${type === 'error' ? ' error' : ''}`;

  if (type === 'success') {
    setTimeout(() => {
      if (driveSyncStatus.textContent === message) {
        driveSyncStatus.textContent = '';
      }
    }, 4000);
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
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
  showStatus(i18n('settingsSaved'));
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
  if (!confirm(i18n('confirmClear'))) {
    return;
  }

  if (!confirm(i18n('confirmClear'))) {
    return;
  }

  await chrome.storage.local.remove(DB_KEY);
  showStatus(i18n('dataCleared'));
}

// Event Listeners
saveBtn.addEventListener('click', async () => {
  collectFormData();
  await saveSettings();
  showStatus(i18n('settingsSaved'));
  showSaveStatus(i18n('settingsSaved'));

  sendMessage({
    type: 'UPDATE_DRIVE_SYNC_SETTINGS',
    data: currentSettings.pro || DEFAULT_SETTINGS.pro
  });
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

upgradeBtn.addEventListener('click', () => {
  if (!openPaymentPage()) {
    showStatus(i18n('upgradeFailed'), 'error');
  }
});

driveSyncNowBtn.addEventListener('click', async () => {
  showDriveSyncStatus('');
  const response = await sendMessage({ type: 'DRIVE_SYNC_NOW' });
  if (response?.success) {
    showDriveSyncStatus(i18n('driveSyncSuccess'));
  } else {
    showDriveSyncStatus(response?.message || i18n('driveSyncFailed'), 'error');
  }
});

proDevOverride.addEventListener('change', async () => {
  isDevOverride = proDevOverride.checked;
  updateProUI(isProUser || isDevOverride);
  collectFormData();
  await saveSettings();
  showStatus(i18n('settingsSaved'));
  showSaveStatus(i18n('settingsSaved'));
});

// Script download handlers
downloadMacScript.addEventListener('click', () => {
  downloadScript(MAC_SCRIPT, 'auto-extract-mac.sh', 'text/x-shellscript');
});

downloadWinScript.addEventListener('click', () => {
  downloadScript(WIN_SCRIPT, 'auto-extract-win.ps1', 'text/plain');
});

/**
 * Download script file
 */
function downloadScript(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
  showStatus(`Downloaded ${filename}`);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  await loadSettings();
  populateForm(currentSettings);
  await refreshProStatus();
  validateProSitePackSelections();
});
