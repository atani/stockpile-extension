const path = require('path');
const assert = require('assert');
const puppeteer = require('puppeteer');

const EXTENSION_DIR = path.resolve(__dirname, '..');
const EXTENSION_NAME = 'Stockpile';

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
    await new Promise(r => setTimeout(r, 200));
  }

  await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('extensions-manager', { timeout: 10000 });

  const extensions = await page.evaluate(async () => {
    const manager = document.querySelector('extensions-manager');
    if (!manager) return [];

    const hydrateShadow = (host) => new Promise(resolve => {
      if (host.shadowRoot) return resolve();
      const observer = new MutationObserver(() => {
        if (host.shadowRoot) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(host, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 3000);
    });

    await hydrateShadow(manager);
    const itemList = manager.shadowRoot?.querySelector('extensions-item-list');
    if (!itemList) return [];
    await hydrateShadow(itemList);

    const items = itemList.shadowRoot?.querySelectorAll('extensions-item') || [];
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
  if (match) return match.id;
  if (extensions.length > 0) return extensions[0].id;

  throw new Error('No extensions found in chrome://extensions or targets');
}

async function run() {
  const isHeadless = process.env.HEADLESS !== 'false';
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage'
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
