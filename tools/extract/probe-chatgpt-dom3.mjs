import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6aa35b09-f6d0-83e9-96fc-3817afb702b3', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(9000);
const info = await p.evaluate(() => {
  // 找所有 class 含 assistant/markdown/prose 的元素（叶子）
  const out = [];
  const seen = new Set();
  for (const e of document.querySelectorAll('[class]')) {
    const c = typeof e.className==='string'?e.className:'';
    if (/assistant|markdown|prose|model|response/i.test(c)) {
      const t = (e.innerText||'').trim();
      if (t && t.length > 30 && t.length < 400 && !e.querySelector('[class*=assistant],[class*=markdown]')) {
        const key = c.split(' ').slice(0,3).join('.');
        if (!seen.has(key)) { seen.add(key); out.push({cls:key, text:t.slice(0,60)}); }
      }
    }
  }
  return out.slice(0,20);
});
for (const r of info) console.log('['+r.cls+'] '+r.text.replace(/\n/g,' '));
await p.close(); await ctx.close();
