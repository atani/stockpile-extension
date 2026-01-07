// Content Script for FukiDesign (フキダシデザイン)
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'FukiDesign';

  /**
   * Extract category - all fukidashi
   */
  function extractCategory() {
    return 'fukidashi';
  }

  /**
   * Extract title from page
   */
  function extractTitle() {
    const h1 = document.querySelector('h1');
    if (h1) {
      const title = h1.textContent?.trim();
      if (title && title.length < 200) return title;
    }

    const entryTitle = document.querySelector('.entry-title');
    if (entryTitle) {
      const title = entryTitle.textContent?.trim();
      if (title && title.length < 200) return title;
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const title = ogTitle.getAttribute('content');
      if (title) return title.split('|')[0]?.trim();
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  /**
   * Extract tags from page
   */
  function extractTags() {
    const tags = [];

    const tagLinks = document.querySelectorAll('a[href*="tag/"], a[rel="tag"], .tag-link');
    tagLinks.forEach(el => {
      const tag = el.textContent?.trim();
      if (tag && tag.length < 50 && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    // Also try category links
    const catLinks = document.querySelectorAll('a[href*="category"]');
    catLinks.forEach(el => {
      const tag = el.textContent?.trim();
      if (tag && tag.length < 50 && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    return tags.slice(0, 20);
  }

  /**
   * Map raw category to standardized category
   */
  function mapCategory(rawCategory) {
    return 'Fukidashi';
  }

  /**
   * Get metadata for current page
   */
  function getPageMetadata() {
    const rawCategory = extractCategory();
    const tags = extractTags();

    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory: rawCategory,
      category: mapCategory(rawCategory),
      tags: tags,
      duration: null,
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

    // Check for image download patterns
    if (href.includes('download') || href.includes('.png') || href.includes('.svg') || href.includes('.ai')) {
      return true;
    }
    if (text.includes('ダウンロード') || text.includes('download')) {
      return true;
    }
    if (className.includes('download')) {
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
        const href = target.href || target.dataset?.download || target.dataset?.url;

        if (href) {
          const metadata = getPageMetadata();
          registerDownload(href, metadata);
          console.log('[Stockpile] Registered FukiDesign download:', href, metadata);
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
            const downloadLinks = node.querySelectorAll?.('a[href*="download"], a[href*=".png"], a[href*=".svg"]') || [];
            downloadLinks.forEach((link) => {
              link.addEventListener('click', () => {
                const metadata = getPageMetadata();
                const href = link.href;
                if (href) {
                  registerDownload(href, metadata);
                }
              }, { once: true });
            });
          }
        });
      });
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  /**
   * Monitor network requests for download URLs
   */
  function setupXHRInterception() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && (url.includes('download') || url.includes('.png') || url.includes('.svg'))) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Initialize
  function init() {
    console.log('[Stockpile] FukiDesign content script loaded');
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
