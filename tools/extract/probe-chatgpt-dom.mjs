import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6af41778-c50c-83e9-853e-ffea433bf2b1', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const out = [];
  const sels = ['[data-message-author-role="user"]','[data-message-author-role="assistant"]','.markdown','.whitespace-pre-wrap','[data-message-model-slug]'];
  for (const s of sels) {
    const els = document.querySelectorAll(s);
    out.push({ sel: s, count: els.length, sample: els[0] ? (els[0].innerText||'').trim().slice(0,60) : '' });
  }
  return out;
});
for (const r of info) console.log(JSON.stringify(r));
await p.close(); await ctx.close();
