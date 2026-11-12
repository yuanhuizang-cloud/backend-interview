import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6aa35b09-f6d0-83e9-96fc-3817afb702b3', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(10000);
const info = await p.evaluate(() => {
  // 找所有 .whitespace-pre-wrap 的祖先 group 类
  const groups = new Set();
  document.querySelectorAll('.whitespace-pre-wrap').forEach(e => {
    let cur = e;
    for (let i=0;i<10 && cur;i++) {
      const c = typeof cur.className==='string'?cur.className:'';
      const m = c.match(/group\/[a-zA-Z-]+/g);
      if (m) m.forEach(x=>groups.add(x));
      cur = cur.parentElement;
    }
  });
  return { wpCount: document.querySelectorAll('.whitespace-pre-wrap').length, groups: [...groups] };
});
console.log(JSON.stringify(info, null, 2));
await p.close(); await ctx.close();
