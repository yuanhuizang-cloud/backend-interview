import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });

// ChatGPT
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(3000);
const me = await p.evaluate(async () => { try { const r = await fetch('/backend-api/me'); return r.ok ? await r.json() : null; } catch { return null; } });
console.log('=== ChatGPT /me ===');
console.log(JSON.stringify({ email: me?.email, name: me?.name, id: me?.id }));
const conv = await p.evaluate(async () => { try { const r = await fetch('/backend-api/conversations?offset=0&limit=5&order=updated'); return r.ok ? await r.json() : null; } catch { return null; } });
console.log('conversations total =', conv?.total, ' items =', (conv?.items||[]).length);
await p.close();

// Doubao / Gemini 快速状态
for (const [name, url] of [['doubao','https://www.doubao.com/chat/'], ['gemini','https://gemini.google.com/app']]) {
  const pg = await ctx.newPage();
  await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
  await pg.waitForTimeout(3000);
  const body = await pg.locator('body').innerText().catch(()=> '');
  console.log(`=== ${name} === url=${pg.url()} 含登录=${/登录/.test(body)} 含新对话=${/新对话|近期对话|新聊天/.test(body)}`);
  await pg.close();
}
await ctx.close();
