const path = require('path');
const assert = require('assert');
const puppeteer = require('puppeteer');

const EXTENSION_DIR = path.resolve(__dirname, '..');
const EXTENSION_NAME = 'Stockpile';

async function getExtensionId(page) {
  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('extensions-manager', { timeout: 10000 });

  const extensions = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager');
    if (!manager || !manager.shadowRoot) return [];
    const itemList = manager.shadowRoot.querySelector('extensions-item-list');
    if (!itemList || !itemList.shadowRoot) return [];
    const items = itemList.shadowRoot.querySelectorAll('extensions-item');
    const results = [];

    items.forEach((item) => {
      const shadow = item.shadowRoot;
      const nameEl = shadow?.querySelector('#name');
      const idEl = shadow?.querySelector('#id');
      const name = nameEl?.textContent?.trim() || '';
      const id = idEl?.textContent?.trim() || item.getAttribute('id') || '';
      if (name && id) {
        results.push({ name, id });
      }
    });

    return results;
  });

  const match = extensions.find(ext => ext.name.includes(EXTENSION_NAME));
  if (!match) {
    throw new Error(`Extension "${EXTENSION_NAME}" not found in chrome://extensions`);
  }
  return match.id;
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();
    const extensionId = await getExtensionId(page);
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;

    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 10000 });
    const title = await page.$eval('h1', el => el.textContent?.trim());

    assert.ok(title && title.includes(EXTENSION_NAME), `Popup title mismatch: ${title}`);
    await page.waitForSelector('#enableToggle', { timeout: 10000 });
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[E2E] Failed:', error);
  process.exit(1);
});
