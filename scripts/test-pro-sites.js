#!/usr/bin/env node
// Test script for Pro sites download functionality

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXTENSION_DIR = path.resolve(__dirname, '..');
const EXTENSION_NAME = 'Stockpile';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getExtensionId(page) {
  const browser = page.browser();
  const findFromTargets = () => {
    const targets = browser.targets();
    const candidate = targets.find(t => t.url().startsWith('chrome-extension://'));
    return candidate ? candidate.url().split('/')[2] : null;
  };

  const start = Date.now();
  while (Date.now() - start < 8000) {
    const id = findFromTargets();
    if (id) return id;
    await sleep(200);
  }

  // Fallback: check chrome://extensions
  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  const extensions = await page.evaluate(async () => {
    const manager = document.querySelector('extensions-manager');
    if (!manager?.shadowRoot) return [];

    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    if (!itemList?.shadowRoot) return [];

    const items = itemList.shadowRoot.querySelectorAll('extensions-item') || [];
    return Array.from(items).map(item => {
      const shadow = item.shadowRoot;
      const name = shadow?.querySelector('#name')?.textContent?.trim() || '';
      const id = shadow?.querySelector('#extension-id')?.textContent?.trim() || item.id || '';
      return { name, id };
    }).filter(e => e.name && e.id);
  });

  const match = extensions.find(ext => ext.name.includes(EXTENSION_NAME));
  if (match) return match.id;
  if (extensions.length > 0) return extensions[0].id;

  throw new Error('Extension not found');
}

async function enableDevOverride(page, extensionId) {
  const optionsUrl = `chrome-extension://${extensionId}/options/options.html`;
  await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Enable devOverride for testing Pro sites
  const enabled = await page.evaluate(() => {
    const checkbox = document.querySelector('#proDevOverride');
    if (checkbox && !checkbox.checked) {
      checkbox.click();
      return true;
    }
    return checkbox?.checked || false;
  });

  console.log(`DevOverride checkbox checked: ${enabled}`);

  // Click save button
  await sleep(500);
  const saveClicked = await page.evaluate(() => {
    const saveBtn = document.querySelector('#saveBtn');
    if (saveBtn) {
      saveBtn.click();
      return true;
    }
    return false;
  });

  console.log(`Save button clicked: ${saveClicked}`);
  await sleep(2000);

  // Verify settings were saved
  const verified = await page.evaluate(async () => {
    return new Promise(resolve => {
      chrome.storage.local.get('settings', (result) => {
        resolve(result?.settings?.pro?.devOverride === true);
      });
    });
  });

  console.log(`DevOverride setting verified in storage: ${verified}`);
  return verified;
}

async function testMixkit(browser, extensionId) {
  console.log('\n=== Testing Mixkit ===');
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('Stockpile')) {
      console.log(`[Console] ${text}`);
    }
  });

  try {
    const url = 'https://mixkit.co/free-stock-video/gift-under-the-christmas-tree-101669/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if content script loaded
    const scriptLoaded = await page.evaluate(() => document.documentElement.getAttribute('data-stockpile-mixkit') === 'loaded');
    console.log(`Content script loaded: ${scriptLoaded}`);

    // Enable debug mode
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('stockpileDebug', '1');
      } catch (e) { }
    });

    // Find download button and inspect it
    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('button[class*="download"], a[class*="download"], [data-testid*="download"]');
      if (!btn) return null;
      return {
        tag: btn.tagName,
        className: btn.className,
        href: btn.href || null,
        innerText: btn.innerText?.substring(0, 50),
        dataset: JSON.stringify(btn.dataset)
      };
    });

    if (buttonInfo) {
      console.log('Download button found:', JSON.stringify(buttonInfo, null, 2));

      // Click the download button
      await page.click('button[class*="download"], a[class*="download"], [data-testid*="download"]');
      await sleep(5000);

      // Check for any REGISTER_DOWNLOAD logs
      const registerLogs = consoleLogs.filter(l => l.includes('Registered') || l.includes('REGISTER') || l.includes('Stockpile'));
      if (registerLogs.length > 0) {
        console.log('Stockpile-related logs found:', registerLogs);
      } else {
        console.log('No Stockpile registration logs found in console');
      }
    } else {
      console.log('Download button not found, checking other selectors...');

      // Try alternative selectors
      const allButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, a');
        return Array.from(buttons)
          .filter(b => b.innerText?.toLowerCase().includes('download'))
          .map(b => ({
            tag: b.tagName,
            className: b.className,
            innerText: b.innerText?.substring(0, 50)
          }));
      });
      console.log('Buttons containing "download" text:', JSON.stringify(allButtons, null, 2));
    }

    return { success: scriptLoaded, site: 'Mixkit', title, note: scriptLoaded ? 'Content script loaded' : 'Content script NOT loaded' };
  } catch (error) {
    console.error('Mixkit test error:', error.message);
    return { success: false, site: 'Mixkit', error: error.message };
  } finally {
    await page.close();
  }
}

async function testEpidemicSound(browser, extensionId) {
  console.log('\n=== Testing Epidemic Sound ===');
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Stockpile')) {
      console.log(`[Console] ${text}`);
    }
  });

  try {
    const url = 'https://www.epidemicsound.com/track/MeOmG4iwpz/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if content script loaded
    const scriptLoaded = await page.evaluate(() => document.documentElement.getAttribute('data-stockpile-epidemicsound') === 'loaded');
    console.log(`Content script loaded: ${scriptLoaded}`);

    return { success: scriptLoaded, site: 'Epidemic Sound', title, note: scriptLoaded ? 'Content script loaded' : 'Content script NOT loaded' };
  } catch (error) {
    console.error('Epidemic Sound test error:', error.message);
    return { success: false, site: 'Epidemic Sound', error: error.message };
  } finally {
    await page.close();
  }
}

async function testEnvato(browser, extensionId) {
  console.log('\n=== Testing Envato ===');
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Stockpile')) {
      console.log(`[Console] ${text}`);
    }
  });

  try {
    const url = 'https://elements.envato.com/upbeat-corporate-AVDJZMS';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if content script loaded
    const scriptLoaded = await page.evaluate(() => document.documentElement.getAttribute('data-stockpile-envato') === 'loaded');
    console.log(`Content script loaded: ${scriptLoaded}`);

    return { success: scriptLoaded, site: 'Envato', title, note: scriptLoaded ? 'Content script loaded' : 'Content script NOT loaded' };
  } catch (error) {
    console.error('Envato test error:', error.message);
    return { success: false, site: 'Envato', error: error.message };
  } finally {
    await page.close();
  }
}

async function testMotionArray(browser, extensionId) {
  console.log('\n=== Testing Motion Array ===');
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Stockpile')) {
      console.log(`[Console] ${text}`);
    }
  });

  try {
    const url = 'https://motionarray.com/stock-video/aerial-drone-flight-over-stunning-autumn-forest-1774783/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if content script loaded
    const scriptLoaded = await page.evaluate(() => document.documentElement.getAttribute('data-stockpile-motionarray') === 'loaded');
    console.log(`Content script loaded: ${scriptLoaded}`);

    return { success: scriptLoaded, site: 'Motion Array', title, note: scriptLoaded ? 'Content script loaded' : 'Content script NOT loaded' };
  } catch (error) {
    console.error('Motion Array test error:', error.message);
    return { success: false, site: 'Motion Array', error: error.message };
  } finally {
    await page.close();
  }
}

async function testAdobeStock(browser, extensionId) {
  console.log('\n=== Testing Adobe Stock ===');
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Stockpile')) {
      console.log(`[Console] ${text}`);
    }
  });

  try {
    const url = 'https://stock.adobe.com/search?k=nature';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if content script loaded
    const scriptLoaded = await page.evaluate(() => document.documentElement.getAttribute('data-stockpile-adobestock') === 'loaded');
    console.log(`Content script loaded: ${scriptLoaded}`);

    return { success: scriptLoaded, site: 'Adobe Stock', title, note: scriptLoaded ? 'Content script loaded' : 'Content script NOT loaded' };
  } catch (error) {
    console.error('Adobe Stock test error:', error.message);
    return { success: false, site: 'Adobe Stock', error: error.message };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('=== Pro Sites Integration Test ===');
  console.log(`Extension: ${EXTENSION_DIR}`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();

    // Get extension ID
    console.log('\nLocating extension...');
    const extensionId = await getExtensionId(page);
    console.log(`Extension ID: ${extensionId}`);

    // Enable devOverride for Pro sites testing
    console.log('\nEnabling devOverride...');
    await enableDevOverride(page, extensionId);
    await page.close();

    // Run tests
    const results = [];

    results.push(await testMixkit(browser, extensionId));
    await sleep(1000);

    results.push(await testEpidemicSound(browser, extensionId));
    await sleep(1000);

    results.push(await testEnvato(browser, extensionId));
    await sleep(1000);

    results.push(await testMotionArray(browser, extensionId));
    await sleep(1000);

    results.push(await testAdobeStock(browser, extensionId));

    // Print summary
    console.log('\n=== Test Summary ===');
    results.forEach((r, i) => {
      const status = r.success ? '✓' : '✗';
      const detail = r.note || r.error || '';
      console.log(`${i + 1}. [${status}] ${r.site}: ${r.title || 'N/A'} ${detail ? `(${detail})` : ''}`);
    });

    const passed = results.filter(r => r.success).length;
    console.log(`\nPassed: ${passed}/${results.length}`);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    console.log('\nKeeping browser open for 5 seconds for inspection...');
    await sleep(5000);
    await browser.close();
  }
}

main().catch(console.error);
