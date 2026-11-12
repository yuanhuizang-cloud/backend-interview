import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
let batch = null;
p.on('response', async (resp) => { try { if (resp.url().includes('/im/conversation/batch_get') && !batch) batch = JSON.parse(await resp.text()); } catch {} });
await p.goto('https://www.doubao.com/chat/', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(8000);
const list = batch?.downlink_body?.batch_get_conv_info_downlink_body?.conversation_info_list || [];
console.log('会话数 =', list.length);
// 找一个 messages 非空的会话
for (const c of list) {
  const msgs = c.messages || [];
  console.log(`\n会话 "${c.name}" (${c.conversation_id}) messages 数 = ${msgs.length}`);
  if (msgs.length) {
    console.log('  messages[0] 字段:', Object.keys(msgs[0]));
    console.log('  messages[0] 完整:', JSON.stringify(msgs[0]).slice(0, 1200));
    console.log('  messages[1] 字段:', Object.keys(msgs[1]||{}));
    console.log('  messages[1] 完整:', JSON.stringify(msgs[1]).slice(0, 800));
    break;
  }
}
await p.close(); await ctx.close();
