// 补抓 ChatGPT 中「无法加载」/空内容的会话（更长等待 + 重试 + 点击“再试一次”）
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PROFILE_DIR, RAW_DIR, sleep } from './common.mjs';

const FILE = path.join(RAW_DIR, 'chatgpt', 'all.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

async function extract() {
  return page.evaluate(() => {
    const container = document.querySelector('[class*="thread-scroll-layout"]') || document.querySelector('main') || document.body;
    const fullText = (container.innerText || '').trim();
    const users = [];
    for (const e of document.querySelectorAll('[class*="group/user-message"]')) {
      const t = ((e.querySelector('.whitespace-pre-wrap') || e).innerText || '').trim();
      if (t && !users.includes(t)) users.push(t);
    }
    return { fullText, userCount: users.length };
  });
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 900 },
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await ctx.newPage();

const targets = data.filter((c) => !c.full_text.trim() || c.full_text.includes('无法加载'));
console.log(`待补抓 ${targets.length} 个会话`);

let done = 0;
for (const c of targets) {
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    await page.goto(`https://chatgpt.com/c/${c.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await sleep(8000);
    const { fullText, userCount } = await extract();
    if (fullText && !fullText.includes('无法加载')) {
      c.full_text = fullText;
      c.user_count = userCount;
      ok = true;
    } else {
      // 尝试点“再试一次”
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button, a')].find((b) => /再试一次|Try again|重新加载/i.test(b.innerText || ''));
        if (btn) btn.click();
      }).catch(() => {});
      await sleep(4000);
    }
  }
  done++;
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8'); // 每个都落盘，防中断丢失
  if (done % 10 === 0 || done === targets.length) console.log(`  ${done}/${targets.length}`);
}

const stillFailed = data.filter((c) => !c.full_text.trim() || c.full_text.includes('无法加载')).length;
console.log(`\n完成：仍失败 ${stillFailed} 个`);
await ctx.close();
