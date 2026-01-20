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
    },
    'dova-syndrome': {
      enabled: true,
      name: 'DOVA-SYNDROME',
      categoryMap: {
        'bgm': 'BGM',
        'se': 'SE'
      }
    },
    'bgmer': {
      enabled: true,
      name: 'BGMer',
      categoryMap: {
        'bgm': 'BGM'
      }
    },
    'maoudamashii': {
      enabled: true,
      name: 'MaouDamashii',
      categoryMap: {
        'bgm': 'BGM',
        'se': 'SE',
        'vocal': 'Vocal'
      }
    },
    'bgmusic': {
      enabled: true,
      name: 'BGMusic',
      categoryMap: {
        'bgm': 'BGM',
        'jingle': 'Jingle'
      }
    },
    'ryuitomusic': {
      enabled: true,
      name: 'RyuItoMusic',
      categoryMap: {
        'bgm': 'BGM'
      }
    },
    'fukidesign': {
      enabled: true,
      name: 'FukiDesign',
      categoryMap: {
        'fukidashi': 'Fukidashi'
      }
    },
    pexels: {
      enabled: true,
      name: 'Pexels',
      categoryMap: {
        'photo': 'Photo',
        'photos': 'Photo',
        'image': 'Photo',
        'video': 'Video',
        'videos': 'Video'
      }
    },
    pixabay: {
      enabled: true,
      name: 'Pixabay',
      categoryMap: {
        'photo': 'Photo',
        'photos': 'Photo',
        'image': 'Photo',
        'video': 'Video',
        'videos': 'Video'
      }
    },
    coverr: {
      enabled: true,
      name: 'Coverr',
      categoryMap: {
        'video': 'Video',
        'videos': 'Video'
      }
    },
    freepik: {
      enabled: true,
      name: 'Freepik',
      categoryMap: {
        'video': 'Video',
        'videos': 'Video',
        'photo': 'Photo',
        'photos': 'Photo',
        'psd': 'PSD',
        'vector': 'Vector',
        'vectors': 'Vector',
        'icon': 'Icon',
        'icons': 'Icon'
      }
    }
  }
};

// DOM Elements
const baseFolderInput = document.getElementById('baseFolder');
const enableToggle = document.getElementById('enableToggle');
const motionElementsEnabled = document.getElementById('motionElementsEnabled');
const audiioEnabled = document.getElementById('audiioEnabled');
const pexelsEnabled = document.getElementById('pexelsEnabled');
const pixabayEnabled = document.getElementById('pixabayEnabled');
const coverrEnabled = document.getElementById('coverrEnabled');
const freepikEnabled = document.getElementById('freepikEnabled');
const motionElementsMappings = document.getElementById('motionElementsMappings');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const clearDataBtn = document.getElementById('clearDataBtn');
const downloadMacScript = document.getElementById('downloadMacScript');
const downloadWinScript = document.getElementById('downloadWinScript');
const statusEl = document.getElementById('status');

let currentSettings = null;

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
  pexelsEnabled.checked = settings.sites?.pexels?.enabled !== false;
  pixabayEnabled.checked = settings.sites?.pixabay?.enabled !== false;
  coverrEnabled.checked = settings.sites?.coverr?.enabled !== false;
  freepikEnabled.checked = settings.sites?.freepik?.enabled !== false;

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

  // Pexels
  if (!currentSettings.sites.pexels) {
    currentSettings.sites.pexels = { ...DEFAULT_SETTINGS.sites.pexels };
  }
  currentSettings.sites.pexels.enabled = pexelsEnabled.checked;

  // Pixabay
  if (!currentSettings.sites.pixabay) {
    currentSettings.sites.pixabay = { ...DEFAULT_SETTINGS.sites.pixabay };
  }
  currentSettings.sites.pixabay.enabled = pixabayEnabled.checked;

  // Coverr
  if (!currentSettings.sites.coverr) {
    currentSettings.sites.coverr = { ...DEFAULT_SETTINGS.sites.coverr };
  }
  currentSettings.sites.coverr.enabled = coverrEnabled.checked;

  // Freepik
  if (!currentSettings.sites.freepik) {
    currentSettings.sites.freepik = { ...DEFAULT_SETTINGS.sites.freepik };
  }
  currentSettings.sites.freepik.enabled = freepikEnabled.checked;

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
});
