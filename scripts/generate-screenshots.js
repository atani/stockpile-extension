const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const screenshotsDir = path.join(__dirname, '../screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Sample data for mock
const sampleDownloads = [
  {
    title: 'Cinematic Epic Orchestra',
    category: 'BGM',
    site: 'MotionElements',
    date: '2024-12-31',
    tags: ['cinematic', 'epic', 'orchestra']
  },
  {
    title: 'Urban City Timelapse 4K',
    category: 'Video',
    site: 'MotionElements',
    date: '2024-12-30',
    tags: ['city', 'timelapse', '4k']
  },
  {
    title: 'Whoosh Transition Sound',
    category: 'SE',
    site: 'Audiio',
    date: '2024-12-29',
    tags: ['whoosh', 'transition']
  },
  {
    title: 'Modern Lower Third Pack',
    category: 'Mogrt',
    site: 'MotionElements',
    date: '2024-12-28',
    tags: ['lower third', 'modern', 'premiere']
  },
  {
    title: 'Ambient Piano Melody',
    category: 'BGM',
    site: 'Audiio',
    date: '2024-12-27',
    tags: ['ambient', 'piano', 'calm']
  }
];

// Generate popup HTML with sample data
function generatePopupHTML() {
  const downloadItems = sampleDownloads.map(d => `
    <div class="download-item">
      <div class="download-item-header">
        <span class="download-title">${d.title}</span>
        <span class="download-category">${d.category}</span>
      </div>
      <div class="download-meta">
        <span class="download-site">${d.site}</span>
        <span class="download-date">${d.date}</span>
      </div>
      <div class="download-tags">
        ${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #1a1a1a;
      background: #fff;
      width: 360px;
      min-height: 480px;
    }
    .container { display: flex; flex-direction: column; height: 100%; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      background: #fafafa;
    }
    .header h1 { font-size: 16px; font-weight: 600; color: #333; }
    .icon-btn {
      background: none;
      border: none;
      padding: 6px;
      color: #666;
      border-radius: 4px;
      display: flex;
      align-items: center;
    }
    .toggle-section { padding: 12px 16px; border-bottom: 1px solid #e5e5e5; }
    .toggle { display: flex; align-items: center; gap: 10px; }
    .toggle-slider {
      width: 36px;
      height: 20px;
      background: #4CAF50;
      border-radius: 10px;
      position: relative;
    }
    .toggle-slider::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      top: 2px;
      left: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .toggle-label { font-size: 13px; color: #333; }
    .search-section { padding: 12px 16px; border-bottom: 1px solid #e5e5e5; }
    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
    }
    .filters { display: flex; gap: 8px; margin-top: 8px; }
    .filter-select {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
    }
    .stats {
      padding: 8px 16px;
      font-size: 12px;
      color: #666;
      background: #fafafa;
      border-bottom: 1px solid #e5e5e5;
    }
    .download-list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .download-item {
      padding: 10px 16px;
      border-bottom: 1px solid #f0f0f0;
    }
    .download-item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .download-title { font-weight: 500; font-size: 13px; color: #333; flex: 1; }
    .download-category {
      font-size: 10px;
      padding: 2px 6px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 3px;
    }
    .download-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
      font-size: 11px;
      color: #888;
    }
    .download-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag {
      font-size: 10px;
      padding: 1px 5px;
      background: #f0f0f0;
      color: #666;
      border-radius: 2px;
    }
    .footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: flex-end;
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      background: #e0e0e0;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Stockpile</h1>
      <button class="icon-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </header>
    <div class="toggle-section">
      <label class="toggle">
        <span class="toggle-slider"></span>
        <span class="toggle-label">Auto-organize enabled</span>
      </label>
    </div>
    <div class="search-section">
      <input type="text" placeholder="Search downloads..." class="search-input">
      <div class="filters">
        <select class="filter-select"><option>All Categories</option></select>
        <select class="filter-select"><option>All Sites</option></select>
      </div>
    </div>
    <div class="stats"><span>5</span> downloads</div>
    <div class="download-list">${downloadItems}</div>
    <div class="footer">
      <button class="btn">Export</button>
    </div>
  </div>
</body>
</html>`;
}

// Generate promotional image with browser frame
function generatePromoHTML() {
  const popupHTML = generatePopupHTML();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px;
      height: 800px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .content {
      display: flex;
      align-items: center;
      gap: 80px;
    }
    .text-section {
      color: white;
      max-width: 500px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .logo-icon {
      width: 64px;
      height: 64px;
      background: white;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .logo-icon svg {
      width: 40px;
      height: 40px;
    }
    h1 {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 16px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .tagline {
      font-size: 22px;
      opacity: 0.95;
      line-height: 1.5;
      margin-bottom: 32px;
    }
    .features {
      list-style: none;
      font-size: 16px;
    }
    .features li {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      opacity: 0.9;
    }
    .features li::before {
      content: '✓';
      width: 24px;
      height: 24px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .popup-frame {
      background: white;
      border-radius: 12px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .browser-bar {
      background: #f1f3f4;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .browser-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .browser-dot.red { background: #ff5f57; }
    .browser-dot.yellow { background: #ffbd2e; }
    .browser-dot.green { background: #28ca42; }
    .popup-content {
      width: 360px;
    }
  </style>
</head>
<body>
  <div class="content">
    <div class="text-section">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 128 128" fill="none">
            <rect x="24" y="70" width="80" height="36" rx="4" fill="#c7d2fe"/>
            <rect x="24" y="50" width="80" height="36" rx="4" fill="#a5b4fc"/>
            <path d="M28 30 h28 l6 8 h38 a4 4 0 0 1 4 4 v28 a4 4 0 0 1 -4 4 h-72 a4 4 0 0 1 -4 -4 v-36 a4 4 0 0 1 4 -4z" fill="#6366f1"/>
            <path d="M64 44 v16 M56 54 l8 8 l8 -8" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1>Stockpile</h1>
      </div>
      <p class="tagline">Automatically organize your downloads from stock sites into neat folders</p>
      <ul class="features">
        <li>Auto-sort by site &amp; category</li>
        <li>Supports MotionElements &amp; Audiio</li>
        <li>Search &amp; export download history</li>
        <li>Extract metadata from pages</li>
      </ul>
    </div>
    <div class="popup-frame">
      <div class="browser-bar">
        <div class="browser-dot red"></div>
        <div class="browser-dot yellow"></div>
        <div class="browser-dot green"></div>
      </div>
      <div class="popup-content">
        <iframe srcdoc='${popupHTML.replace(/'/g, "&#39;").replace(/\n/g, "")}' width="360" height="480" frameborder="0"></iframe>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Folder structure visualization
function generateFolderScreenshot() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px;
      height: 800px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .content {
      display: flex;
      align-items: center;
      gap: 80px;
    }
    .text-section {
      color: white;
      max-width: 450px;
    }
    h2 {
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 20px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .desc {
      font-size: 20px;
      opacity: 0.95;
      line-height: 1.6;
    }
    .folder-window {
      background: white;
      border-radius: 12px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.3);
      overflow: hidden;
      width: 500px;
    }
    .window-bar {
      background: #f1f3f4;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #ff5f57; }
    .dot.yellow { background: #ffbd2e; }
    .dot.green { background: #28ca42; }
    .folder-content {
      padding: 20px;
      font-size: 14px;
      color: #333;
    }
    .folder-tree {
      font-family: 'SF Mono', Monaco, monospace;
      line-height: 1.8;
    }
    .folder { color: #1976d2; font-weight: 500; }
    .file { color: #666; }
    .indent { margin-left: 24px; }
    .icon { margin-right: 8px; }
  </style>
</head>
<body>
  <div class="content">
    <div class="text-section">
      <h2>Organized Automatically</h2>
      <p class="desc">Downloads are automatically sorted into folders by site and category. No manual organization needed.</p>
    </div>
    <div class="folder-window">
      <div class="window-bar">
        <div class="dot red"></div>
        <div class="dot yellow"></div>
        <div class="dot green"></div>
      </div>
      <div class="folder-content">
        <div class="folder-tree">
          <div class="folder"><span class="icon">📁</span>Downloads</div>
          <div class="indent folder"><span class="icon">📁</span>Stockpile</div>
          <div class="indent indent folder"><span class="icon">📁</span>MotionElements</div>
          <div class="indent indent indent folder"><span class="icon">📁</span>Video</div>
          <div class="indent indent indent indent file"><span class="icon">🎬</span>urban_city_timelapse_4k.mp4</div>
          <div class="indent indent indent folder"><span class="icon">📁</span>BGM</div>
          <div class="indent indent indent indent file"><span class="icon">🎵</span>cinematic_epic_orchestra.mp3</div>
          <div class="indent indent indent folder"><span class="icon">📁</span>Mogrt</div>
          <div class="indent indent indent indent file"><span class="icon">📦</span>modern_lower_third_pack.mogrt</div>
          <div class="indent indent folder"><span class="icon">📁</span>Audiio</div>
          <div class="indent indent indent folder"><span class="icon">📁</span>BGM</div>
          <div class="indent indent indent indent file"><span class="icon">🎵</span>ambient_piano_melody.mp3</div>
          <div class="indent indent indent folder"><span class="icon">📁</span>SE</div>
          <div class="indent indent indent indent file"><span class="icon">🔊</span>whoosh_transition.wav</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    // Screenshot 1: Main promotional image
    console.log('Generating screenshot 1: Promotional...');
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 800 });
    await page1.setContent(generatePromoHTML());
    await page1.waitForSelector('.popup-frame');
    await new Promise(r => setTimeout(r, 500)); // Wait for iframe
    await page1.screenshot({
      path: path.join(screenshotsDir, 'screenshot-1-promo.png'),
      type: 'png'
    });
    await page1.close();

    // Screenshot 2: Folder structure
    console.log('Generating screenshot 2: Folder structure...');
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1280, height: 800 });
    await page2.setContent(generateFolderScreenshot());
    await page2.screenshot({
      path: path.join(screenshotsDir, 'screenshot-2-folders.png'),
      type: 'png'
    });
    await page2.close();

    console.log('Screenshots generated successfully!');
    console.log(`Output: ${screenshotsDir}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
