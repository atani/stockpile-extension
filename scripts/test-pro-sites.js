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
  await sleep(1000);

  // Enable devOverride for testing Pro sites
  const enabled = await page.evaluate(() => {
    const checkbox = document.querySelector('#proDevOverride');
    if (checkbox && !checkbox.checked) {
      checkbox.click();
      return true;
    }
    return checkbox?.checked || false;
  });

  console.log(`DevOverride enabled: ${enabled}`);
  return enabled;
}

async function testMixkit(browser, extensionId) {
  console.log('\n=== Testing Mixkit ===');
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
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

    // Find and click download button
    const downloadBtn = await page.$('button[class*="download"]');
    if (downloadBtn) {
      console.log('Found download button, clicking...');
      await downloadBtn.click();
      await sleep(5000);
      console.log('Download initiated');
      return { success: true, site: 'Mixkit', title };
    } else {
      console.log('Download button not found');
      return { success: false, site: 'Mixkit', error: 'Download button not found' };
    }
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

    return { success: true, site: 'Epidemic Sound', title, note: 'Requires login for download' };
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
    const url = 'https://elements.envato.com/happy-corporate-ambient-L62ZK43';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    return { success: true, site: 'Envato', title, note: 'Requires login for download' };
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
    const url = 'https://motionarray.com/stock-video/sunset-mountain-view-2848115/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const title = await page.title();
    console.log(`Page title: ${title}`);

    return { success: true, site: 'Motion Array', title, note: 'Requires login for download' };
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

    return { success: true, site: 'Adobe Stock', title, note: 'Requires login for download' };
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
    console.log('\nKeeping browser open for 30 seconds for inspection...');
    await sleep(30000);
    await browser.close();
  }
}

main().catch(console.error);
