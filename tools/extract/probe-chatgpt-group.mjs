import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6af41778-c50c-83e9-853e-ffea433bf2b1', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  const out = [];
  const seen = new Set();
  for (const e of document.querySelectorAll('[class*="group/"]')) {
    const c = typeof e.className==='string'?e.className:'';
    const m = c.match(/group\/[a-zA-Z-]+/);
    if (m) {
      const k = m[0];
      if (!seen.has(k)) { seen.add(k); 
        const txt = (e.innerText||'').trim();
        out.push({ group: k, tag: e.tagName.toLowerCase(), len: txt.length, sample: txt.slice(0,50) });
      }
    }
  }
  return out;
});
for (const r of info) console.log(JSON.stringify(r));
await p.close(); await ctx.close();
