// Content Script for Coverr
// Extracts metadata and registers downloads

(function() {
  'use strict';

  const SITE_NAME = 'Coverr';

  function extractTitle() {
    const selectors = [
      'h1',
      'meta[property="og:title"]',
      'meta[name="title"]'
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

  function extractTags() {
    const tags = [];
    const selectors = [
      '.tag',
      'a[href*="/search/"]',
      'meta[name="keywords"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const tag = el.getAttribute('content') || el.textContent?.trim();
        if (!tag) return;
        tag.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed && trimmed.length < 50 && !tags.includes(trimmed)) {
            tags.push(trimmed);
          }
        });
      });
    }

    return tags.slice(0, 20);
  }

  function extractDuration() {
    const selectors = ['time', '[data-duration]', '.duration', '[class*="duration"]'];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const duration = el.dataset?.duration || el.getAttribute('datetime') || el.textContent?.trim();
        if (duration && /\d/.test(duration)) return duration;
      }
    }

    return null;
  }

  function getPageMetadata() {
    return {
      site: SITE_NAME,
      title: extractTitle(),
      rawCategory: 'video',
      category: 'Video',
      tags: extractTags(),
      duration: extractDuration(),
      sourceUrl: window.location.href
    };
  }

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

  function isDownloadUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('download')) return true;
    const extensions = ['.mp4', '.mov', '.webm', '.zip'];
    return extensions.some(ext => lowerUrl.includes(ext));
  }

  function isDownloadElement(element) {
    if (!element) return false;
    const text = element.textContent?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    const href = element.href || '';

    if (text.includes('download') || text.includes('ダウンロード')) return true;
    if (ariaLabel.includes('download')) return true;
    if (className.includes('download')) return true;
    if (isDownloadUrl(href)) return true;

    return false;
  }

  function setupDownloadInterception() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('a, button, [role="button"]');
      if (target && isDownloadElement(target)) {
        const href = target.href ||
          target.dataset?.download ||
          target.dataset?.url ||
          target.getAttribute('data-download');

        if (href) {
          const metadata = getPageMetadata();
          registerDownload(href, metadata);
          console.log('[Stockpile] Registered Coverr download:', href, metadata);
        }
      }
    }, true);
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const links = node.querySelectorAll?.('a[download], a[href*="download"]') || [];
            links.forEach((link) => {
              link.addEventListener('click', () => {
                if (!isDownloadUrl(link.href)) return;
                const metadata = getPageMetadata();
                registerDownload(link.href, metadata);
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

  function setupXHRInterception() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url;
      if (isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalFetch.apply(this, arguments);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (isDownloadUrl(url)) {
        const metadata = getPageMetadata();
        registerDownload(url, metadata);
      }
      return originalOpen.apply(this, arguments);
    };
  }

  function init() {
    console.log('[Stockpile] Coverr content script loaded');
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
