// Content Script for Audiio
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Audiio';

  /**
   * Extract category from page
   */
  function extractCategory() {
    // Try URL-based detection first
    const url = window.location.href;

    if (url.includes('/sfx') || url.includes('/sound-effects')) {
      return 'sfx';
    }
    if (url.includes('/music') || url.includes('/browse')) {
      return 'music';
    }

    // Try page elements
    const selectors = [
      '[data-category]',
      '.track-type',
      '.asset-type',
      'meta[name="category"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const category = el.dataset?.category ||
                        el.getAttribute('content') ||
                        el.textContent?.trim().toLowerCase();
        if (category) return category;
      }
    }

    return 'music'; // Default to music for Audiio
  }

  /**
   * Extract title from page
   */
  function extractTitle() {
    const titleSelectors = [
      '.track-title',
      '.song-title',
      'h1[class*="title"]',
      '.asset-name',
      'h1',
      'meta[property="og:title"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const title = el.getAttribute('content') || el.textContent?.trim();
        if (title && title.length < 200) return title;
      }
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  /**
   * Extract artist/composer
   */
  function extractArtist() {
    const artistSelectors = [
      '.artist-name',
      '.composer',
      '[class*="artist"]',
      '.by-line a'
    ];

    for (const selector of artistSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const artist = el.textContent?.trim();
        if (artist) return artist;
      }
    }

    return null;
  }

  /**
   * Extract tags/moods from page
   */
  function extractTags() {
    const tags = [];

    const tagSelectors = [
      '.mood-tag',
      '.genre-tag',
      '.tag',
      '[class*="mood"]',
      '[class*="genre"]'
    ];

    for (const selector of tagSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const tag = el.textContent?.trim();
        if (tag && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    }

    return tags.slice(0, 20);
  }

  /**
   * Extract duration
   */
  function extractDuration() {
    const durationSelectors = [
      '.duration',
      '.track-length',
      '[class*="duration"]',
      'time'
    ];

    for (const selector of durationSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const duration = el.dataset?.duration ||
                        el.getAttribute('datetime') ||
                        el.textContent?.trim();
        if (duration && /\d/.test(duration)) return duration;
      }
    }

    return null;
  }

  /**
   * Map raw category to standardized category
   */
  function mapCategory(rawCategory) {
    if (!rawCategory) return 'BGM';

    const category = rawCategory.toLowerCase();

    if (category.includes('sfx') || category.includes('sound-effect')) {
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
    chrome.runtime.sendMessage({
      type: 'REGISTER_DOWNLOAD',
      data: { url, metadata }
    });
  }

  /**
   * Intercept download clicks
   */
  function setupDownloadInterception() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest(
        'a[href*="download"], ' +
        'button[class*="download"], ' +
        '[data-download], ' +
        '.download-btn, ' +
        '[class*="download"]'
      );

      if (target) {
        const href = target.href ||
                    target.dataset?.download ||
                    target.dataset?.url ||
                    target.closest('a')?.href;

        if (href) {
          const metadata = getPageMetadata();
          registerDownload(href, metadata);
          console.log('[Stockpile] Registered Audiio download:', href, metadata);
        }
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
            const downloadLinks = node.querySelectorAll?.('a[href*="download"], [class*="download"]') || [];
            downloadLinks.forEach((link) => {
              link.addEventListener('click', () => {
                const metadata = getPageMetadata();
                const href = link.href || link.dataset?.url;
                if (href) registerDownload(href, metadata);
              }, { once: true });
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Monitor network requests for download URLs
   */
  function setupXHRInterception() {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && typeof url === 'string' && url.includes('download')) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalOpen.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && url.includes('download')) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Initialize
  function init() {
    console.log('[Stockpile] Audiio content script loaded');
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
