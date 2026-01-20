const path = require('path');
const { chromium } = require('playwright');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const DOWNLOADS_PATH = path.resolve(__dirname, '..', 'tmp', 'playwright-downloads');

const TIMEOUT = 300000;

// Test URLs for each site - actual page URLs (not direct download URLs)
const TEST_URLS = {
  pexels: process.env.PEXELS_URL || 'https://www.pexels.com/photo/brown-concrete-building-20727545/'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDownload(context, label, action, page) {
  console.log(`\n=== ${label} ===`);

  // Start listening for download event (with shorter timeout)
  const downloadPromise = context.waitForEvent('download', { timeout: 30000 }).catch(() => null);

  await action();

  // Check if extension registered the download by looking at console messages
  await sleep(2000);

  const download = await downloadPromise;

  if (download) {
    const savedPath = await download.path();
    const suggested = download.suggestedFilename();
    console.log(JSON.stringify({ ok: true, label, suggested, savedPath }));
    return { suggested, savedPath, downloadCaptured: true };
  }

  // Download event not captured, but extension may still have worked
  console.log('Download event not captured by Playwright, checking extension logs...');
  return { suggested: null, savedPath: null, downloadCaptured: false };
}

async function getExtensionStorage(context) {
  // Get the extension's service worker
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

async function testPexels(context, page) {
  const url = TEST_URLS.pexels;
  console.log(`\nNavigating to: ${url}`);

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await sleep(5000); // Wait for content script and page to fully initialize

  console.log('Page loaded, looking for download button...');

  // Debug: log page content
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);

  // Dismiss cookie banner if present
  try {
    const cookieSelectors = [
      'button:has-text("すべての Cookie を受け入れる")',
      'button:has-text("Accept all cookies")',
      'button:has-text("Accept")',
      '[data-testid="cookie-accept"]'
    ];
    for (const sel of cookieSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Dismissing cookie banner...');
        await btn.click();
        await sleep(1000);
        break;
      }
    }
  } catch (e) {
    console.log('No cookie banner or already dismissed');
  }

  // Find and click the free download button on Pexels
  // Pexels has a "Free Download" button that opens a dropdown
  // Track if extension registered the download
  let extensionRegistered = false;
  page.on('console', msg => {
    if (msg.text().includes('Registered Pexels download')) {
      extensionRegistered = true;
    }
  });

  const downloadResult = await waitForDownload(context, 'Pexels Photo Download', async () => {
    // Wait for button to be visible
    await sleep(1000);

    // Close language selector if present
    try {
      const langClose = page.locator('button:near(:text("Choose your language"))').first();
      if (await langClose.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = page.locator('[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeBtn.click();
          await sleep(500);
        }
      }
    } catch (e) {}

    // Use getByRole or getByText for more reliable selection
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

    // Try link with "Free download" text
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

    // Fallback: try CSS selectors
    if (!buttonClicked) {
      const downloadSelectors = [
        'a[class*="DownloadButton"]',
        'button[class*="DownloadButton"]',
        'a[href*="download"]',
        '[data-testid*="download"]'
      ];

      for (const selector of downloadSelectors) {
        try {
          const button = page.locator(selector).first();
          const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            console.log(`Found download button with selector: ${selector}`);
            await button.click();
            buttonClicked = true;
            await sleep(1000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    }

    if (!buttonClicked) {
      // Take screenshot for debugging
      console.log('Button not found. Taking screenshot...');
      await page.screenshot({ path: 'tmp/pexels-debug.png' });

      // Debug: print all buttons and links on page
      const buttons = await page.locator('button, a').allTextContents();
      console.log('Available buttons/links:', buttons.filter(t => t.toLowerCase().includes('download')));

      throw new Error('Could not find download button');
    }

    // Pexels shows a dropdown menu after clicking
    // Look for the actual download link in dropdown
    await sleep(500);

    const dropdownSelectors = [
      'a:has-text("Original")',
      'a:has-text("オリジナル")',
      'a[download]',
      'a[href*="dl="]',
      '[role="menu"] a',
      '[class*="dropdown"] a'
    ];

    for (const dropdownSelector of dropdownSelectors) {
      try {
        const link = page.locator(dropdownSelector).first();
        const isVisible = await link.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          console.log(`Found dropdown link with selector: ${dropdownSelector}`);
          await link.click();
          return;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If no dropdown, the first click might have triggered download directly
    console.log('No dropdown found, assuming direct download triggered');
  });

  // Return result with extension registration status
  return { ...downloadResult, extensionRegistered };
}

async function checkDownloadPath(savedPath, expectedFolder) {
  // Check if the file was saved to the expected Stockpile folder
  const normalizedPath = savedPath.replace(/\\/g, '/');
  const containsExpected = normalizedPath.includes(expectedFolder);
  console.log(`\nPath check:`);
  console.log(`  Saved to: ${savedPath}`);
  console.log(`  Expected folder: ${expectedFolder}`);
  console.log(`  Match: ${containsExpected ? 'YES' : 'NO'}`);
  return containsExpected;
}

async function run() {
  console.log('Starting Stockpile extension test...');
  console.log(`Extension path: ${EXTENSION_PATH}`);
  console.log(`Downloads path: ${DOWNLOADS_PATH}`);

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

  // Listen for console messages from content scripts
  page.on('console', msg => {
    if (msg.text().includes('Stockpile')) {
      console.log(`[Page Console] ${msg.text()}`);
    }
  });

  try {
    // Wait a bit for extension to initialize
    await sleep(1000);

    // Test Pexels
    const result = await testPexels(context, page);

    // Give extension time to process
    await sleep(2000);

    // Check extension storage for recorded download
    const storage = await getExtensionStorage(context);
    if (storage) {
      console.log('\n=== Extension Storage ===');
      console.log(JSON.stringify(storage, null, 2));
    }

    console.log('\n=== Test Complete ===');
    console.log('Extension registered download:', result.extensionRegistered ? 'YES' : 'NO');
    console.log('Playwright captured download:', result.downloadCaptured ? 'YES' : 'NO');
    if (result.suggested) {
      console.log('Download filename:', result.suggested);
    }

    // Test passes if extension registered the download
    if (result.extensionRegistered) {
      console.log('\n✓ TEST PASSED: Extension correctly detected and registered the download');
    } else {
      console.log('\n✗ TEST FAILED: Extension did not register the download');
      process.exitCode = 1;
    }

  } finally {
    await context.close();
  }
}

run()
  .then(() => {
    console.log('\nAll done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
