// 通过 CDP 接管「手动启动的真实 Chrome」，打开三平台标签页，引导用户登录。
// 与 login.mjs 区别：不通过 Playwright 起浏览器（避免注入自动化标志被 Google 拦截）。
import { chromium } from 'playwright';
import { SITES, isLoggedIn, sleep } from './common.mjs';

const CDP = 'http://127.0.0.1:9222';
const TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 2000;

const browser = await chromium.connectOverCDP(CDP);
const context = browser.contexts()[0] || (await browser.newContext());

const pages = {};
for (const site of SITES) {
  const page = await context.newPage();
  pages[site.name] = page;
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
}

const wd = await pages.chatgpt.evaluate(() => navigator.webdriver).catch(() => '?');
console.log(`navigator.webdriver = ${wd}（应为 false/undefined，true 才会被 Google 拦截）\n`);
console.log('请在真实 Chrome 里依次登录三个标签页：');
console.log('  1. ChatGPT  -> chatgpt.com');
console.log('  2. 豆包     -> doubao.com');
console.log('  3. Gemini   -> gemini.google.com');
console.log('每 2 秒探测一次（[✓]=已登录 [ ]=未登录）……\n');

const started = Date.now();
let last = '';
while (Date.now() - started < TIMEOUT_MS) {
  const states = {};
  for (const site of SITES) {
    states[site.name] = await isLoggedIn(pages[site.name], site.name);
  }
  const line = SITES.map((s) => `${s.name}:${states[s.name] ? '✓' : ' '}`).join('  ');
  if (line !== last) {
    console.log(line);
    last = line;
  }
  if (SITES.every((s) => states[s.name])) {
    console.log('\n三个平台均已登录！Chrome 保持打开，登录态已保存在 .chrome-cdp。');
    process.exit(0);
  }
  await sleep(POLL_MS);
}
console.log('\n已超时。若尚未全部登录，可重新运行本脚本继续。');
process.exit(1);
