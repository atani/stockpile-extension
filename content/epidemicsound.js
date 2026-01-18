// Content Script for Epidemic Sound
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Epidemic Sound';

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
      '[data-testid="track-title"]',
      '.track-title',
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
    if (url.includes('/sound-effects') || url.includes('/sfx')) return 'sfx';
    if (url.includes('/music')) return 'music';
    return 'music';
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
    const selectors = ['.tag', '.genre', '.mood', '[data-testid="tag"]'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const tag = el.textContent?.trim();
        if (tag && !tags.includes(tag)) tags.push(tag);
      });
    });
    return tags.slice(0, 20);
  }

  function extractDuration() {
    const jsonLd = extractJsonLd();
    if (jsonLd?.duration) return String(jsonLd.duration);

    const selectors = ['time', '.duration', '[data-testid="track-duration"]'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const duration = el.getAttribute('datetime') || el.textContent?.trim();
        if (duration && /\d/.test(duration)) return duration;
      }
    }
    return null;
  }

  function mapCategory(rawCategory) {
    if (!rawCategory) return 'BGM';
    const category = rawCategory.toLowerCase();
    if (category.includes('sfx') || category.includes('sound')) return 'SE';
    return 'BGM';
  }

  function getPageMetadata() {
    const jsonLd = extractJsonLd();
    const rawCategory = extractCategory();
    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory,
      category: mapCategory(rawCategory),
      tags: extractTags(),
      duration: extractDuration() || jsonLd?.duration || null,
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
          console.log('[Stockpile] Registered Epidemic Sound download:', href, metadata);
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
    console.log('[Stockpile] Epidemic Sound content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
