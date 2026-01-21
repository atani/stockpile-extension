// Storage API wrapper for settings and configurations

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
    'artlist': {
      enabled: true,
      name: 'Artlist',
      categoryMap: {}
    },
    'epidemicsound': {
      enabled: true,
      name: 'Epidemic Sound',
      categoryMap: {}
    },
    'envato': {
      enabled: true,
      name: 'Envato',
      categoryMap: {}
    },
    'mixkit': {
      enabled: true,
      name: 'Mixkit',
      categoryMap: {
        'video': 'Video',
        'music': 'BGM',
        'sfx': 'SE',
        'template': 'Template'
      }
    },
    'adobestock': {
      enabled: true,
      name: 'Adobe Stock',
      categoryMap: {
        'video': 'Video',
        'music': 'BGM',
        'image': 'Image',
        'template': 'Template',
        '3d': '3D'
      }
    },
    'motionarray': {
      enabled: true,
      name: 'Motion Array',
      categoryMap: {
        'video': 'Video',
        'music': 'BGM',
        'sfx': 'SE',
        'premiere': 'Pr_Template',
        'aftereffects': 'AE_Template',
        'davinci': 'DaVinci_Template',
        'finalcut': 'FCP_Template',
        'mogrt': 'Mogrt',
        'photo': 'Photo'
      }
    }
  }
};

/**
 * Get all settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  const saved = result.settings || {};
  const mergedSites = {
    ...DEFAULT_SETTINGS.sites,
    ...(saved.sites || {})
  };
  const mergedPro = {
    ...DEFAULT_SETTINGS.pro,
    ...(saved.pro || {})
  };
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    sites: mergedSites,
    pro: mergedPro
  };
}

/**
 * Save settings
 * @param {Object} settings - Settings to save
 */
export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

/**
 * Update specific setting
 * @param {string} key - Setting key (supports dot notation)
 * @param {any} value - Value to set
 */
export async function updateSetting(key, value) {
  const settings = await getSettings();
  const keys = key.split('.');
  let obj = settings;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in obj)) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }

  obj[keys[keys.length - 1]] = value;
  await saveSettings(settings);
}

/**
 * Get site configuration
 * @param {string} siteKey - Site identifier (e.g., 'motionelements')
 * @returns {Promise<Object|null>} Site config or null
 */
export async function getSiteConfig(siteKey) {
  const settings = await getSettings();
  return settings.sites[siteKey] || null;
}

/**
 * Store pending download metadata
 * @param {string} url - Download URL
 * @param {Object} metadata - Metadata from content script
 */
export async function storePendingDownload(url, metadata) {
  const result = await chrome.storage.local.get('pendingDownloads');
  const pending = result.pendingDownloads || {};
  pending[url] = {
    ...metadata,
    storedAt: Date.now()
  };
  await chrome.storage.local.set({ pendingDownloads: pending });
}

/**
 * Get and remove pending download metadata
 * @param {string} url - Download URL
 * @returns {Promise<Object|null>} Metadata or null
 */
export async function consumePendingDownload(url) {
  const result = await chrome.storage.local.get('pendingDownloads');
  const pending = result.pendingDownloads || {};

  // Try exact match first
  if (pending[url]) {
    const metadata = pending[url];
    delete pending[url];
    await chrome.storage.local.set({ pendingDownloads: pending });
    return metadata;
  }

  // Try partial URL match (for redirected downloads)
  for (const storedUrl of Object.keys(pending)) {
    if (url.includes(storedUrl) || storedUrl.includes(url)) {
      const metadata = pending[storedUrl];
      delete pending[storedUrl];
      await chrome.storage.local.set({ pendingDownloads: pending });
      return metadata;
    }
  }

  // Try matching by site domain in URL
  const urlDomain = extractDomain(url);
  for (const [storedUrl, data] of Object.entries(pending)) {
    const storedDomain = extractDomain(storedUrl);
    if (urlDomain && storedDomain && urlDomain.includes(storedDomain.split('.')[0])) {
      delete pending[storedUrl];
      await chrome.storage.local.set({ pendingDownloads: pending });
      return data;
    }
  }

  // Fallback: return the most recent pending download (within 30 seconds)
  const recentThreshold = Date.now() - 30000;
  let mostRecent = null;
  let mostRecentUrl = null;

  for (const [storedUrl, data] of Object.entries(pending)) {
    if (data.storedAt > recentThreshold) {
      if (!mostRecent || data.storedAt > mostRecent.storedAt) {
        mostRecent = data;
        mostRecentUrl = storedUrl;
      }
    }
  }

  if (mostRecent && mostRecentUrl) {
    delete pending[mostRecentUrl];
    await chrome.storage.local.set({ pendingDownloads: pending });
    return mostRecent;
  }

  return null;
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Clean up old pending downloads (older than 1 hour)
 */
export async function cleanupPendingDownloads() {
  const result = await chrome.storage.local.get('pendingDownloads');
  const pending = result.pendingDownloads || {};
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  const cleaned = {};
  for (const [url, data] of Object.entries(pending)) {
    if (data.storedAt > oneHourAgo) {
      cleaned[url] = data;
    }
  }

  await chrome.storage.local.set({ pendingDownloads: cleaned });
}
