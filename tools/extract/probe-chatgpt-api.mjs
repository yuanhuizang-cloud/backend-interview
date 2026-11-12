import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
const paths = new Set();
p.on('request', (req) => {
  try { if (req.url().includes('backend-api')) paths.add(new URL(req.url()).pathname); } catch {}
});
await p.goto('https://chatgpt.com/c/6af41778-c50c-83e9-853e-ffea433bf2b1', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(9000);
console.log('backend-api 请求路径（不含参数）:');
[...paths].forEach(x=>console.log('  '+x));
await p.close(); await ctx.close();
