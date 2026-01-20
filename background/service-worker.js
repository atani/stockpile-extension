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
    } else if (url.includes('pexels.com') || referrer.includes('pexels.com') ||
               pageUrl.includes('pexels.com')) {
      siteName = 'Pexels';
      if (pageUrl.includes('/videos/') || pageUrl.includes('/video/')) {
        category = 'Video';
      } else {
        category = 'Photo';
      }
    } else if (url.includes('pixabay.com') || referrer.includes('pixabay.com') ||
               pageUrl.includes('pixabay.com')) {
      siteName = 'Pixabay';
      if (pageUrl.includes('/videos/') || pageUrl.includes('/video/')) {
        category = 'Video';
      } else {
        category = 'Photo';
      }
    } else if (url.includes('coverr.co') || referrer.includes('coverr.co') ||
               pageUrl.includes('coverr.co')) {
      siteName = 'Coverr';
      category = 'Video';
    } else if (url.includes('freepik.com') || referrer.includes('freepik.com') ||
               pageUrl.includes('freepik.com')) {
      siteName = 'Freepik';
      if (pageUrl.includes('/video') || pageUrl.includes('/videos')) {
        category = 'Video';
      } else if (pageUrl.includes('/psd')) {
        category = 'PSD';
      } else if (pageUrl.includes('/vector') || pageUrl.includes('/vectors')) {
        category = 'Vector';
      } else if (pageUrl.includes('/icon') || pageUrl.includes('/icons')) {
        category = 'Icon';
      } else {
        category = 'Photo';
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
    // Images
    'jpg': 'Photo',
    'jpeg': 'Photo',
    'png': 'Photo',
    'gif': 'Photo',
    'webp': 'Photo',
    'svg': 'Photo',
    'bmp': 'Photo',
    'tiff': 'Photo',
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
    'pexels.com',
    'pixabay.com',
    'coverr.co',
    'freepik.com'
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
});

// Initial cleanup on startup
cleanupPendingDownloads();

console.log('[Stockpile] Service worker initialized');
