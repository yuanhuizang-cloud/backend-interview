import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
const reqs = [];
p.on('request', (r) => {
  const u = r.url();
  if (/Bard|assistant|lamda|generativelanguage|googleapis|conversation|BardChatUi|history/i.test(u) && !/\.(png|jpg|gif|css|woff|js)/i.test(u)) {
    reqs.push(r.method() + ' ' + u.slice(0,150));
  }
});
await p.goto('https://gemini.google.com/app', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(8000);
console.log('=== Gemini 加载时疑似 API 请求 ===');
[...new Set(reqs)].slice(0,50).forEach(x=>console.log(x));
reqs.length = 0;
const clicked = await p.evaluate(() => {
  const set = new Set();
  const walk = (root) => {
    if (!root) return;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
    for (const el of els) {
      const c = (typeof el.className === 'string' ? el.className : '') + ' ' + ((el.getAttribute && el.getAttribute('role'))||'');
      if (/conversation|history|chat/i.test(c)) {
        const t = (el.innerText||'').trim();
        if (t.length > 3 && t.length < 60 && !/发起新对话|需要我为你做些什么|Gemini|search|yuanhui|需要我为你|下载应用|升级到|Google AI/.test(t)) { el.click(); return t.slice(0,40); }
      }
      if (el.shadowRoot && !set.has(el.shadowRoot)) { set.add(el.shadowRoot); walk(el.shadowRoot); }
    }
  };
  walk(document);
  return null;
});
console.log('点击了会话:', clicked);
await p.waitForTimeout(6000);
console.log('\n=== 点击后疑似 API 请求 ===');
[...new Set(reqs)].slice(0,50).forEach(x=>console.log(x));
await p.close(); await ctx.close();
