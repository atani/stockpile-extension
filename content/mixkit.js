// Content Script for Mixkit
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Mixkit';

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
      if (text.length > 2 && text.toLowerCase() !== 'mixkit') {
        return text;
      }
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.name) return String(jsonLd.name).trim();

    // Try meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) {
      return ogTitle.content.replace(/\s*[-|]\s*Mixkit.*$/i, '').trim();
    }

    return document.title.split('|')[0]?.trim() || '';
  }

  function extractCategory() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Video categories
    if (path.includes('/free-stock-video') || path.includes('/video/')) {
      return 'video';
    }
    // Music categories
    if (path.includes('/free-stock-music') || path.includes('/music/')) {
      return 'music';
    }
    // Sound effects
    if (path.includes('/free-sound-effects') || path.includes('/sfx/')) {
      return 'sfx';
    }
    // Video templates
    if (path.includes('/video-templates') || path.includes('/template/')) {
      return 'template';
    }

    // Try JSON-LD
    const jsonLd = extractJsonLd();
    if (jsonLd?.['@type']) {
      const type = jsonLd['@type'].toLowerCase();
      if (type.includes('video')) return 'video';
      if (type.includes('music') || type.includes('audio')) return 'music';
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
    document.querySelectorAll('.tag, [class*="tag-"], a[href*="/tag/"]').forEach(el => {
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
    if (category.includes('template')) return 'Template';
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
          console.log('[Stockpile] Registered Mixkit download:', href, metadata);
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
           lower.includes('.mp4') || lower.includes('.mp3') || lower.includes('.wav');
  }

  function init() {
    window.__stockpileMixkitLoaded = true;
    document.documentElement.setAttribute('data-stockpile-mixkit', 'loaded');
    console.log('[Stockpile] Mixkit content script loaded');
    setupDownloadInterception();
    setupXHRInterception();
    debugLog('init', { url: window.location.href });
  }

  function debugLog(label, payload) {
    try {
      if (window.localStorage.getItem('stockpileDebug') === '1') {
        console.log(`[Stockpile][Mixkit][${label}]`, payload);
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
