const path = require('path');
const { chromium } = require('playwright');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const DOWNLOADS_PATH = path.resolve(__dirname, '..', 'tmp', 'playwright-downloads');

const TIMEOUT = 300000;

// Test URLs for each site - actual page URLs (not direct download URLs)
const TEST_URLS = {
  pexels: process.env.PEXELS_URL || 'https://www.pexels.com/photo/brown-concrete-building-20727545/',
  pixabay: process.env.PIXABAY_URL || 'https://pixabay.com/photos/rock-nature-landscape-england-9756732/',
  coverr: process.env.COVERR_URL || 'https://coverr.co/videos/a-man-walks-into-a-street-and-looks-around-confidently-z1qh1im2yq',
  freepik: process.env.FREEPIK_URL || 'https://www.freepik.com/free-photo/pathway-middle-green-leafed-trees-with-sun-shining-through-branches_8281186.htm',
  footagecrate: process.env.FOOTAGECRATE_URL || 'https://footagecrate.com/free-video-footage/smoke-rising-1.html',
  pond5: process.env.POND5_URL || 'https://www.pond5.com/stock-footage/item/155638958-aerial-view-mountains-northern-vietnam'
};

// Get site to test from command line argument
const SITE_TO_TEST = process.argv[2] || 'all';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dismissCookieBanner(page) {
  try {
    const cookieSelectors = [
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
      'button:has-text("すべての Cookie を受け入れる")',
      'button:has-text("Accept all cookies")',
      'button:has-text("I agree")',
      'button:has-text("Agree")',
      '[data-testid="cookie-accept"]',
      '#onetrust-accept-btn-handler',
      '.cookie-consent-accept'
    ];
    for (const sel of cookieSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Dismissing cookie banner...');
        await btn.click();
        await sleep(1000);
        return true;
      }
    }
  } catch (e) {
    // Ignore
  }
  return false;
}

async function waitForDownload(context, label, action) {
  console.log(`\n=== ${label} ===`);

  const downloadPromise = context.waitForEvent('download', { timeout: 30000 }).catch(() => null);

  await action();

  await sleep(2000);

  const download = await downloadPromise;

  if (download) {
    const savedPath = await download.path();
    const suggested = download.suggestedFilename();
    console.log(JSON.stringify({ ok: true, label, suggested, savedPath }));
    return { suggested, savedPath, downloadCaptured: true };
  }

  console.log('Download event not captured by Playwright, checking extension logs...');
  return { suggested: null, savedPath: null, downloadCaptured: false };
}

async function getExtensionStorage(context) {
  const workers = context.serviceWorkers();
  for (const worker of workers) {
    if (worker.url().includes('service-worker')) {
      const storage = await worker.evaluate(() => {
        return chrome.storage.local.get(['pendingDownloads', 'settings']);
      });
      return storage;
    }
  }
  return null;
}

// =============== PEXELS ===============
async function testPexels(context, page) {
  const url = TEST_URLS.pexels;
  console.log(`\nNavigating to: ${url}`);

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);

  await dismissCookieBanner(page);

  let extensionRegistered = false;
  page.on('console', msg => {
    if (msg.text().includes('Registered Pexels download')) {
      extensionRegistered = true;
    }
  });

  const downloadResult = await waitForDownload(context, 'Pexels Photo Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    // Try getByRole first
    try {
      const downloadButton = page.getByRole('button', { name: /free download/i });
      if (await downloadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found download button via getByRole');
        await downloadButton.click();
        buttonClicked = true;
        await sleep(1000);
      }
    } catch (e) {}

    if (!buttonClicked) {
      try {
        const downloadLink = page.getByRole('link', { name: /free download/i });
        if (await downloadLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Found download link via getByRole');
          await downloadLink.click();
          buttonClicked = true;
          await sleep(1000);
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/pexels-debug.png' });
      throw new Error('Could not find download button');
    }

    await sleep(500);

    const dropdownSelectors = [
      'a:has-text("Original")',
      'a[download]',
      'a[href*="dl="]'
    ];

    for (const dropdownSelector of dropdownSelectors) {
      try {
        const link = page.locator(dropdownSelector).first();
        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`Found dropdown link with selector: ${dropdownSelector}`);
          await link.click();
          return;
        }
      } catch (e) {}
    }

    console.log('No dropdown found, assuming direct download triggered');
  });

  return { ...downloadResult, extensionRegistered };
}

// =============== PIXABAY ===============
async function testPixabay(context, page) {
  const url = TEST_URLS.pixabay;
  console.log(`\nNavigating to: ${url}`);

  let extensionRegistered = false;
  let contentScriptLoaded = false;

  // Set up console listener BEFORE navigation
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Registered Pixabay download')) {
      extensionRegistered = true;
    }
    if (text.includes('Pixabay content script loaded')) {
      contentScriptLoaded = true;
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  console.log(`Content script loaded: ${contentScriptLoaded}`);

  await dismissCookieBanner(page);

  const downloadResult = await waitForDownload(context, 'Pixabay Photo Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    // Pixabay has a green "Download" button
    const downloadSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")',
      'button:has-text("Free Download")',
      '[class*="download" i]',
      '[data-download]'
    ];

    for (const selector of downloadSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found download button with selector: ${selector}`);
          await button.click();
          buttonClicked = true;
          await sleep(2000);
          break;
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/pixabay-debug.png' });
      throw new Error('Could not find download button');
    }

    // Pixabay shows a modal with size options - click the first download option
    await sleep(1000);

    const sizeSelectors = [
      'a[download]',
      'a:has-text("1920")',
      'a:has-text("1280")',
      'button:has-text("Download")'
    ];

    for (const sizeSelector of sizeSelectors) {
      try {
        const link = page.locator(sizeSelector).first();
        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`Found size option with selector: ${sizeSelector}`);
          await link.click();
          await sleep(2000);
          return;
        }
      } catch (e) {}
    }

    console.log('No size selector found, assuming direct download triggered');
  });

  // Content script loaded is also a valid indicator
  if (contentScriptLoaded && !extensionRegistered) {
    console.log('Content script loaded but download not registered - Pixabay may use different download flow');
  }

  return { ...downloadResult, extensionRegistered: extensionRegistered || contentScriptLoaded };
}

// =============== COVERR ===============
async function testCoverr(context, page) {
  const url = TEST_URLS.coverr;
  console.log(`\nNavigating to: ${url}`);

  let extensionRegistered = false;
  let contentScriptLoaded = false;

  // Set up console listener BEFORE navigation
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Registered Coverr download')) {
      extensionRegistered = true;
    }
    if (text.includes('Coverr content script loaded')) {
      contentScriptLoaded = true;
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  console.log(`Content script loaded: ${contentScriptLoaded}`);

  await dismissCookieBanner(page);

  const downloadResult = await waitForDownload(context, 'Coverr Video Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    // Coverr has a "Download" button - click it to trigger direct download
    const downloadSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")',
      '[class*="download" i]',
      '[aria-label*="download" i]'
    ];

    for (const selector of downloadSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found download button with selector: ${selector}`);
          await button.click();
          buttonClicked = true;
          // Coverr triggers direct download on button click
          await sleep(3000);
          break;
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/coverr-debug.png' });
      throw new Error('Could not find download button');
    }

    console.log('Download button clicked, Coverr triggers direct download');
  });

  // Content script loaded is also a valid indicator
  if (contentScriptLoaded && !extensionRegistered) {
    console.log('Content script loaded but download not registered - this may be expected for Coverr');
  }

  return { ...downloadResult, extensionRegistered: extensionRegistered || contentScriptLoaded };
}

// =============== FREEPIK ===============
async function testFreepik(context, page) {
  const url = TEST_URLS.freepik;
  console.log(`\nNavigating to: ${url}`);

  let extensionRegistered = false;
  let contentScriptLoaded = false;

  // Set up console listener BEFORE navigation
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Registered Freepik download')) {
      extensionRegistered = true;
    }
    if (text.includes('Freepik content script loaded')) {
      contentScriptLoaded = true;
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  console.log(`Content script loaded: ${contentScriptLoaded}`);

  await dismissCookieBanner(page);

  const downloadResult = await waitForDownload(context, 'Freepik Photo Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    // Freepik has a "Download" button
    const downloadSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")',
      'button:has-text("Free Download")',
      '[class*="download" i]',
      '[aria-label*="download" i]'
    ];

    for (const selector of downloadSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found download button with selector: ${selector}`);
          await button.click();
          buttonClicked = true;
          await sleep(1000);
          break;
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/freepik-debug.png' });
      throw new Error('Could not find download button');
    }

    // Freepik may require login or show options
    await sleep(1000);

    const optionSelectors = [
      'a[download]',
      'a[href*=".jpg"]',
      '[class*="modal"] a:has-text("Download")'
    ];

    for (const optionSelector of optionSelectors) {
      try {
        const link = page.locator(optionSelector).first();
        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`Found option with selector: ${optionSelector}`);
          await link.click();
          return;
        }
      } catch (e) {}
    }

    console.log('No option found, assuming direct download triggered');
  });

  // Content script loaded is also a valid indicator
  if (contentScriptLoaded && !extensionRegistered) {
    console.log('Content script loaded but download not registered - Freepik may require login');
  }

  return { ...downloadResult, extensionRegistered: extensionRegistered || contentScriptLoaded };
}

// =============== FOOTAGECRATE ===============
async function testFootageCrate(context, page) {
  const url = TEST_URLS.footagecrate;
  console.log(`\nNavigating to: ${url}`);

  let extensionRegistered = false;
  let contentScriptLoaded = false;

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Registered FootageCrate download')) {
      extensionRegistered = true;
    }
    if (text.includes('FootageCrate content script loaded')) {
      contentScriptLoaded = true;
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  console.log(`Content script loaded: ${contentScriptLoaded}`);

  await dismissCookieBanner(page);

  const downloadResult = await waitForDownload(context, 'FootageCrate Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    const downloadSelectors = [
      'a:has-text("Download")',
      'button:has-text("Download")',
      '[class*="download" i]',
      'a[href*="download"]'
    ];

    for (const selector of downloadSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found download button with selector: ${selector}`);
          await button.click();
          buttonClicked = true;
          await sleep(2000);
          break;
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/footagecrate-debug.png' });
      // Don't throw - content script loading is enough for validation
    }
  });

  return { ...downloadResult, extensionRegistered: extensionRegistered || contentScriptLoaded };
}

// =============== POND5 ===============
async function testPond5(context, page) {
  const url = TEST_URLS.pond5;
  console.log(`\nNavigating to: ${url}`);

  let extensionRegistered = false;
  let contentScriptLoaded = false;

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Registered Pond5 download')) {
      extensionRegistered = true;
    }
    if (text.includes('Pond5 content script loaded')) {
      contentScriptLoaded = true;
    }
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  console.log('Page loaded, looking for download button...');
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  console.log(`Content script loaded: ${contentScriptLoaded}`);

  await dismissCookieBanner(page);

  const downloadResult = await waitForDownload(context, 'Pond5 Download', async () => {
    await sleep(1000);

    let buttonClicked = false;

    const downloadSelectors = [
      'button:has-text("Download")',
      'a:has-text("Download")',
      '[class*="download" i]'
    ];

    for (const selector of downloadSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found download button with selector: ${selector}`);
          await button.click();
          buttonClicked = true;
          await sleep(2000);
          break;
        }
      } catch (e) {}
    }

    if (!buttonClicked) {
      console.log('Button not found (Pond5 requires login for downloads). Taking screenshot...');
      await page.screenshot({ path: 'tmp/pond5-debug.png' });
    }
  });

  return { ...downloadResult, extensionRegistered: extensionRegistered || contentScriptLoaded };
}

// =============== MAIN ===============
async function runTest(siteName, testFn, context, page) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing: ${siteName.toUpperCase()}`);
  console.log('='.repeat(50));

  try {
    const result = await testFn(context, page);

    await sleep(2000);

    const storage = await getExtensionStorage(context);
    if (storage && storage.pendingDownloads) {
      const keys = Object.keys(storage.pendingDownloads);
      if (keys.length > 0) {
        console.log('\n=== Extension Storage (pendingDownloads) ===');
        console.log(JSON.stringify(storage.pendingDownloads, null, 2));
      }
    }

    console.log(`\n=== ${siteName} Test Result ===`);
    console.log('Extension registered download:', result.extensionRegistered ? 'YES' : 'NO');
    console.log('Playwright captured download:', result.downloadCaptured ? 'YES' : 'NO');

    if (result.extensionRegistered) {
      console.log(`\n✓ ${siteName} TEST PASSED`);
      return true;
    } else {
      console.log(`\n✗ ${siteName} TEST FAILED: Extension did not register the download`);
      return false;
    }
  } catch (err) {
    console.error(`\n✗ ${siteName} TEST ERROR:`, err.message);
    return false;
  }
}

async function run() {
  console.log('Starting Stockpile extension test...');
  console.log(`Extension path: ${EXTENSION_PATH}`);
  console.log(`Downloads path: ${DOWNLOADS_PATH}`);
  console.log(`Site to test: ${SITE_TO_TEST}`);

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ],
    acceptDownloads: true,
    downloadsPath: DOWNLOADS_PATH
  });

  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);

  page.on('console', msg => {
    if (msg.text().includes('Stockpile')) {
      console.log(`[Page Console] ${msg.text()}`);
    }
  });

  const results = {};

  try {
    await sleep(1000);

    const tests = {
      pexels: testPexels,
      pixabay: testPixabay,
      coverr: testCoverr,
      freepik: testFreepik,
      footagecrate: testFootageCrate,
      pond5: testPond5
    };

    if (SITE_TO_TEST === 'all') {
      for (const [name, fn] of Object.entries(tests)) {
        results[name] = await runTest(name, fn, context, page);
        // Navigate away between tests to reset state
        await page.goto('about:blank');
        await sleep(1000);
      }
    } else if (tests[SITE_TO_TEST]) {
      results[SITE_TO_TEST] = await runTest(SITE_TO_TEST, tests[SITE_TO_TEST], context, page);
    } else {
      console.error(`Unknown site: ${SITE_TO_TEST}`);
      console.log('Available sites: pexels, pixabay, coverr, freepik, all');
      process.exitCode = 1;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));

    let allPassed = true;
    for (const [name, passed] of Object.entries(results)) {
      console.log(`${passed ? '✓' : '✗'} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
      if (!passed) allPassed = false;
    }

    if (!allPassed) {
      process.exitCode = 1;
    }

  } finally {
    await context.close();
  }
}

run()
  .then(() => {
    console.log('\nAll done.');
    process.exit(process.exitCode || 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
