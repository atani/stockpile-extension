// Background Service Worker - Download monitoring and routing

import {
  getSettings,
  consumePendingDownload,
  cleanupPendingDownloads
} from '../lib/storage.js';
import { addRecord } from '../lib/database.js';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REGISTER_DOWNLOAD') {
    handleRegisterDownload(message.data, sender.tab);
    sendResponse({ success: true });
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse(settings));
    return true; // Keep channel open for async response
  }

  return true;
});

/**
 * Handle download registration from content script
 */
async function handleRegisterDownload(data, tab) {
  const { url, metadata } = data;

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
async function determineFolder(downloadItem, metadata) {
  const settings = await getSettings();

  if (!settings.enabled) {
    return null; // Use default download location
  }

  const baseFolder = settings.baseFolder || 'Stockpile';

  // Determine site from URL or metadata
  let siteName = metadata?.site || 'Unknown';
  let category = metadata?.category || 'Other';

  // If no metadata, try to determine from URL
  if (!metadata) {
    const url = downloadItem.url || downloadItem.finalUrl || '';

    if (url.includes('motionelements.com') || url.includes('motionelements')) {
      siteName = 'MotionElements';
      category = getCategoryFromExtension(downloadItem.filename);
    } else if (url.includes('audiio.com') || url.includes('audiio')) {
      siteName = 'Audiio';
      category = getCategoryFromExtension(downloadItem.filename);
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
 * Check if URL is from a target site
 */
function isTargetSite(url) {
  if (!url) return false;
  const targetDomains = [
    'motionelements',
    'audiio'
  ];
  return targetDomains.some(domain => url.toLowerCase().includes(domain));
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
      const fromTargetSite = isTargetSite(url) || isTargetSite(downloadItem.referrer);

      if (!fromTargetSite) {
        console.log('[Stockpile] Not a target site, using default:', url);
        return null;
      }

      // Get metadata
      const metadata = await consumePendingDownload(url);

      // Determine target folder
      const folder = await determineFolder(downloadItem, metadata);

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
});

// Initial cleanup on startup
cleanupPendingDownloads();

console.log('[Stockpile] Service worker initialized');
