// 豆包抓取：捕获 batch_get（会话列表）+ chain/single（消息历史）
// 输出 data/raw/doubao/all.json
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

const chains = new Map(); // conversation_id -> { messages: [], has_more }
let batch = null;
page.on('response', async (resp) => {
  try {
    const url = resp.url();
    if (url.includes('/im/chain/single')) {
      const j = JSON.parse(await resp.text());
      const pull = j?.downlink_body?.pull_singe_chain_downlink_body;
      if (pull?.messages?.length) {
        const cid = pull.messages[0].conversation_id;
        const prev = chains.get(cid) || { messages: [], has_more: false };
        prev.messages = prev.messages.concat(pull.messages);
        prev.has_more = pull.has_more;
        chains.set(cid, prev);
      }
    } else if (url.includes('/im/conversation/batch_get') && !batch) {
      batch = JSON.parse(await resp.text());
    }
  } catch {}
});

await page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
for (let i = 0; i < 12; i++) { await sleep(1000); if (batch) break; }

const list = batch?.downlink_body?.batch_get_conv_info_downlink_body?.conversation_info_list || [];
console.log(`会话列表数 = ${list.length}`);

async function clickNth(idx) {
  return page.evaluate((idx) => {
    const seen = new Set(); let i = 0; let found = null;
    const walk = (root) => {
      if (!root || found) return;
      const els = root.querySelectorAll ? Array.from(root.querySelectorAll('a')) : [];
      for (const el of els) {
        const c = typeof el.className === 'string' ? el.className : '';
        if (c.includes('conversation-item')) { if (i === idx) { found = el; el.click(); return; } i++; }
      }
      if (!found) {
        const all = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const el of all) if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
      }
    };
    walk(document);
    return found ? (found.innerText || '').trim().slice(0, 40) : null;
  }, idx);
}

for (let i = 0; i < list.length; i++) {
  const t = await clickNth(i);
  await sleep(3000);
  console.log(`  [${i}] ${t}`);
}

function msgText(m) {
  const parts = [];
  const pushBlocks = (blocks) => {
    if (!Array.isArray(blocks)) return;
    for (const b of blocks) {
      const tb = b?.content?.text_block?.text;
      if (tb) parts.push(tb);
    }
  };
  if (Array.isArray(m.content_block)) pushBlocks(m.content_block);
  else if (typeof m.content === 'string') {
    try { pushBlocks(JSON.parse(m.content)); } catch {
      if (m.content.trim() && !m.content.trim().startsWith('[')) parts.push(m.content);
    }
  }
  return parts.join('\n').trim();
}

const result = [];
for (const c of list) {
  const chain = chains.get(c.conversation_id);
  const messages = (chain?.messages || c.messages || [])
    .map((m) => ({ role: m.user_type === 1 ? 'user' : 'assistant', text: msgText(m), create_time: m.create_time }))
    .filter((m) => m.text);
  result.push({
    id: c.conversation_id,
    title: c.name || '',
    create_time: c.create_time,
    has_more: chain?.has_more ?? null,
    messages,
  });
}

fs.mkdirSync(path.join(RAW_DIR, 'doubao'), { recursive: true });
fs.writeFileSync(path.join(RAW_DIR, 'doubao', 'all.json'), JSON.stringify(result, null, 2), 'utf8');

const totalMsgs = result.reduce((s, c) => s + c.messages.length, 0);
console.log(`\n完成：${result.length} 个会话，${totalMsgs} 条消息 → data/raw/doubao/all.json`);
for (const c of result) console.log(`  "${c.title}" 消息=${c.messages.length} has_more=${c.has_more}`);
const sample = result.find((c) => c.messages.length >= 2);
if (sample) {
  console.log(`\n样例「${sample.title}」前 2 条:`);
  for (const m of sample.messages.slice(0, 2)) console.log(`  [${m.role}] ${m.text.slice(0, 100).replace(/\n/g, ' ')}`);
}
await ctx.close();
