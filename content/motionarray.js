// Content Script for Motion Array
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Motion Array';

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
    // Try h1 first
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.trim()) {
      const text = h1.textContent.trim();
      if (text.length > 2) return text;
    }

    // Try product title elements
    const titleSelectors = [
      '[data-testid="product-title"]',
      '.product-title',
      '.asset-title',
      '[class*="title"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        const text = el.textContent.trim();
        if (text.length > 2 && text.length < 200) return text;
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    // Try meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) {
      return ogTitle.content.replace(/\s*[-|]\s*Motion Array.*$/i, '').trim();
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Stock video/footage
    if (path.includes('/stock-video/') || path.includes('/footage/')) {
      return 'video';
    }
    // Stock music
    if (path.includes('/stock-music/') || path.includes('/royalty-free-music/')) {
      return 'music';
    }
    // Sound effects
    if (path.includes('/sound-effects/') || path.includes('/sfx/')) {
      return 'sfx';
    }
    // Premiere Pro templates
    if (path.includes('/premiere-pro-templates/') || path.includes('/premiere-pro/')) {
      return 'premiere';
    }
    // After Effects templates
    if (path.includes('/after-effects-templates/') || path.includes('/after-effects/')) {
      return 'aftereffects';
    }
    // DaVinci Resolve templates
    if (path.includes('/davinci-resolve-templates/') || path.includes('/davinci-resolve/')) {
      return 'davinci';
    }
    // Final Cut Pro templates
    if (path.includes('/final-cut-pro-templates/') || path.includes('/final-cut/')) {
      return 'finalcut';
    }
    // Motion Graphics templates
    if (path.includes('/motion-graphics-templates/') || path.includes('/mogrt/')) {
      return 'mogrt';
    }
    // Photos
    if (path.includes('/photos/') || path.includes('/stock-photos/')) {
      return 'photo';
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.['@type']) {
      const type = jsonLd['@type'].toLowerCase();
      if (type.includes('video')) return 'video';
      if (type.includes('audio') || type.includes('music')) return 'music';
    }

    return 'video';
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

    // Try tag elements on page
    document.querySelectorAll('.tag, [class*="tag"], a[href*="/browse/"]').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length < 30 && !tags.includes(text)) {
        tags.push(text);
      }
    });

    return tags.slice(0, 20);
  }

  function mapCategory(rawCategory) {
    if (!rawCategory) return 'Video';
    const category = rawCategory.toLowerCase();
    if (category.includes('sfx') || category.includes('sound-effect')) return 'SE';
    if (category.includes('music')) return 'BGM';
    if (category.includes('premiere')) return 'Pr_Template';
    if (category.includes('aftereffects') || category.includes('after-effect')) return 'AE_Template';
    if (category.includes('davinci')) return 'DaVinci_Template';
    if (category.includes('finalcut') || category.includes('final-cut')) return 'FCP_Template';
    if (category.includes('mogrt')) return 'Mogrt';
    if (category.includes('photo')) return 'Photo';
    return 'Video';
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
          console.log('[Stockpile] Registered Motion Array download:', href, metadata);
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
    return lower.includes('download') || lower.includes('/dl/') ||
           lower.includes('asset-download') || lower.includes('file-download');
  }

  function init() {
    console.log('[Stockpile] Motion Array content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][MotionArray][${label}]`, payload);
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
