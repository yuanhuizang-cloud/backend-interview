import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6aa35b09-f6d0-83e9-96fc-3817afb702b3', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(10000);
const turns = await p.evaluate(() => {
  const turns = [];
  const all = document.querySelectorAll('[class*="group/user-message"], [class*="group/app-widget"]');
  for (const el of all) {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (cls.includes('group/user-message')) {
      if (el.querySelector('[class*="group/user-message"]')) continue;
      const t = ((el.querySelector('.whitespace-pre-wrap') || el).innerText || '').trim();
      if (t) { const l=turns[turns.length-1]; if (l&&l.role==='user') l.text+='\n'+t; else turns.push({role:'user',text:t}); }
    } else if (cls.includes('group/app-widget')) {
      if (el.querySelector('[class*="group/app-widget"]')) continue;
      const t = (el.innerText||'').trim();
      if (t && t.length>10) { const l=turns[turns.length-1]; if (l&&l.role==='assistant'&&l.text===t) continue; turns.push({role:'assistant',text:t}); }
    }
  }
  return turns;
});
console.log('总 turn 数:', turns.length);
for (let i=0;i<Math.min(turns.length,8);i++) console.log(`[${i} ${turns[i].role}] ${turns[i].text.slice(0,60).replace(/\n/g,' ')}`);
await p.close(); await ctx.close();
