import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://gemini.google.com/app', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(9000);
// 完整文本（穿透 shadow DOM）
const fullText = await p.evaluate(() => {
  const seen = new Set(); let out = '';
  const walk = (root) => {
    if (!root) return;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
    for (const el of els) {
      if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
    }
  };
  walk(document);
  // 用 innerText 穿透：对顶层 body + shadow root 里的 text 元素
  const collect = (root) => {
    if (!root) return;
    if (root.body && root.body.innerText) out += root.body.innerText + '\n';
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll('*')).forEach(el => { if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); collect(el.shadowRoot); } });
    }
  };
  return document.body ? document.body.innerText : '';
});
console.log('=== Gemini 完整可见文本（前2500字）===');
console.log(fullText.slice(0,2500));
await p.close(); await ctx.close();
