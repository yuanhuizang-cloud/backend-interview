import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
const captured = [];
p.on('response', async (resp) => {
  try {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('json') && /conversation|chat|message|session|api/i.test(url)) {
      let body = null; let size = 0;
      try { const t = await resp.text(); body = t; size = t.length; } catch {}
      captured.push({ url: url.slice(0,140), status: resp.status(), size, sample: body ? body.slice(0,200) : null });
    }
  } catch {}
});
await p.goto('https://www.doubao.com/chat/', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(6000);
// 点击第1个真实会话
await p.evaluate(() => {
  const seen=new Set(); let idx=0;
  const walk=(root)=>{ if(!root) return;
    const els=root.querySelectorAll?Array.from(root.querySelectorAll('a')):[];
    for(const el of els){ const c=typeof el.className==='string'?el.className:''; if(c.includes('conversation-item')){ if(idx===1){el.click();return;} idx++; } }
    const all=root.querySelectorAll?Array.from(root.querySelectorAll('*')):[]; for(const el of all) if(el.shadowRoot&&!seen.has(el.shadowRoot)){seen.add(el.shadowRoot);walk(el.shadowRoot);}
  }; walk(document);
});
await p.waitForTimeout(6000);
console.log('捕获到 JSON API 响应数 =', captured.length);
const seen = new Set();
for (const c of captured) {
  if (seen.has(c.url)) continue; seen.add(c.url);
  console.log(`\n[${c.status}] ${c.url}  (${c.size}B)`);
  if (c.sample) console.log('  sample:', c.sample.replace(/\n/g,' ').slice(0,180));
}
await p.close(); await ctx.close();
