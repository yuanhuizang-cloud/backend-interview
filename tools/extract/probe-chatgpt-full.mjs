import { chromium } from 'playwright';
import { PROFILE_DIR } from './common.mjs';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { channel: 'chrome', headless: false, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--enable-automation'], args:['--disable-blink-features=AutomationControlled'] });
const p = await ctx.newPage();
await p.goto('https://chatgpt.com/c/6aa35b09-f6d0-83e9-96fc-3817afb702b3', { waitUntil:'domcontentloaded', timeout:60000 }).catch(()=>{});
await p.waitForTimeout(10000);
const body = await p.locator('main').innerText().catch(()=> p.locator('body').innerText());
console.log(body.slice(0, 1800).replace(/\n{3,}/g,'\n\n'));
await p.close(); await ctx.close();
