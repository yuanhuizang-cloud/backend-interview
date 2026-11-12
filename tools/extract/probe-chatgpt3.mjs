import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(5000);
// 列出 localStorage 的 key（不打印值，只找 token 相关 key）
const keys = await p.evaluate(() => Object.keys(localStorage));
console.log('localStorage keys:', JSON.stringify(keys));
// 尝试常见的 token key
const tok = await p.evaluate(() => {
  const candidates = ['oai/apps/accessToken','accessToken','oai/apps/hasSeenOnboarding','__Secure-next-auth.session-token'];
  for (const k of candidates) { const v = localStorage.getItem(k); if (v && v.length > 20) return { k, len: v.length, head: v.slice(0,20) }; }
  return null;
});
console.log('候选 token:', JSON.stringify(tok));
// 带 Authorization 头调 conversations
const conv = await p.evaluate(async () => {
  const t = localStorage.getItem('oai/apps/accessToken') || localStorage.getItem('accessToken');
  if (!t) return { err: 'no token in localStorage' };
  const r = await fetch('/backend-api/conversations?offset=0&limit=5&order=updated', { headers: { 'Authorization': 'Bearer ' + t } });
  return { status: r.status, body: (await r.text()).slice(0,300) };
});
console.log('带 Authorization 的 conversations 结果:', JSON.stringify(conv).slice(0,500));
await p.close(); await ctx.close();
