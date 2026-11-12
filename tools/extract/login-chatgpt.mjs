// 只引导登录 ChatGPT（复用已登录的豆包/Gemini profile）
import { chromium } from 'playwright';
import { PROFILE_DIR, sleep } from './common.mjs';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 900 },
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await ctx.newPage();
await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

console.log('浏览器已打开 chatgpt.com，请登录（用桌面 app 同一个账号）。\n');

const started = Date.now();
while (Date.now() - started < 10 * 60 * 1000) {
  const j = await page.evaluate(async () => {
    try { const r = await fetch('/backend-api/me'); return r.ok ? await r.json() : null; } catch { return null; }
  });
  const email = j?.email || '';
  const ok = !!email;
  process.stdout.write(`\rChatGPT 登录状态：${ok ? '✓ 已登录 (' + email + ')' : '… 等待登录'}`);
  if (ok) {
    console.log('\n\n已登录！浏览器即将关闭，登录态已保存。');
    await sleep(1000);
    await ctx.close();
    process.exit(0);
  }
  await sleep(2000);
}
console.log('\n超时，未检测到登录。');
await ctx.close();
process.exit(1);
