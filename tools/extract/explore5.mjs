import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(6000);

// 用递归穿透 shadow DOM 收集会话条目
const titles = await p.evaluate(() => {
  const out = []; const seen = new Set();
  const walk = (root) => {
    if (!root) return;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('a')) : [];
    for (const el of els) {
      const c = typeof el.className === 'string' ? el.className : '';
      if (c.includes('conversation-item')) {
        const t = (el.innerText || '').trim();
        if (t) out.push(t);
      }
      if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
    }
    const all = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
    for (const el of all) if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
  };
  walk(document);
  return out;
});
console.log('会话标题数 =', titles.length);
titles.forEach((t,i)=>console.log(`  [${i}] ${t}`));

// 点击第 2 个（真实会话），用穿透方式点击
const clicked = await p.evaluate(() => {
  const seen = new Set();
  let found = null; let idx = 0;
  const walk = (root) => {
    if (!root || found) return;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('a')) : [];
    for (const el of els) {
      const c = typeof el.className === 'string' ? el.className : '';
      if (c.includes('conversation-item')) { if (idx === 1) { found = el; el.click(); return; } idx++; }
    }
    if (!found) {
      const all = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
      for (const el of all) if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
    }
  };
  walk(document);
  return found ? (found.innerText||'').trim().slice(0,40) : null;
});
console.log('已点击:', clicked);
await p.waitForTimeout(5000);

// 消息区结构
const msgs = await p.evaluate(() => {
  const out = []; const seen = new Set();
  const walk = (root) => {
    if (!root) return;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
    for (const el of els) {
      const c = typeof el.className === 'string' ? el.className : '';
      if (/message|user|assistant|content|bubble|question|answer|chat|conversation|markdown/i.test(c)) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 300 && !el.querySelector('div,p')) {
          out.push({tag:el.tagName.toLowerCase(), cls:c.split(' ').slice(0,4).join('.'), text:t.slice(0,45)});
        }
      }
      if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
    }
  };
  walk(document);
  return out.slice(0,60);
});
for (const r of msgs) console.log(`[${r.tag}.${r.cls}] ${r.text.replace(/\n/g,' ')}`);
await p.close(); await ctx.close();
