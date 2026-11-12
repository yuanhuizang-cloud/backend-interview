import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
let infoReq = null, infoResp = null;
p.on('request', (req) => { if (req.url().includes('/im/conversation/info') && !infoReq) infoReq = { method: req.method(), url: req.url(), post: req.postData() }; });
p.on('response', async (resp) => { try { if (resp.url().includes('/im/conversation/info') && !infoResp) infoResp = JSON.parse(await resp.text()); } catch {} });
await p.goto('https://www.doubao.com/chat/', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(7000);
await p.evaluate(() => { const s=new Set(); let i=0; const w=(r)=>{ if(!r)return; const els=r.querySelectorAll?Array.from(r.querySelectorAll('a')):[]; for(const e of els){const c=typeof e.className==='string'?e.className:''; if(c.includes('conversation-item')){if(i===1){e.click();return;}i++;}} const all=r.querySelectorAll?Array.from(r.querySelectorAll('*')):[]; for(const e of all) if(e.shadowRoot&&!s.has(e.shadowRoot)){s.add(e.shadowRoot);w(e.shadowRoot);} }; w(document); });
await p.waitForTimeout(5000);
console.log('=== info 请求 ===');
if (infoReq) console.log('method:', infoReq.method, '\nurl:', infoReq.url, '\npost:', infoReq.post);
console.log('\n=== info 响应 ===');
if (infoResp) {
  const conv = infoResp.downlink_body?.get_conv_info_downlink_body?.conversation_info;
  console.log('conversation.name:', conv?.name);
  const msgs = conv?.messages || [];
  console.log('messages 数:', msgs.length);
  for (let i=0;i<Math.min(3,msgs.length);i++) {
    const m = msgs[i];
    let text='';
    try { const blocks=JSON.parse(m.content); text = blocks.map(b=>b?.content?.text_block?.text||'').filter(Boolean).join('|'); } catch {}
    console.log(`  [${i}] user_type=${m.user_type} content_type=${m.content_type} text=${text.slice(0,80)}`);
  }
} else console.log('(未捕获到 info 响应)');
await p.close(); await ctx.close();
