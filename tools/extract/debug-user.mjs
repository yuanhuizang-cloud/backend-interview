import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6aa35b09-f6d0-83e9-96fc-3817afb702b3', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(10000);
const info = await p.evaluate(() => {
  const um = document.querySelectorAll('[class*="group/user-message"]');
  const aw = document.querySelectorAll('[class*="group/app-widget"]');
  const umTexts = [];
  um.forEach(e => {
    const t = ((e.querySelector('.whitespace-pre-wrap') || e).innerText || '').trim();
    umTexts.push(t.slice(0,50));
  });
  return { umCount: um.length, awCount: aw.length, umTexts };
});
console.log(JSON.stringify(info, null, 2));
await p.close(); await ctx.close();
