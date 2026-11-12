import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });

// 递归穿透 shadow DOM 收集元素
async function deepCollect(page, fn) {
  return page.evaluate((fnSrc) => {
    const f = new Function('return ' + fnSrc)();
    const results = [];
    const seen = new Set();
    const walk = (root) => {
      if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
      try {
        if (root.querySelectorAll) {
          const r = f(root);
          if (r && r.length) results.push(...r);
        }
      } catch {}
      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const el of all) {
        if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
      }
    };
    walk(document);
    return results;
  }, fn.toString());
}

// 收集：class 含 conversation/chat/session/history 的元素 -> tag.class 前2个class + 文本
const collectFn = (root) => {
  const out = [];
  root.querySelectorAll('[class]').forEach(e => {
    const c = typeof e.className === 'string' ? e.className : '';
    if (/conversation|chat|session|history|message|user|assistant|query|response/i.test(c)) {
      const t = (e.innerText || e.textContent || '').trim();
      if (t && t.length > 0 && t.length < 60) {
        out.push({ tag: e.tagName.toLowerCase(), cls: c.split(' ').slice(0,3).join('.'), text: t });
      }
    }
  });
  return out.slice(0, 80);
};

// Doubao
let p = await ctx.newPage();
await p.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(5000);
console.log('===== 豆包：class含conversation/chat/... 的元素 =====');
for (const r of await deepCollect(p, collectFn)) console.log(`[${r.tag}.${r.cls}] ${r.text.replace(/\n/g,' ')}`);
await p.close();

// Gemini
p = await ctx.newPage();
await p.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(6000);
console.log('\n===== Gemini：class含conversation/chat/... 的元素 =====');
for (const r of await deepCollect(p, collectFn)) console.log(`[${r.tag}.${r.cls}] ${r.text.replace(/\n/g,' ')}`);
await p.close();
await ctx.close();
