// Content Script for Adobe Stock
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Adobe Stock';

  function extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item && typeof item === 'object') {
            if (Array.isArray(item['@graph'])) {
              for (const graphItem of item['@graph']) {
                if (graphItem && typeof graphItem === 'object') {
                  return graphItem;
                }
              }
            }
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
    // Try asset title elements
    const titleSelectors = [
      '[data-testid="asset-title"]',
      '.asset-title',
      '.detail-header h1',
      'h1[class*="title"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        const text = el.textContent.trim();
        if (text.length > 2) return text;
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    // Try meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) {
      return ogTitle.content.replace(/\s*[-|]\s*Adobe Stock.*$/i, '').trim();
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Video
    if (path.includes('/video/') || path.includes('/footage/') || url.includes('video')) {
      return 'video';
    }
    // Audio/Music
    if (path.includes('/audio/') || path.includes('/music/') || url.includes('audio')) {
      return 'music';
    }
    // Templates
    if (path.includes('/template') || url.includes('template')) {
      return 'template';
    }
    // 3D
    if (path.includes('/3d/') || url.includes('3d-assets')) {
      return '3d';
    }
    // Images (photos, illustrations, vectors)
    if (path.includes('/images/') || path.includes('/photo/') ||
        path.includes('/illustration/') || path.includes('/vector/')) {
      return 'image';
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.['@type']) {
      const type = jsonLd['@type'].toLowerCase();
      if (type.includes('video')) return 'video';
      if (type.includes('audio') || type.includes('music')) return 'music';
      if (type.includes('image')) return 'image';
    }

    return 'image';
  }

  function extractTags() {
    const tags = [];

    // Try JSON-LD keywords
    const jsonLd = extractJsonLd();
    if (jsonLd?.keywords) {
      if (Array.isArray(jsonLd.keywords)) {
        jsonLd.keywords.forEach(k => tags.push(String(k)));
      } else if (typeof jsonLd.keywords === 'string') {
        jsonLd.keywords.split(',').forEach(k => {
          const trimmed = k.trim();
          if (trimmed) tags.push(trimmed);
        });
      }
    }

    // Try tag/keyword elements on page
    document.querySelectorAll('[class*="keyword"], [class*="tag"], a[href*="/search?k="]').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length < 50 && !tags.includes(text)) {
        tags.push(text);
      }
    });

    return tags.slice(0, 20);
  }

  function mapCategory(rawCategory) {
    if (!rawCategory) return 'Image';
    const category = rawCategory.toLowerCase();
    if (category.includes('video') || category.includes('footage')) return 'Video';
    if (category.includes('music') || category.includes('audio')) return 'BGM';
    if (category.includes('template')) return 'Template';
    if (category.includes('3d')) return '3D';
    return 'Image';
  }

  function getPageMetadata() {
    const jsonLd = extractJsonLd();
    const rawCategory = extractCategory();
    const metadata = {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory,
      category: mapCategory(rawCategory),
      tags: extractTags(),
      duration: jsonLd?.duration || null,
      sourceUrl: window.location.href
    };
    debugLog('metadata', metadata);
    return metadata;
  }

  function registerDownload(url, metadata) {
    debugLog('register', { url, metadata });
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
        '[aria-label*="ダウンロード"], ' +
        '[class*="download"], ' +
        '[class*="license"]'
      );

      if (target) {
        const href = target.href ||
          target.dataset?.download ||
          target.dataset?.url ||
          target.closest('a')?.href;

        if (href) {
          const metadata = getPageMetadata();
          registerDownload(href, metadata);
          console.log('[Stockpile] Registered Adobe Stock download:', href, metadata);
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
    return lower.includes('download') || lower.includes('license') ||
           lower.includes('/dl/') || lower.includes('asset-download');
  }

  function init() {
    window.__stockpileAdobeStockLoaded = true;
    document.documentElement.setAttribute('data-stockpile-adobestock', 'loaded');
    console.log('[Stockpile] Adobe Stock content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][AdobeStock][${label}]`, payload);
      }
    } catch {
      // ignore storage access errors
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
