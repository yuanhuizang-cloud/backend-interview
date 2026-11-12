import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://gemini.google.com/app', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(8000);
// 点击技术会话
await p.locator('conversations-list gem-nav-list-item').filter({ hasText: '有序数组绝对值最小首个下标二分查找' }).first().click();
await p.waitForTimeout(6000);
const info = await p.evaluate(() => {
  const out = [];
  const all = Array.from(document.querySelectorAll('*'));
  for (const e of all) {
    const cls = typeof e.className==='string'?e.className:'';
    if (/response|model|markdown|message-content|rich-text|answer/i.test(cls)) {
      const t=(e.innerText||'').trim();
      if (t && t.length > 20 && t.length < 5000) {
        // 只保留疑似叶子（没有同 class 的子元素）
        out.push({tag:e.tagName.toLowerCase(), cls:cls.split(' ').slice(0,4).join('.'), len:t.length, text:t.slice(0,70)});
      }
    }
  }
  return out.slice(0,30);
});
for (const r of info) console.log(`[${r.tag}.${r.cls}] len=${r.len} ${r.text.replace(/\n/g,' ')}`);
await p.close(); await ctx.close();
