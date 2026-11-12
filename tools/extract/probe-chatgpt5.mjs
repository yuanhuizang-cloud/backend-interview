import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(6000);
const result = await p.evaluate(async () => {
  const findToken = () => {
    for (const k of ['oai/apps/accessToken', 'accessToken']) {
      const v = localStorage.getItem(k);
      if (v && v.length > 20) return v;
    }
    try {
      const h = JSON.parse(localStorage.getItem('oai-client-auth-history') || 'null');
      if (Array.isArray(h) && h.length) {
        const t = h[h.length - 1];
        if (t && (t.access_token || t.accessToken || t.token)) return t.access_token || t.accessToken || t.token;
      }
      if (h && typeof h === 'object' && (h.access_token || h.accessToken || h.token)) return h.access_token || h.accessToken || h.token;
    } catch {}
    const m = document.cookie.match(/access_token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    return null;
  };
  const token = findToken();
  if (!token) return { ok: false, err: 'token not found', lsKeys: Object.keys(localStorage), cookieNames: document.cookie.split(';').map(c=>c.trim().split('=')[0]) };
  const r = await fetch('/backend-api/conversations?offset=0&limit=100&order=updated', { headers: { 'Authorization': 'Bearer ' + token } });
  const d = await r.json();
  return { ok: true, status: r.status, total: d.total, titles: (d.items||[]).slice(0,8).map(i=>i.title) };
});
console.log(JSON.stringify(result, null, 2));
await p.close(); await ctx.close();
