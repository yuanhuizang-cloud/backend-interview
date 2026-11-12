import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(5000);

// 点击第2个真实会话（跳过“主对话”）
const items = p.locator('a.conversation-item');
const n = await items.count();
console.log('会话条目数 =', n);
const target = items.nth(1);
console.log('点击会话:', await target.innerText());
await target.click();
await p.waitForTimeout(4000);

// 消息区：收集所有含文本的块级元素，输出 tag + 前3class + 前40字
const info = await p.evaluate(() => {
  const out = [];
  const main = document.querySelector('main') || document.body;
  const els = main.querySelectorAll('div, p, span');
  for (const e of els) {
    const cls = typeof e.className === 'string' ? e.className.split(' ').slice(0,3).join('.') : '';
    const t = (e.innerText || '').trim();
    // 只取“叶子”文本块：自身文本短于 200 且没有太深的嵌套文本重复
    if (!t || t.length > 200) continue;
    if (e.querySelector('div, p')) continue; // 跳过容器
    out.push({ tag: e.tagName.toLowerCase(), cls, text: t.slice(0,40) });
  }
  return out.slice(0, 60);
});
for (const r of info) console.log(`[${r.tag}.${r.cls}] ${r.text.replace(/\n/g,' ')}`);
await p.close();
await ctx.close();
