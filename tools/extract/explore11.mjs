import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
const reqs = [];
p.on('request', (req) => { const u = req.url(); if (u.includes('/im/') || u.includes('/conversation')) reqs.push({ m: req.method(), u: u.slice(0,110), post: (req.postData()||'').slice(0,160) }); });
await p.goto('https://www.doubao.com/chat/', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(7000);
console.log('--- 初始加载的 /im/ 请求 ---');
reqs.forEach(r=>console.log(`[${r.m}] ${r.u}`));
reqs.length = 0;
// 点击第 5 个会话（豆包skill上传与开源问题，很可能含面试/开源内容）
await p.evaluate(() => { const s=new Set(); let i=0; const w=(r)=>{ if(!r)return; const els=r.querySelectorAll?Array.from(r.querySelectorAll('a')):[]; for(const e of els){const c=typeof e.className==='string'?e.className:''; if(c.includes('conversation-item')){if(i===5){e.click();return;}i++;}} const all=r.querySelectorAll?Array.from(r.querySelectorAll('*')):[]; for(const e of all) if(e.shadowRoot&&!s.has(e.shadowRoot)){s.add(e.shadowRoot);w(e.shadowRoot);} }; w(document); });
await p.waitForTimeout(5000);
console.log('--- 点击后的 /im/ 请求 ---');
reqs.forEach(r=>console.log(`[${r.m}] ${r.u}  ${r.post?'POST='+r.post:''}`));
await p.close(); await ctx.close();
