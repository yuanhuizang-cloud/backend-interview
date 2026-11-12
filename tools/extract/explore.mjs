import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });

async function explore(name, url, sidebarHints, contentHints) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
  await p.waitForTimeout(5000);
  console.log(`\n########## ${name} ##########`);
  console.log('URL:', p.url());
  // 侧边栏：收集所有疑似会话条目的文本
  const items = await p.evaluate((hints) => {
    const set = new Set();
    const walk = (root) => {
      const els = root.querySelectorAll(hints);
      els.forEach(e => {
        const t = (e.innerText || '').trim();
        if (t && t.length > 1 && t.length < 80) set.add(t);
      });
    };
    walk(document.body);
    return [...set].slice(0, 40);
  }, sidebarHints);
  console.log('疑似侧边栏会话条目（前40）:');
  items.forEach(t => console.log('  ·', t.replace(/\n/g,' ')));
  // 点击第一个条目
  const clicked = await p.evaluate((hints) => {
    const els = document.querySelectorAll(hints);
    for (const e of els) {
      if (e.innerText && e.innerText.trim().length > 1) { e.click(); return (e.innerText||'').trim().slice(0,50); }
    }
    return null;
  }, sidebarHints);
  console.log('点击了:', clicked);
  await p.waitForTimeout(4000);
  // 主内容区文本
  const mainText = await p.locator('body').innerText().catch(()=> '');
  console.log('主内容正文(前1500字):');
  console.log(mainText.slice(0, 1500).replace(/\n{3,}/g,'\n\n'));
  await p.close();
}

await explore('豆包 doubao', 'https://www.doubao.com/chat/', '[class*="conversation"],[class*="chat"],[class*="session"],[class*="history"]');
await explore('Gemini', 'https://gemini.google.com/app', '[class*="conversation"],[class*="chat"],[class*="history"],[data-test-id*="conversation"]');
await ctx.close();
