// Content Script for DOVA-SYNDROME
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'DOVA-SYNDROME';

  /**
   * Extract category from URL
   * /bgm/ -> BGM, /se/ -> SE
   */
  function extractCategory() {
    const url = window.location.href;

    if (url.includes('/se/')) {
      return 'se';
    }
    if (url.includes('/bgm/')) {
      return 'bgm';
    }

    return 'bgm'; // Default
  }

  /**
   * Extract title from page
   */
  function extractTitle() {
    // Try h1 first
    const h1 = document.querySelector('h1');
    if (h1) {
      const title = h1.textContent?.trim();
      if (title && title.length < 200) return title;
    }

    // Try og:title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const title = ogTitle.getAttribute('content');
      if (title) return title.split('|')[0]?.trim();
    }

    // Fallback to document title
    return document.title.split('|')[0]?.trim() || '';
  }

  /**
   * Extract artist/composer
   */
  function extractArtist() {
    // Look for "written by" pattern
    const writtenByElements = document.querySelectorAll('a[href*="/profile/"]');
    for (const el of writtenByElements) {
      const artist = el.textContent?.trim();
      if (artist) return artist;
    }

    // Look for text containing "written by" or "作曲"
    const allText = document.body.innerText;
    const writtenByMatch = allText.match(/written by\s+([^\n]+)/i);
    if (writtenByMatch) {
      return writtenByMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract tags from page
   */
  function extractTags() {
    const tags = [];

    // DOVA uses links for tags
    const tagLinks = document.querySelectorAll('a[href*="/tag/"], a[href*="?tag="]');
    tagLinks.forEach(el => {
      const tag = el.textContent?.trim().replace(/[\[\]]/g, '');
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    return tags.slice(0, 20);
  }

  /**
   * Extract duration from page
   */
  function extractDuration() {
    // Look for duration pattern like "1:49" or "再生時間：1:49"
    const allText = document.body.innerText;
    const durationMatch = allText.match(/再生時間[：:]\s*(\d+:\d+)/);
    if (durationMatch) {
      return durationMatch[1];
    }

    // General pattern
    const timeMatch = allText.match(/\b(\d{1,2}:\d{2})\b/);
    if (timeMatch) {
      return timeMatch[1];
    }

    return null;
  }

  /**
   * Map raw category to standardized category
   */
  function mapCategory(rawCategory) {
    if (!rawCategory) return 'BGM';

    const category = rawCategory.toLowerCase();

    if (category.includes('se') || category.includes('effect')) {
      return 'SE';
    }

    return 'BGM';
  }

  /**
   * Get metadata for current page
   */
  function getPageMetadata() {
    const rawCategory = extractCategory();
    const artist = extractArtist();
    const tags = extractTags();

    if (artist && !tags.includes(artist)) {
      tags.unshift(artist);
    }

    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory: rawCategory,
      category: mapCategory(rawCategory),
      tags: tags,
      duration: extractDuration(),
      sourceUrl: window.location.href
    };
  }

  /**
   * Register a download with the background script
   */
  function registerDownload(url, metadata) {
    if (!chrome.runtime?.id) {
      console.warn('[Stockpile] Extension context invalidated');
      return;
    }
    chrome.runtime.sendMessage({
      type: 'REGISTER_DOWNLOAD',
      data: { url, metadata }
    });
  }

  /**
   * Check if element is a download button/link
   */
  function isDownloadElement(element) {
    if (!element) return false;

    const href = element.href || '';
    const text = element.textContent?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';

    // Check for download-related patterns
    if (href.includes('download') || href.includes('.mp3')) {
      return true;
    }
    if (text.includes('ダウンロード') || text.includes('download')) {
      return true;
    }
    if (className.includes('download') || className.includes('dl-')) {
      return true;
    }

    return false;
  }

  /**
   * Intercept download clicks
   */
  function setupDownloadInterception() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('a, button, [role="button"]');

      if (target && isDownloadElement(target)) {
        const href = target.href ||
                    target.dataset?.download ||
                    target.dataset?.url ||
                    target.closest('a')?.href;

        if (href) {
          const metadata = getPageMetadata();
          registerDownload(href, metadata);
          console.log('[Stockpile] Registered DOVA download:', href, metadata);
        }
      }
    }, true);

    // Also capture form submissions (some download pages use forms)
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.action && (form.action.includes('download') || form.action.includes('.mp3'))) {
        const metadata = getPageMetadata();
        registerDownload(form.action, metadata);
        console.log('[Stockpile] Registered DOVA form download:', form.action, metadata);
      }
    }, true);
  }

  /**
   * Watch for dynamically added download links
   */
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const downloadLinks = node.querySelectorAll?.('a[href*="download"], a[href*=".mp3"]') || [];
            downloadLinks.forEach((link) => {
              link.addEventListener('click', () => {
                const metadata = getPageMetadata();
                const href = link.href || link.dataset?.url;
                if (href) {
                  registerDownload(href, metadata);
                  console.log('[Stockpile] Registered DOVA dynamic download:', href, metadata);
                }
              }, { once: true });
            });
          }
        });
      });
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * Monitor network requests for download URLs
   */
  function setupXHRInterception() {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && typeof url === 'string' && (url.includes('download') || url.includes('.mp3'))) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
        console.log('[Stockpile] Registered DOVA XHR download:', url, metadata);
      }
      return originalOpen.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && (url.includes('download') || url.includes('.mp3'))) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
        console.log('[Stockpile] Registered DOVA fetch download:', url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Initialize
  function init() {
    console.log('[Stockpile] DOVA-SYNDROME content script loaded');
    setupDownloadInterception();
    setupMutationObserver();
    setupXHRInterception();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
