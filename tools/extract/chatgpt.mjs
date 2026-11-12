// ChatGPT 抓取：列表用响应拦截（backend-api/conversations），详情用 DOM 提取
// 用户消息 group/user-message，AI 回答 group/app-widget
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PROFILE_DIR, RAW_DIR, sleep } from './common.mjs';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 900 },
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await ctx.newPage();

const listItems = new Map();
let listTotal = 0;
page.on('response', async (resp) => {
  try {
    if (resp.url().includes('backend-api/conversations?')) {
      const d = JSON.parse(await resp.text());
      if (d.total) listTotal = d.total;
      for (const it of d.items || []) if (it.id) listItems.set(it.id, it);
    }
  } catch {}
});

await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await sleep(6000);
await page.evaluate(async () => {
  const scrollers = [];
  for (const el of Array.from(document.querySelectorAll('*'))) if (el.scrollHeight > el.clientHeight + 50) scrollers.push(el);
  const target = scrollers.find((el) => { const r = el.getBoundingClientRect(); return r.width > 150 && r.width < 420 && r.left < 100; }) || scrollers[0];
  if (!target) return;
  for (let i = 0; i < 30; i++) { target.scrollTop = target.scrollHeight; await new Promise((r) => setTimeout(r, 450)); }
});
await sleep(3000);

console.log(`会话列表：total=${listTotal}，已捕获 ${listItems.size} 个`);
const ids = [...listItems.keys()];

async function extractMessages() {
  return page.evaluate(() => {
    const container = document.querySelector('[class*="thread-scroll-layout"]') || document.querySelector('main') || document.body;
    const fullText = (container.innerText || '').trim();
    // 尽力分离用户消息（去重）
    const users = [];
    for (const e of document.querySelectorAll('[class*="group/user-message"]')) {
      const t = ((e.querySelector('.whitespace-pre-wrap') || e).innerText || '').trim();
      if (t && !users.includes(t)) users.push(t);
    }
    return { fullText, userCount: users.length };
  });
}

const result = [];
for (let i = 0; i < ids.length; i++) {
  await page.goto(`https://chatgpt.com/c/${ids[i]}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await sleep(3500);
  const { fullText, userCount } = await extractMessages();
  const meta = listItems.get(ids[i]);
  result.push({ id: ids[i], title: meta?.title || '', create_time: meta?.create_time || null, full_text: fullText, user_count: userCount });
  if ((i + 1) % 20 === 0 || i === ids.length - 1) console.log(`  ${i + 1}/${ids.length}`);
}

fs.mkdirSync(path.join(RAW_DIR, 'chatgpt'), { recursive: true });
fs.writeFileSync(path.join(RAW_DIR, 'chatgpt', 'all.json'), JSON.stringify(result, null, 2), 'utf8');
const total = result.reduce((s, c) => s + c.full_text.length, 0);
const empty = result.filter((c) => !c.full_text.trim()).length;
console.log(`\n完成：${result.length} 会话，总字符 ${total}（${empty} 个无内容）→ data/raw/chatgpt/all.json`);
await ctx.close();
