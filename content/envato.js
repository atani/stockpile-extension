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
      if (text.length > 2 && text.length < 200) {
        return text;
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    // Try various selectors
    const selectors = [
      '[data-testid="item-title"]',
      '.item-title',
      '.product-title',
      '[class*="ItemTitle"]',
      '[class*="ProductTitle"]',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const title = el.getAttribute('content') || el.textContent?.trim();
        if (title && title.length < 200) {
          return title.replace(/\s*[-|]\s*Envato.*$/i, '').trim();
        }
      }
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Video/Footage
    if (path.includes('/video-templates') || path.includes('/video/') ||
        path.includes('/stock-video') || path.includes('/footage')) {
      return 'video';
    }
    // Stock music/audio
    if (path.includes('/royalty-free-music') || path.includes('/music/') ||
        path.includes('/stock-music') || path.includes('/audio/')) {
      return 'music';
    }
    // Sound effects
    if (path.includes('/sound-effects') || path.includes('/sfx')) {
      return 'sfx';
    }
    // Premiere Pro templates
    if (path.includes('/premiere-pro') || path.includes('/prproj')) {
      return 'premiere';
    }
    // After Effects templates
    if (path.includes('/after-effects') || path.includes('/ae-templates')) {
      return 'aftereffects';
    }
    // DaVinci Resolve
    if (path.includes('/davinci-resolve')) {
      return 'davinci';
    }
    // Final Cut Pro
    if (path.includes('/final-cut-pro')) {
      return 'finalcut';
    }
    // Motion Graphics Templates
    if (path.includes('/motion-graphics') || path.includes('/mogrt')) {
      return 'mogrt';
    }
    // Graphics/Photos
    if (path.includes('/graphic-templates') || path.includes('/graphics/')) {
      return 'graphics';
    }
    if (path.includes('/photos') || path.includes('/stock-photos')) {
      return 'photo';
    }
    // 3D
    if (path.includes('/3d/')) {
      return '3d';
    }
    // Presentation templates
    if (path.includes('/presentation-templates')) {
      return 'presentation';
    }
    // Fonts
    if (path.includes('/fonts')) {
      return 'font';
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.genre) {
      const genre = String(jsonLd.genre).toLowerCase();
      if (genre.includes('video')) return 'video';
      if (genre.includes('music') || genre.includes('audio')) return 'music';
    }

    return 'other';
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
    const selectors = [
      '.tag',
      '.item-tags a',
      '[data-testid="tag"]',
      '[class*="Tag"]',
      'a[href*="/tags/"]',
      'a[href*="/search/"]'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const tag = el.textContent?.trim();
        if (tag && tag.length < 30 && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });

    return tags.slice(0, 20);
  }

  function extractDuration() {
    const jsonLd = extractJsonLd();
    if (jsonLd?.duration) return String(jsonLd.duration);

    const selectors = [
      'time',
      '.duration',
      '[class*="Duration"]',
      '[data-testid="duration"]'
    ];

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
    if (!rawCategory) return 'Other';
    const category = rawCategory.toLowerCase();

    if (category.includes('video') || category.includes('footage')) return 'Video';
    if (category.includes('sfx') || category.includes('sound-effect')) return 'SE';
    if (category.includes('music') || category.includes('audio')) return 'BGM';
    if (category.includes('premiere')) return 'Pr_Template';
    if (category.includes('aftereffects') || category.includes('after-effect')) return 'AE_Template';
    if (category.includes('davinci')) return 'DaVinci_Template';
    if (category.includes('finalcut') || category.includes('final-cut')) return 'FCP_Template';
    if (category.includes('mogrt') || category.includes('motion-graphics')) return 'Mogrt';
    if (category.includes('graphics')) return 'Graphics';
    if (category.includes('photo')) return 'Photo';
    if (category.includes('3d')) return '3D';
    if (category.includes('presentation')) return 'Presentation';
    if (category.includes('font')) return 'Font';

    return 'Other';
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
      duration: extractDuration() || jsonLd?.duration || null,
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
        'button[class*="Download"], ' +
        '[data-download], ' +
        '[data-testid*="download"], ' +
        '[data-testid*="Download"], ' +
        '[aria-label*="Download"], ' +
        '[aria-label*="download"], ' +
        '[class*="download"], ' +
        '[class*="Download"]'
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
    return lower.includes('download') || lower.includes('license') ||
           lower.includes('/dl/') || lower.includes('file-download');
  }

  function init() {
    console.log('[Stockpile] Envato content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][Envato][${label}]`, payload);
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
