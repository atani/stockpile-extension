// Content Script for Artlist
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Artlist';

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

  function extractNextData() {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el?.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  }

  function findFirstMatch(obj, predicate, depth = 0) {
    if (!obj || depth > 6) return null;
    if (predicate(obj)) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findFirstMatch(item, predicate, depth + 1);
        if (found) return found;
      }
    } else if (typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const found = findFirstMatch(value, predicate, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function extractFromNextData() {
    const nextData = extractNextData();
    if (!nextData?.props) return null;

    const candidate = findFirstMatch(nextData.props, (value) => {
      if (!value || typeof value !== 'object') return false;
      const hasTitle = !!(value.title || value.name);
      const hasTags = !!(value.tags || value.genres || value.moods);
      const hasDuration = !!(value.duration || value.durationInSeconds || value.length);
      return hasTitle && (hasTags || hasDuration);
    });

    if (!candidate) return null;

    return {
      title: candidate.title || candidate.name || '',
      tags: candidate.tags || candidate.genres || candidate.moods || [],
      duration: candidate.duration || candidate.durationInSeconds || candidate.length || null,
      category: candidate.type || candidate.assetType || candidate.category || null
    };
  }

  function extractTitle() {
    const headers = [...document.querySelectorAll('h1')];
    for (const header of headers) {
      const text = header.textContent?.trim();
      if (!text) continue;
      if (text.toLowerCase() === 'artlist') continue;
      if (text.length < 2) continue;
      return text;
    }

    const next = extractFromNextData();
    if (next?.title) return String(next.title).trim();

    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    const selectors = [
      '[data-testid="asset-title"]',
      '.asset-title',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const title = el.getAttribute('content') || el.textContent?.trim();
      if (title && title.length < 200) {
        return title.replace(/\s*\|\s*Artlist.*$/i, '').replace(/\s*-\s*Royalty Free Music.*$/i, '').trim();
      }
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const next = extractFromNextData();
    if (next?.category) return String(next.category).toLowerCase();

    const jsonLd = extractJsonLd();
    if (jsonLd?.genre) return String(jsonLd.genre).toLowerCase();

    const url = window.location.href.toLowerCase();
    if (url.includes('/sfx') || url.includes('sound-effect')) return 'sfx';
    if (url.includes('/music') || url.includes('music')) return 'music';
    if (url.includes('/video') || url.includes('footage')) return 'video';
    return 'music';
  }

  function extractTags() {
    const next = extractFromNextData();
    if (next?.tags) {
      const tags = Array.isArray(next.tags) ? next.tags : [next.tags];
      return tags.map(String).map(t => t.trim()).filter(Boolean).slice(0, 20);
    }

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
    const sectionTags = extractTagsFromSections(['Mood', 'Genre']);
    sectionTags.forEach(tag => tags.push(tag));
    const selectors = ['.tag', '.mood', '.genre', '[data-testid="tag"]'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const tag = el.textContent?.trim();
        if (tag && !tags.includes(tag)) tags.push(tag);
      });
    });
    return tags.slice(0, 20);
  }

  function mapCategory(rawCategory) {
    if (!rawCategory) return 'BGM';
    const category = rawCategory.toLowerCase();
    if (category.includes('sfx') || category.includes('sound')) return 'SE';
    if (category.includes('video') || category.includes('footage')) return 'Video';
    return 'BGM';
  }

  function extractTagsFromSections(sectionLabels) {
    const collected = [];
    const lowerLabels = sectionLabels.map(label => label.toLowerCase());
    const headings = document.querySelectorAll('h2, h3, h4, [role="heading"]');
    headings.forEach(heading => {
      const label = heading.textContent?.trim();
      if (!label) return;
      const lowerLabel = label.toLowerCase();
      if (!lowerLabels.some(candidate => lowerLabel.includes(candidate))) return;
      const container = heading.closest('section, div') || heading.parentElement;
      if (!container) return;
      container.querySelectorAll('button, a, span').forEach(el => {
        const text = el.textContent?.trim();
        if (!text) return;
        if (text.length > 30) return;
        if (['Play', 'Share', 'Add', 'Reactivate Plan'].includes(text)) return;
        if (!collected.includes(text)) collected.push(text);
      });
    });
    return collected;
  }

  function getPageMetadata() {
    const jsonLd = extractJsonLd();
    const rawCategory = extractCategory();
    const next = extractFromNextData();
    const metadata = {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory,
      category: mapCategory(rawCategory),
      tags: extractTags(),
      duration: next?.duration || jsonLd?.duration || null,
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
          console.log('[Stockpile] Registered Artlist download:', href, metadata);
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
    console.log('[Stockpile] Artlist content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
    const initial = getPageMetadata();
    if (initial?.title && initial.title !== 'Artlist') {
      debugLog('metadata', initial);
    }
    if (window.localStorage.getItem('stockpileDebug') === '1') {
      setTimeout(() => debugLog('metadata:delayed', getPageMetadata()), 1500);
    }
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][Artlist][${label}]`, payload);
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
