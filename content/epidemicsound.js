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
      if (text.length > 2 && !text.toLowerCase().includes('epidemic sound')) {
        return text;
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    // Try various selectors
    const selectors = [
      '[data-testid="track-title"]',
      '[data-testid="sfx-title"]',
      '.track-title',
      '.track-name',
      '[class*="TrackTitle"]',
      '[class*="SfxTitle"]',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const title = el.getAttribute('content') || el.textContent?.trim();
        if (title && title.length < 200) {
          return title.replace(/\s*[-|]\s*Epidemic Sound.*$/i, '').trim();
        }
      }
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Sound effects
    if (path.includes('/sound-effects') || path.includes('/sfx')) {
      return 'sfx';
    }
    // Music tracks
    if (path.includes('/music') || path.includes('/track/')) {
      return 'music';
    }
    // Collections/playlists
    if (path.includes('/playlist') || path.includes('/collection')) {
      return 'music';
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.genre) {
      const genre = String(jsonLd.genre).toLowerCase();
      if (genre.includes('sfx') || genre.includes('sound effect')) return 'sfx';
      return 'music';
    }

    return 'music';
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

    // Try genre from JSON-LD
    if (jsonLd?.genre) {
      const genres = Array.isArray(jsonLd.genre) ? jsonLd.genre : [jsonLd.genre];
      genres.forEach(g => {
        const trimmed = String(g).trim();
        if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
      });
    }

    // Try tag elements on page
    const selectors = [
      '.tag',
      '.genre',
      '.mood',
      '[data-testid="tag"]',
      '[data-testid="genre"]',
      '[data-testid="mood"]',
      '[class*="Tag"]',
      '[class*="Genre"]',
      '[class*="Mood"]',
      'a[href*="/genre/"]',
      'a[href*="/mood/"]'
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
      '[data-testid="track-duration"]',
      '[class*="Duration"]',
      '[class*="Time"]'
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
    if (!rawCategory) return 'BGM';
    const category = rawCategory.toLowerCase();
    if (category.includes('sfx') || category.includes('sound-effect') || category.includes('sound effect')) {
      return 'SE';
    }
    return 'BGM';
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
    return lower.includes('download') || lower.includes('license') ||
           lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.aiff');
  }

  function init() {
    window.__stockpileEpidemicSoundLoaded = true;
    document.documentElement.setAttribute('data-stockpile-epidemicsound', 'loaded');
    console.log('[Stockpile] Epidemic Sound content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][EpidemicSound][${label}]`, payload);
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
