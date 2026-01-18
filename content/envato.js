// Content Script for Envato Elements
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Envato';

  function extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item && typeof item === 'object') {
            return item;
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return null;
  }

  function extractTitle() {
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    const selectors = [
      'h1',
      '[data-testid="item-title"]',
      '.item-title',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const title = el.getAttribute('content') || el.textContent?.trim();
        if (title && title.length < 200) return title;
      }
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const jsonLd = extractJsonLd();
    if (jsonLd?.genre) return String(jsonLd.genre).toLowerCase();

    const url = window.location.href.toLowerCase();
    if (url.includes('/video') || url.includes('footage')) return 'video';
    if (url.includes('/audio') || url.includes('music')) return 'music';
    if (url.includes('/graphics') || url.includes('/templates')) return 'template';
    return 'other';
  }

  function extractTags() {
    const jsonLd = extractJsonLd();
    if (jsonLd?.keywords) {
      if (Array.isArray(jsonLd.keywords)) {
        return jsonLd.keywords.map(String).slice(0, 20);
      }
      if (typeof jsonLd.keywords === 'string') {
        return jsonLd.keywords.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20);
      }
    }

    const tags = [];
    const selectors = ['.tag', '.item-tags a', '[data-testid="tag"]'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const tag = el.textContent?.trim();
        if (tag && !tags.includes(tag)) tags.push(tag);
      });
    });
    return tags.slice(0, 20);
  }

  function mapCategory(rawCategory) {
    if (!rawCategory) return 'Other';
    const category = rawCategory.toLowerCase();
    if (category.includes('video') || category.includes('footage')) return 'Video';
    if (category.includes('music') || category.includes('audio')) return 'BGM';
    if (category.includes('template')) return 'Template';
    return 'Other';
  }

  function getPageMetadata() {
    const rawCategory = extractCategory();
    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory,
      category: mapCategory(rawCategory),
      tags: extractTags(),
      sourceUrl: window.location.href
    };
  }

  function registerDownload(url, metadata) {
    chrome.runtime.sendMessage({
      type: 'REGISTER_DOWNLOAD',
      data: { url, metadata }
    });
  }

  function setupDownloadInterception() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest(
        'a[href*="download"], ' +
        'button[class*="download"], ' +
        '[data-download], ' +
        '[data-testid*="download"], ' +
        '[aria-label*="Download"], ' +
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
          console.log('[Stockpile] Registered Envato download:', href, metadata);
        }
      }
    }, true);
  }

  function setupXHRInterception() {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && typeof url === 'string' && isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalOpen.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };
  }

  function isDownloadUrl(url) {
    const lower = url.toLowerCase();
    return lower.includes('download') || lower.includes('license');
  }

  function init() {
    console.log('[Stockpile] Envato content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
