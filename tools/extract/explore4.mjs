import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
// 轮询等待会话列表出现
let items = p.locator('a.conversation-item');
for (let i=0;i<15;i++){ await p.waitForTimeout(2000); if ((await items.count())>0) break; }
const n = await items.count();
console.log('URL:', p.url());
console.log('会话条目数 =', n);
for (let i=0;i<Math.min(n,15);i++) console.log(`  [${i}]`, (await items.nth(i).innerText()).replace(/\n/g,' '));
if (n>0) {
  await items.nth(1).click();
  await p.waitForTimeout(5000);
  // 找消息容器：class 含 message/chat 的滚动容器，或直接 dump 文本块
  const info = await p.evaluate(() => {
    const out=[];
    const all = document.querySelectorAll('*');
    for (const e of all) {
      const cls = typeof e.className === 'string' ? e.className : '';
      if (/message|chat-scroll|chat-content|conversation-content|assistant|user-bubble|question/i.test(cls)) {
        const t=(e.innerText||'').trim();
        out.push({tag:e.tagName.toLowerCase(), cls: cls.split(' ').slice(0,4).join('.'), text:t.slice(0,50)});
      }
    }
    return out.slice(0,40);
  });
  for (const r of info) console.log(`[${r.tag}.${r.cls}] ${r.text.replace(/\n/g,' ')}`);
}
await p.close();
await ctx.close();
