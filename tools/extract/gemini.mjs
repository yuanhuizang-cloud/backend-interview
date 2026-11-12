// Gemini 抓取：DOM 方式。会话条目 conversations-list > gem-nav-list-item，
// 消息 div.query-text（用户）/ span.message-text（AI）
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PROFILE_DIR, RAW_DIR, sleep } from './common.mjs';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: true,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await ctx.newPage();
await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(8000);

// 滚动侧边栏加载全部会话
await page.evaluate(async () => {
  const scrollables = [];
  const collect = (root) => {
    if (!root) return;
    if (root.querySelectorAll) {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.scrollHeight > el.clientHeight + 50) scrollables.push(el);
        if (el.shadowRoot) collect(el.shadowRoot);
      }
    }
  };
  collect(document);
  const target = scrollables.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 100 && r.width < 450 && r.left < 100;
  }) || scrollables[0];
  if (!target) return;
  for (let i = 0; i < 40; i++) {
    target.scrollTop = target.scrollHeight;
    await new Promise((r) => setTimeout(r, 400));
  }
});

const items = page.locator('conversations-list gem-nav-list-item');
const n = await items.count();
console.log(`会话数 = ${n}`);

async function clickByTitle(title) {
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const t = (await items.nth(i).innerText()).trim();
    if (t === title) {
      await items.nth(i).click();
      return true;
    }
  }
  return false;
}

async function extractMessages() {
  return page.evaluate(() => {
    const container =
      document.querySelector('infinite-scroller.chat-history') ||
      document.querySelector('chat-window-content') ||
      document.body;
    const msgs = [];
    const last = () => msgs[msgs.length - 1];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      const cls = typeof el.className === 'string' ? el.className : '';
      const tag = el.tagName;
      // 用户：p.query-text-line（叶子，干净文本）
      if (tag === 'P' && /(^|\s)query-text-line(\s|$)/.test(cls)) {
        const t = (el.innerText || '').trim();
        if (!t) continue;
        const l = last();
        if (l && l.role === 'user' && !l.text.includes(t)) l.text += '\n' + t;
        else if (!l || l.role !== 'user') msgs.push({ role: 'user', text: t });
      }
      // AI：div.markdown（回答正文），跳过嵌套
      else if (tag === 'DIV' && /(^|\s)markdown(\s|$)/.test(cls) && !el.querySelector('.markdown')) {
        const t = (el.innerText || '').trim();
        if (t && t.length > 10) {
          const l = last();
          if (l && l.role === 'assistant' && l.text === t) continue;
          msgs.push({ role: 'assistant', text: t });
        }
      }
    }
    return msgs;
  });
}

const result = [];
for (let i = 0; i < n; i++) {
  const title = (await items.nth(i).innerText()).trim();
  if (!title) continue;
  await items.nth(i).click();
  await sleep(4000);
  const messages = await extractMessages();
  result.push({ title, messages });
  console.log(`  [${i}] ${title.slice(0, 34)} — ${messages.length} 条消息`);
}

fs.mkdirSync(path.join(RAW_DIR, 'gemini'), { recursive: true });
fs.writeFileSync(path.join(RAW_DIR, 'gemini', 'all.json'), JSON.stringify(result, null, 2), 'utf8');
const total = result.reduce((s, c) => s + c.messages.length, 0);
console.log(`\n完成：${result.length} 会话，${total} 条消息 → data/raw/gemini/all.json`);
await ctx.close();
