// Background Service Worker - Download monitoring and routing

import {
  getSettings,
  consumePendingDownload,
  cleanupPendingDownloads
} from '../lib/storage.js';
import { addRecord } from '../lib/database.js';
import { initExtPayBackground, getPaidStatus } from '../lib/extpay.js';
import { syncToDrive } from '../lib/drive-sync.js';

const PRO_SITE_KEYS = new Set(['artlist', 'epidemicsound', 'envato', 'mixkit', 'adobestock', 'motionarray']);
const PRO_STATUS_CACHE_KEY = 'proStatusCache';
const PRO_STATUS_TTL_MS = 5 * 60 * 1000;
const DRIVE_SYNC_STATUS_KEY = 'driveSyncStatus';
const DRIVE_SYNC_NOTIFICATION_ID = 'stockpile-drive-sync';

function notifyDriveSync(title, message) {
  try {
    chrome.notifications.create(DRIVE_SYNC_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message
    });
  } catch (error) {
    console.warn('[Stockpile] Notification failed:', error);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REGISTER_DOWNLOAD') {
    handleRegisterDownload(message.data, sender.tab).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse(settings));
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_PRO_STATUS') {
    getProStatus().then(status => sendResponse(status));
    return true;
  }

  if (message.type === 'DRIVE_SYNC_NOW') {
    performDriveSync(true).then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'UPDATE_DRIVE_SYNC_SETTINGS') {
    updateDriveSyncAlarm(message.data).then(() => sendResponse({ success: true }));
    return true;
  }

  return true;
});

/**
 * Handle download registration from content script
 */
async function handleRegisterDownload(data, tab) {
  const { url, metadata } = data;
  const settings = await getSettings();
  const siteKey = detectSiteKey({
    url,
    referrer: tab?.url,
    pageUrl: tab?.url,
    filename: null,
    metadata
  });

  if (siteKey && settings.sites?.[siteKey]?.enabled === false) {
    console.log('[Stockpile] Site disabled:', siteKey);
    return;
  }

  if (siteKey && PRO_SITE_KEYS.has(siteKey)) {
    const proStatus = await getProStatus();
    if (!proStatus.paid) {
      console.log('[Stockpile] Pro site blocked (unpaid):', siteKey);
      return;
    }
  }

  // Store in pending downloads
  const result = await chrome.storage.local.get('pendingDownloads');
  const pending = result.pendingDownloads || {};

  pending[url] = {
    ...metadata,
    sourceUrl: tab?.url || metadata.sourceUrl,
    storedAt: Date.now()
  };

  await chrome.storage.local.set({ pendingDownloads: pending });
  console.log('[Stockpile] Registered download:', url, metadata);
}

/**
 * Determine the target folder for a download
 */
async function determineFolder(downloadItem, metadata, activeTabUrl = null) {
  const settings = await getSettings();

  if (!settings.enabled) {
    return null; // Use default download location
  }

  const baseFolder = settings.baseFolder || 'Stockpile';

  // Determine site from URL or metadata
  let siteName = metadata?.site || 'Unknown';
  let category = metadata?.category || 'Other';

  // If no metadata, try to determine from URL, referrer, activeTabUrl, or filename
  if (!metadata) {
    const url = downloadItem.url || downloadItem.finalUrl || '';
    const referrer = downloadItem.referrer || '';
    const filename = downloadItem.filename || '';
    const lowerFilename = filename.toLowerCase();
    // Combine referrer and activeTabUrl for path detection
    const pageUrl = activeTabUrl || referrer || '';

    if (url.includes('motionelements.com') || url.includes('motionelements') ||
        referrer.includes('motionelements') || lowerFilename.startsWith('motionelements_')) {
      siteName = 'MotionElements';
      category = getCategoryFromExtension(filename);
    } else if (url.includes('audiio.com') || url.includes('audiio') ||
               referrer.includes('audiio') || pageUrl.includes('audiio') ||
               lowerFilename.startsWith('audiio_')) {
      siteName = 'Audiio';
      // Check pageUrl (activeTabUrl or referrer) for SFX page
      if (pageUrl.includes('/sfx') || pageUrl.includes('/sound-effects')) {
        category = 'SE';
      } else {
        // Audiio is primarily a music service, default to BGM
        const extCategory = getCategoryFromExtension(filename);
        category = (extCategory === 'Other') ? 'BGM' : extCategory;
      }
    } else if (url.includes('dova-s.jp') || referrer.includes('dova-s.jp') ||
               pageUrl.includes('dova-s.jp')) {
      siteName = 'DOVA-SYNDROME';
      // Check pageUrl for SE page
      if (pageUrl.includes('/se/')) {
        category = 'SE';
      } else {
        category = 'BGM';
      }
    } else if (url.includes('bgmer.net') || referrer.includes('bgmer.net') ||
               pageUrl.includes('bgmer.net')) {
      siteName = 'BGMer';
      category = 'BGM';
    } else if (url.includes('maou.audio') || referrer.includes('maou.audio') ||
               pageUrl.includes('maou.audio')) {
      siteName = 'MaouDamashii';
      if (pageUrl.includes('/category/se/') || pageUrl.includes('/se/')) {
        category = 'SE';
      } else if (pageUrl.includes('/category/song/') || pageUrl.includes('/song/')) {
        category = 'Vocal';
      } else {
        category = 'BGM';
      }
    } else if (url.includes('bgmusic.jp') || referrer.includes('bgmusic.jp') ||
               pageUrl.includes('bgmusic.jp')) {
      siteName = 'BGMusic';
      if (pageUrl.includes('/freejingle/') || pageUrl.includes('jingle')) {
        category = 'Jingle';
      } else {
        category = 'BGM';
      }
    } else if (url.includes('ryu110.com') || referrer.includes('ryu110.com') ||
               pageUrl.includes('ryu110.com')) {
      siteName = 'RyuItoMusic';
      category = 'BGM';
    } else if (url.includes('fukidesign.com') || referrer.includes('fukidesign.com') ||
               pageUrl.includes('fukidesign.com')) {
      siteName = 'FukiDesign';
      category = 'Fukidashi';
    } else if (url.includes('artlist') || referrer.includes('artlist') ||
               pageUrl.includes('artlist')) {
      siteName = 'Artlist';
      category = getCategoryFromExtension(filename);
    } else if (url.includes('epidemicsound') || referrer.includes('epidemicsound') ||
               pageUrl.includes('epidemicsound')) {
      siteName = 'Epidemic Sound';
      if (pageUrl.includes('/sound-effects') || pageUrl.includes('/sfx')) {
        category = 'SE';
      } else {
        category = 'BGM';
      }
    } else if (url.includes('envato') || referrer.includes('envato') ||
               pageUrl.includes('envato')) {
      siteName = 'Envato';
      if (pageUrl.includes('/video-templates') || pageUrl.includes('/stock-video') ||
          pageUrl.includes('/footage')) {
        category = 'Video';
      } else if (pageUrl.includes('/royalty-free-music') || pageUrl.includes('/stock-music') ||
                 pageUrl.includes('/audio/')) {
        category = 'BGM';
      } else if (pageUrl.includes('/sound-effects')) {
        category = 'SE';
      } else if (pageUrl.includes('/premiere-pro')) {
        category = 'Pr_Template';
      } else if (pageUrl.includes('/after-effects')) {
        category = 'AE_Template';
      } else if (pageUrl.includes('/davinci-resolve')) {
        category = 'DaVinci_Template';
      } else if (pageUrl.includes('/final-cut-pro')) {
        category = 'FCP_Template';
      } else if (pageUrl.includes('/motion-graphics') || pageUrl.includes('/mogrt')) {
        category = 'Mogrt';
      } else if (pageUrl.includes('/graphic-templates') || pageUrl.includes('/graphics/')) {
        category = 'Graphics';
      } else if (pageUrl.includes('/photos') || pageUrl.includes('/stock-photos')) {
        category = 'Photo';
      } else if (pageUrl.includes('/3d/')) {
        category = '3D';
      } else if (pageUrl.includes('/presentation-templates')) {
        category = 'Presentation';
      } else if (pageUrl.includes('/fonts')) {
        category = 'Font';
      } else {
        category = getCategoryFromExtension(filename);
      }
    } else if (url.includes('mixkit') || referrer.includes('mixkit') ||
               pageUrl.includes('mixkit')) {
      siteName = 'Mixkit';
      if (pageUrl.includes('/free-stock-music/') || pageUrl.includes('/music/')) {
        category = 'BGM';
      } else if (pageUrl.includes('/free-sound-effects/') || pageUrl.includes('/sfx/')) {
        category = 'SE';
      } else if (pageUrl.includes('/video-templates/')) {
        category = 'Template';
      } else {
        category = 'Video';
      }
    } else if (url.includes('stock.adobe.com') || referrer.includes('stock.adobe.com') ||
               pageUrl.includes('stock.adobe.com')) {
      siteName = 'Adobe Stock';
      if (pageUrl.includes('/video/') || pageUrl.includes('/footage/')) {
        category = 'Video';
      } else if (pageUrl.includes('/audio/') || pageUrl.includes('/music/')) {
        category = 'BGM';
      } else if (pageUrl.includes('/template')) {
        category = 'Template';
      } else if (pageUrl.includes('/3d/')) {
        category = '3D';
      } else {
        category = 'Image';
      }
    } else if (url.includes('motionarray') || referrer.includes('motionarray') ||
               pageUrl.includes('motionarray')) {
      siteName = 'Motion Array';
      if (pageUrl.includes('/stock-music/') || pageUrl.includes('/royalty-free-music/')) {
        category = 'BGM';
      } else if (pageUrl.includes('/sound-effects/')) {
        category = 'SE';
      } else if (pageUrl.includes('/premiere-pro-templates/') || pageUrl.includes('/premiere-pro/')) {
        category = 'Pr_Template';
      } else if (pageUrl.includes('/after-effects-templates/') || pageUrl.includes('/after-effects/')) {
        category = 'AE_Template';
      } else if (pageUrl.includes('/davinci-resolve-templates/')) {
        category = 'DaVinci_Template';
      } else if (pageUrl.includes('/final-cut-pro-templates/')) {
        category = 'FCP_Template';
      } else if (pageUrl.includes('/motion-graphics-templates/') || pageUrl.includes('/mogrt/')) {
        category = 'Mogrt';
      } else if (pageUrl.includes('/photos/')) {
        category = 'Photo';
      } else {
        category = 'Video';
      }
    }
  }

  // For zip files, use filename-based detection only if metadata category is missing or 'Other'
  const filename = downloadItem.filename || '';
  if (filename.toLowerCase().endsWith('.zip') && (!metadata?.category || metadata.category === 'Other')) {
    const filenameCategory = getCategoryFromExtension(filename);
    if (filenameCategory !== 'Other') {
      category = filenameCategory;
    }
  }

  // Get site config for folder name
  const siteKey = siteName.toLowerCase().replace(/\s+/g, '');
  const siteConfig = settings.sites?.[siteKey];

  if (siteConfig) {
    if (siteConfig.enabled === false) {
      return null;
    }
    siteName = siteConfig.name || siteName;
    // Map category if configured
    if (siteConfig.categoryMap && metadata?.rawCategory) {
      const mappedCategory = siteConfig.categoryMap[metadata.rawCategory.toLowerCase()];
      if (mappedCategory) {
        category = mappedCategory;
      }
    }
  }

  return `${baseFolder}/${siteName}/${category}`;
}

/**
 * Fallback: determine category from file extension or filename
 */
function getCategoryFromExtension(filename) {
  if (!filename) return 'Other';

  const lowerFilename = filename.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase();

  // Check filename patterns first (for .zip files that contain the type in name)
  const filenamePatterns = [
    { pattern: 'mogrt', category: 'Mogrt' },
    { pattern: 'prfpset', category: 'Preset' },
    { pattern: 'prproj', category: 'Pr_Template' },
    { pattern: 'aep', category: 'AE_Template' },
    { pattern: 'after-effect', category: 'AE_Template' },
    { pattern: 'lut', category: 'LUT' },
    { pattern: 'sound-effect', category: 'SE' },
    { pattern: 'sfx', category: 'SE' },
  ];

  for (const { pattern, category } of filenamePatterns) {
    if (lowerFilename.includes(pattern)) {
      return category;
    }
  }

  const categoryMap = {
    // Video
    'mp4': 'Video',
    'mov': 'Video',
    'avi': 'Video',
    'webm': 'Video',
    'mkv': 'Video',
    // Audio
    'mp3': 'BGM',
    'wav': 'BGM',
    'aiff': 'BGM',
    'flac': 'BGM',
    'ogg': 'BGM',
    'm4a': 'BGM',
    // Premiere Pro
    'mogrt': 'Mogrt',
    'prproj': 'Pr_Template',
    'prfpset': 'Preset',
    // After Effects
    'aep': 'AE_Template',
    // Archives (likely templates)
    'zip': 'Other',
    'rar': 'Other'
  };

  return categoryMap[ext] || 'Other';
}

/**
 * Check if URL, referrer, or filename is from a target site
 */
function isTargetSite(url, referrer, filename) {
  const targetDomains = [
    'motionelements',
    'audiio',
    'dova-s.jp',
    'bgmer.net',
    'maou.audio',
    'bgmusic.jp',
    'ryu110.com',
    'fukidesign.com',
    'artlist',
    'epidemicsound',
    'envato',
    'mixkit',
    'stock.adobe.com',
    'motionarray'
  ];

  // Check URL
  if (url && targetDomains.some(domain => url.toLowerCase().includes(domain))) {
    return true;
  }

  // Check referrer
  if (referrer && targetDomains.some(domain => referrer.toLowerCase().includes(domain))) {
    return true;
  }

  // Check filename prefix (e.g., "Audiio_Bamboo_...")
  if (filename) {
    const lowerFilename = filename.toLowerCase();
    if (targetDomains.some(domain => lowerFilename.startsWith(domain + '_'))) {
      return true;
    }
  }

  return false;
}

function normalizeSiteKey(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  const map = {
    'motion elements': 'motionelements',
    'motionelements': 'motionelements',
    'audiio': 'audiio',
    'dova-syndrome': 'dova-syndrome',
    'bgmer': 'bgmer',
    'maoudamashii': 'maoudamashii',
    'bgmusic': 'bgmusic',
    'ryuitomusic': 'ryuitomusic',
    'fukidesign': 'fukidesign',
    'artlist': 'artlist',
    'epidemic sound': 'epidemicsound',
    'epidemicsound': 'epidemicsound',
    'envato': 'envato',
    'mixkit': 'mixkit',
    'adobe stock': 'adobestock',
    'adobestock': 'adobestock',
    'motion array': 'motionarray',
    'motionarray': 'motionarray'
  };
  return map[normalized] || null;
}

function detectSiteKey({ url, referrer, pageUrl, filename, metadata }) {
  const fromMetadata = normalizeSiteKey(metadata?.site);
  if (fromMetadata) return fromMetadata;

  const combined = `${url || ''} ${referrer || ''} ${pageUrl || ''} ${filename || ''}`.toLowerCase();
  const tokens = [
    { key: 'motionelements', match: 'motionelements' },
    { key: 'audiio', match: 'audiio' },
    { key: 'dova-syndrome', match: 'dova-s.jp' },
    { key: 'bgmer', match: 'bgmer' },
    { key: 'maoudamashii', match: 'maou.audio' },
    { key: 'bgmusic', match: 'bgmusic' },
    { key: 'ryuitomusic', match: 'ryu110' },
    { key: 'fukidesign', match: 'fukidesign' },
    { key: 'artlist', match: 'artlist' },
    { key: 'epidemicsound', match: 'epidemicsound' },
    { key: 'envato', match: 'envato' },
    { key: 'mixkit', match: 'mixkit' },
    { key: 'adobestock', match: 'stock.adobe.com' },
    { key: 'motionarray', match: 'motionarray' }
  ];

  for (const token of tokens) {
    if (combined.includes(token.match)) {
      return token.key;
    }
  }

  return null;
}

async function getProStatus() {
  const settings = await getSettings();
  if (settings.pro?.devOverride) {
    return { paid: true, checkedAt: Date.now(), devOverride: true };
  }

  const cached = await chrome.storage.local.get(PRO_STATUS_CACHE_KEY);
  const cachedStatus = cached[PRO_STATUS_CACHE_KEY];
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < PRO_STATUS_TTL_MS) {
    return cachedStatus;
  }

  const result = await getPaidStatus();
  const status = {
    paid: !!result.paid,
    checkedAt: Date.now()
  };
  await chrome.storage.local.set({ [PRO_STATUS_CACHE_KEY]: status });
  return status;
}

async function performDriveSync(interactive = false) {
  try {
    const settings = await getSettings();
    const proStatus = await getProStatus();

    if (!proStatus.paid) {
      return { success: false, message: 'Pro required' };
    }

    if (!settings.pro?.driveSyncEnabled) {
      return { success: false, message: 'Drive sync disabled' };
    }

    const result = await chrome.storage.local.get(['settings', 'downloadHistory']);
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: settings.pro?.driveSyncSettings ? result.settings : null,
      downloads: settings.pro?.driveSyncHistory ? (result.downloadHistory || []) : [],
      exports: settings.pro?.driveSyncExports ? { enabled: true } : null
    };

    await syncToDrive(payload, { interactive });

    await chrome.storage.local.set({
      [DRIVE_SYNC_STATUS_KEY]: {
        lastSyncAt: Date.now(),
        lastResult: 'success'
      }
    });

    notifyDriveSync(
      chrome.i18n.getMessage('driveSyncNotifyTitle'),
      chrome.i18n.getMessage('driveSyncNotifySuccess')
    );

    return { success: true };
  } catch (error) {
    const rawMessage = error?.message || '';
    const authUnsupported =
      rawMessage.includes('invalid_request') ||
      rawMessage.includes('Custom URI scheme is not supported');
    const missingWebClient = rawMessage.includes('missing_web_client_id');
    const message = missingWebClient
      ? chrome.i18n.getMessage('driveSyncWebClientMissing')
      : authUnsupported
        ? chrome.i18n.getMessage('driveSyncAuthNotSupported')
        : rawMessage;

    await chrome.storage.local.set({
      [DRIVE_SYNC_STATUS_KEY]: {
        lastSyncAt: Date.now(),
        lastResult: 'error',
        message
      }
    });

    notifyDriveSync(
      chrome.i18n.getMessage('driveSyncNotifyTitle'),
      chrome.i18n.getMessage('driveSyncNotifyFailed')
    );
    return { success: false, message };
  }
}

async function updateDriveSyncAlarm(proSettings = null) {
  const settings = await getSettings();
  const driveSettings = proSettings || settings.pro || {};

  await new Promise((resolve) => {
    chrome.alarms.clear('drive-sync', () => resolve());
  });
  if (driveSettings.driveSyncEnabled) {
    chrome.alarms.create('drive-sync', { periodInMinutes: 60 });
  }
}

// Listen for filename determination - suggest the correct path
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const url = downloadItem.url || downloadItem.finalUrl;

  // Handle async logic
  (async () => {
    try {
      const settings = await getSettings();

      if (!settings.enabled) {
        return null;
      }

      // Check if from target site
      const fromTargetSite = isTargetSite(url, downloadItem.referrer, downloadItem.filename);

      if (!fromTargetSite) {
        console.log('[Stockpile] Not a target site, using default:', url);
        return null;
      }

      // Get metadata
      const metadata = await consumePendingDownload(url);

      // Get active tab URL for better category detection
      let activeTabUrl = null;
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        activeTabUrl = activeTab?.url || null;
      } catch (e) {
        console.log('[Stockpile] Could not get active tab:', e);
      }

      console.log('[Stockpile] Download item:', {
        url: url,
        referrer: downloadItem.referrer,
        activeTabUrl: activeTabUrl,
        filename: downloadItem.filename,
        metadata: metadata
      });

      const siteKey = detectSiteKey({
        url,
        referrer: downloadItem.referrer,
        pageUrl: activeTabUrl,
        filename: downloadItem.filename,
        metadata
      });

      if (siteKey && settings.sites?.[siteKey]?.enabled === false) {
        console.log('[Stockpile] Site disabled:', siteKey);
        return null;
      }

      if (siteKey && PRO_SITE_KEYS.has(siteKey)) {
        const proStatus = await getProStatus();
        if (!proStatus.paid) {
          console.log('[Stockpile] Pro site blocked (unpaid):', siteKey);
          return null;
        }
      }

      // Determine target folder (pass activeTabUrl for better detection)
      const folder = await determineFolder(downloadItem, metadata, activeTabUrl);

      if (folder) {
        const originalFilename = downloadItem.filename;
        const newPath = `${folder}/${originalFilename}`;

        console.log('[Stockpile] Suggesting path:', newPath);

        // Record to database (don't await, do in background)
        addRecord({
          title: metadata?.title || originalFilename,
          fileName: originalFilename,
          filePath: newPath,
          category: metadata?.category || getCategoryFromExtension(originalFilename),
          site: metadata?.site || 'Unknown',
          sourceUrl: metadata?.sourceUrl || '',
          tags: metadata?.tags || [],
          duration: metadata?.duration || null
        });

        // Note: URL is saved in the database.
        // The launch agent will create .webloc from ZIP filename pattern.
        // Source URL can be looked up in extension popup if needed.

        return newPath;
      }

      return null;
    } catch (error) {
      console.error('[Stockpile] Error in onDeterminingFilename:', error);
      return null;
    }
  })().then((newPath) => {
    if (newPath) {
      suggest({ filename: newPath });
    } else {
      suggest();
    }
  });

  // Return true to indicate we will call suggest asynchronously
  return true;
});

// Periodic cleanup of old pending downloads
chrome.alarms.create('cleanup', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    await cleanupPendingDownloads();
  }
  if (alarm.name === 'drive-sync') {
    await performDriveSync(false);
  }
});

// Initial cleanup on startup
cleanupPendingDownloads();
updateDriveSyncAlarm();
initExtPayBackground();

console.log('[Stockpile] Service worker initialized');
