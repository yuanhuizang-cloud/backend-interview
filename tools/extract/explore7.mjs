import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
import fs from 'node:fs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
let batch = null, info = null;
p.on('response', async (resp) => {
  try {
    const url = resp.url();
    if (url.includes('/im/conversation/batch_get') && !batch) { batch = JSON.parse(await resp.text()); }
    if (url.includes('/im/conversation/info') && !info) { info = JSON.parse(await resp.text()); }
  } catch {}
});
await p.goto('https://www.doubao.com/chat/', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(7000);
// 点击第1个真实会话触发 info
await p.evaluate(() => { const s=new Set(); let i=0; const w=(r)=>{ if(!r)return; const els=r.querySelectorAll?Array.from(r.querySelectorAll('a')):[]; for(const e of els){const c=typeof e.className==='string'?e.className:''; if(c.includes('conversation-item')){if(i===1){e.click();return;}i++;}} const all=r.querySelectorAll?Array.from(r.querySelectorAll('*')):[]; for(const e of all) if(e.shadowRoot&&!s.has(e.shadowRoot)){s.add(e.shadowRoot);w(e.shadowRoot);} }; w(document); });
await p.waitForTimeout(5000);

console.log('=== batch_get 结构 ===');
if (batch) {
  const body = batch.downlink_body?.batch_get_conv_info_downlink_body || {};
  const list = body.conversation_info_list || [];
  console.log('会话数 =', list.length);
  console.log('首个会话字段:', Object.keys(list[0]||{}));
  console.log('首个会话样例:', JSON.stringify(list[0], null, 2).slice(0, 800));
}
console.log('\n=== info 结构 ===');
if (info) {
  const body = info.downlink_body?.get_conv_info_downlink_body || {};
  console.log('body 字段:', Object.keys(body));
  const conv = body.conversation_info || {};
  console.log('conversation_info 字段:', Object.keys(conv));
  console.log(JSON.stringify(conv, null, 2).slice(0, 2500));
} else {
  console.log('(未捕获到 info 响应)');
}
await p.close(); await ctx.close();
