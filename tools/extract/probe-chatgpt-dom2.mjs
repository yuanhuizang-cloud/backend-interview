import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6af41778-c50c-83e9-853e-ffea433bf2b1', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const out = [];
  const els = document.querySelectorAll('.whitespace-pre-wrap');
  for (const e of els) {
    // 向上找 role 标记
    let cur = e; let role = '?'; let clsChain = [];
    for (let i=0;i<8 && cur;i++) {
      const a = cur.getAttribute && cur.getAttribute('data-message-author-role');
      if (a) { role = a; break; }
      const c = typeof cur.className==='string' ? cur.className.split(' ')[0] : '';
      if (c) clsChain.push(c);
      cur = cur.parentElement;
    }
    out.push({ role, clsChain: clsChain.slice(0,5), text: (e.innerText||'').trim().slice(0,50) });
  }
  // 也搜所有含 author-role 的元素
  const roles = {};
  document.querySelectorAll('[data-message-author-role]').forEach(e=>roles[e.getAttribute('data-message-author-role')]=(roles[e.getAttribute('data-message-author-role')]||0)+1);
  return { items: out, roleCounts: roles };
});
console.log('role 属性计数:', JSON.stringify(info.roleCounts));
for (const r of info.items) console.log(JSON.stringify(r));
await p.close(); await ctx.close();
