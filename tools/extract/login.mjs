// 登录引导：打开持久化 profile 的可见浏览器，三平台各开一个标签页，
// 用户依次登录后，脚本自动探测到登录态并关闭浏览器（profile 已保存到磁盘）。
import { chromium } from 'playwright';
import { PROFILE_DIR, SITES, isLoggedIn, sleep } from './common.mjs';

const TIMEOUT_MS = 8 * 60 * 1000; // 8 分钟，避免用户被催促
const POLL_MS = 2000;

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 900 },
  // 去自动化标志，避免 Google OAuth 报「此浏览器或应用可能不安全」
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});

const pages = {};
for (const site of SITES) {
  const page = await ctx.newPage();
  pages[site.name] = page;
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
}

const wd = await pages.chatgpt.evaluate(() => navigator.webdriver).catch(() => '?');
console.log(`navigator.webdriver = ${wd}（应为 false，true 才会被 Google 拦截）\n`);

console.log('浏览器已打开三个标签页，请依次登录：');
console.log('  1. ChatGPT  -> chatgpt.com');
console.log('  2. 豆包     -> doubao.com');
console.log('  3. Gemini   -> gemini.google.com');
console.log('登录进度每 2 秒刷新一次（[✓]=已登录 [ ]=未登录）……\n');

const started = Date.now();
let last = '';
while (Date.now() - started < TIMEOUT_MS) {
  const states = {};
  for (const site of SITES) {
    states[site.name] = await isLoggedIn(pages[site.name], site.name);
  }
  const line = SITES.map(
    (s) => `${s.name}:${states[s.name] ? '✓' : ' '}`
  ).join('  ');
  if (line !== last) {
    console.log(line);
    last = line;
  }
  if (SITES.every((s) => states[s.name])) {
    console.log('\n三个平台均已登录，浏览器即将关闭（登录态已保存）。');
    await sleep(1000);
    await ctx.close();
    process.exit(0);
  }
  await sleep(POLL_MS);
}

console.log('\n已超时。若尚未全部登录，可重新运行 `npm run login` 继续。');
await ctx.close();
process.exit(1);
