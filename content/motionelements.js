// Content Script for MotionElements
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'MotionElements';

  /**
   * Extract category from page
   */
  function extractCategory() {
    // Try multiple selectors for category
    const selectors = [
      '[data-category]',
      '.breadcrumb a',
      '.category-tag',
      'meta[property="product:category"]',
      '[class*="category"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const category = el.dataset?.category ||
                        el.getAttribute('content') ||
                        el.textContent?.trim();
        if (category) return category;
      }
    }

    // Try to extract from URL
    const url = window.location.href;
    const patterns = [
      // Match: /ja/motion-graphics-template-51647269-...
      /\/(?:ja|en)?\/?((?:free-)?[a-z]+-[a-z]+(?:-[a-z]+)*)-\d+/i,
      // Match: /stock-video/12345
      /\/(?:ja|en)?\/?(?:free-)?([a-z-]+)\/\d+/i,
      /category[=\/]([a-z-]+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log('[Stockpile] Extracted category from URL:', match[1]);
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract title from page
   */
  function extractTitle() {
    // Try specific selectors first
    const titleSelectors = [
      'h1.product-title',
      'h1[class*="title"]',
      '.item-title',
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
   * Extract tags from page
   */
  function extractTags() {
    const tags = [];

    // Try tag selectors
    const tagSelectors = [
      '.tag',
      '[class*="tag-"]',
      '.keyword',
      'meta[name="keywords"]'
    ];

    for (const selector of tagSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const tag = el.getAttribute('content') || el.textContent?.trim();
        if (tag) {
          // Split comma-separated tags
          tag.split(',').forEach(t => {
            const trimmed = t.trim();
            if (trimmed && !tags.includes(trimmed)) {
              tags.push(trimmed);
            }
          });
        }
      });
    }

    return tags.slice(0, 20); // Limit to 20 tags
  }

  /**
   * Extract duration from page
   */
  function extractDuration() {
    const durationSelectors = [
      '[class*="duration"]',
      '.length',
      '[data-duration]',
      'time'
    ];

    for (const selector of durationSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const duration = el.dataset?.duration ||
                        el.getAttribute('datetime') ||
                        el.textContent?.trim();
        if (duration) return duration;
      }
    }

    return null;
  }

  /**
   * Map raw category to standardized category
   */
  function mapCategory(rawCategory) {
    if (!rawCategory) return 'Other';

    const category = rawCategory.toLowerCase();
    const mapping = {
      'stock-video': 'Video',
      'video': 'Video',
      'footage': 'Video',
      'stock-music': 'BGM',
      'music': 'BGM',
      'royalty-free-music': 'BGM',
      'sound-effects': 'SE',
      'sfx': 'SE',
      'stock-sound-effect': 'SE',
      'motion-graphics-template': 'Mogrt',
      'mogrt': 'Mogrt',
      'premiere-pro-template': 'Pr_Template',
      'premiere-pro-preset': 'Preset',
      'after-effects-template': 'AE_Template',
      'after-effects': 'AE_Template',
      'ae-template': 'AE_Template',
      'lut': 'LUT',
      'photo': 'Photo',
      'image': 'Photo'
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (category.includes(key)) {
        return value;
      }
    }

    return 'Other';
  }

  /**
   * Get metadata for current page
   */
  function getPageMetadata() {
    const rawCategory = extractCategory();
    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory: rawCategory,
      category: mapCategory(rawCategory),
      tags: extractTags(),
      duration: extractDuration(),
      sourceUrl: window.location.href
    };
  }

  /**
   * Register a download with the background script
   */
  function registerDownload(url, metadata) {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.warn('[Stockpile] Extension context invalidated. Please reload the page.');
      return;
    }

    chrome.runtime.sendMessage({
      type: 'REGISTER_DOWNLOAD',
      data: { url, metadata }
    });
  }

  /**
   * Check if element is a download button
   */
  function isDownloadButton(element) {
    if (!element) return false;

    // Check text content
    const text = element.textContent?.toLowerCase() || '';
    if (text.includes('download') || text.includes('ダウンロード')) {
      return true;
    }

    // Check class names
    const className = element.className?.toLowerCase() || '';
    if (className.includes('download')) {
      return true;
    }

    // Check data attributes
    if (element.dataset?.download || element.dataset?.action === 'download') {
      return true;
    }

    return false;
  }

  /**
   * Intercept download clicks
   */
  function setupDownloadInterception() {
    // Listen for clicks on download buttons
    document.addEventListener('click', (event) => {
      // Find the closest button or link
      const target = event.target.closest('button, a, [role="button"]');

      if (target && isDownloadButton(target)) {
        const metadata = getPageMetadata();
        // Store metadata for pending download
        const href = target.href || target.dataset?.download || target.dataset?.url || window.location.href;
        registerDownload(href, metadata);
        console.log('[Stockpile] Registered download:', href, metadata);

        // Try to intercept and let extension handle download
        if (chrome.runtime?.id) {
          chrome.runtime.sendMessage({
            type: 'INTERCEPT_DOWNLOAD',
            data: {
              pageUrl: window.location.href,
              metadata
            }
          }, (response) => {
            if (response?.intercepted) {
              console.log('[Stockpile] Download will be handled by extension');
            }
          });
        }
      }
    }, true);

    // Also intercept form submissions that trigger downloads
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.action?.includes('download')) {
        const metadata = getPageMetadata();
        registerDownload(form.action, metadata);
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
            // Check for download links in added content
            const downloadLinks = node.querySelectorAll?.('a[href*="download"]') || [];
            downloadLinks.forEach((link) => {
              link.addEventListener('click', () => {
                const metadata = getPageMetadata();
                registerDownload(link.href, metadata);
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
   * Check if URL looks like a download URL
   */
  function isDownloadUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();

    // Check for download-related patterns
    if (lowerUrl.includes('download')) return true;

    // Check for common download file extensions
    const downloadExtensions = ['.zip', '.mogrt', '.prproj', '.aep', '.mp4', '.mov', '.mp3', '.wav', '.rar'];
    for (const ext of downloadExtensions) {
      if (lowerUrl.includes(ext)) return true;
    }

    return false;
  }

  /**
   * Monitor network requests for download URLs
   */
  function setupXHRInterception() {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && typeof url === 'string' && isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
        console.log('[Stockpile] Intercepted XHR:', url);
      }
      return originalOpen.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
        console.log('[Stockpile] Intercepted fetch:', url);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Initialize
  function init() {
    console.log('[Stockpile] MotionElements content script loaded');
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
