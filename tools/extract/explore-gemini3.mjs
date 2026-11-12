import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: true, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://gemini.google.com/app', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(9000);

// 找到标题元素并打印其标签/类/祖先链
const info = await p.evaluate(() => {
  const title = '有序数组绝对值最小首个下标二分查找';
  const all = Array.from(document.querySelectorAll('*'));
  const hit = all.find(e => (e.innerText||'').trim() === title && (e.innerText||'').trim().length === title.length);
  if (!hit) return { err: '未找到标题元素' };
  const chain = [];
  let cur = hit;
  for (let i=0;i<6 && cur;i++) {
    chain.push({ tag: cur.tagName.toLowerCase(), cls: (typeof cur.className==='string'?cur.className:'').split(' ').slice(0,4).join('.'), role: cur.getAttribute?.('role') });
    cur = cur.parentElement;
  }
  // 也列出该元素子树里的文本叶子
  return { tag: hit.tagName.toLowerCase(), cls: (typeof hit.className==='string'?hit.className:'').split(' ').slice(0,5).join('.'), chain };
});
console.log('标题元素:', JSON.stringify(info, null, 2));

// 点击该会话并等消息加载
await p.getByText('有序数组绝对值最小首个下标二分查找', { exact: false }).first().click().catch(e=>console.log('click err', e.message));
await p.waitForTimeout(6000);

// 消息元素：找 user query 和 model response 的文本
const msgs = await p.evaluate(() => {
  const out = [];
  const all = Array.from(document.querySelectorAll('*'));
  for (const e of all) {
    const cls = typeof e.className==='string'?e.className:'';
    if (/user-query|model-response|message-text|response-text|query-text/i.test(cls)) {
      const t=(e.innerText||'').trim();
      if (t && t.length<400) out.push({tag:e.tagName.toLowerCase(), cls:cls.split(' ').slice(0,4).join('.'), text:t.slice(0,60)});
    }
  }
  return out.slice(0,30);
});
console.log('\n=== 消息元素（user-query/model-response/message-text）===');
for (const m of msgs) console.log(`[${m.tag}.${m.cls}] ${m.text.replace(/\n/g,' ')}`);
await p.close(); await ctx.close();
