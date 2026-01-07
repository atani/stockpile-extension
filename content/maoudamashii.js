// Content Script for 魔王魂 (Maou Damashii)
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'MaouDamashii';

  /**
   * Extract category from URL
   * /category/bgm/ -> BGM
   * /category/se/ -> SE
   * /category/song/ -> Vocal
   */
  function extractCategory() {
    const url = window.location.href;

    if (url.includes('/category/se/') || url.includes('/se/')) {
      return 'se';
    }
    if (url.includes('/category/song/') || url.includes('/song/')) {
      return 'vocal';
    }
    if (url.includes('/category/bgm/') || url.includes('/bgm/')) {
      return 'bgm';
    }

    // Check page content for category hints
    const breadcrumb = document.querySelector('.breadcrumb, nav[aria-label="breadcrumb"]');
    if (breadcrumb) {
      const text = breadcrumb.textContent?.toLowerCase() || '';
      if (text.includes('効果音') || text.includes('se')) return 'se';
      if (text.includes('歌') || text.includes('vocal')) return 'vocal';
    }

    return 'bgm'; // Default
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

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const title = ogTitle.getAttribute('content');
      if (title) return title.split('|')[0]?.trim();
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  /**
   * Extract artist/composer
   */
  function extractArtist() {
    return '森田交一';
  }

  /**
   * Extract tags from page
   */
  function extractTags() {
    const tags = [];

    const tagLinks = document.querySelectorAll('a[href*="/tag/"], a[rel="tag"], .tag-link');
    tagLinks.forEach(el => {
      const tag = el.textContent?.trim();
      if (tag && tag.length < 50 && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    return tags.slice(0, 20);
  }

  /**
   * Extract duration from page
   */
  function extractDuration() {
    const allText = document.body.innerText;
    const durationMatch = allText.match(/(\d{1,2}:\d{2})/);
    if (durationMatch) {
      return durationMatch[1];
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
    if (category.includes('vocal') || category.includes('song')) {
      return 'Vocal';
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

    if (href.includes('download') || href.includes('.mp3') || href.includes('.wav')) {
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
          console.log('[Stockpile] Registered MaouDamashii download:', href, metadata);
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
            const downloadLinks = node.querySelectorAll?.('a[href*="download"], a[href*=".mp3"]') || [];
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
      if (url && (url.includes('download') || url.includes('.mp3'))) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Initialize
  function init() {
    console.log('[Stockpile] MaouDamashii content script loaded');
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
