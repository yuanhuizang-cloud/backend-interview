// 抓取脚本公共工具：路径解析、登录态探测（按平台精确判断）
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const PROFILE_DIR = path.join(ROOT, '.browser-profile');
export const RAW_DIR = path.join(ROOT, 'data', 'raw');

export const SITES = [
  { name: 'chatgpt', url: 'https://chatgpt.com/' },
  { name: 'doubao', url: 'https://www.doubao.com/chat/' },
  { name: 'gemini', url: 'https://gemini.google.com/app' },
];

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

// 是否「已登录」（尽量避免游客态误判）
export async function isLoggedIn(page, site) {
  try {
    if (site === 'chatgpt') {
      // 真实账号有 email；游客/未登录返回空
      const j = await page.evaluate(async () => {
        try {
          const r = await fetch('/backend-api/me');
          return r.ok ? await r.json() : null;
        } catch {
          return null;
        }
      });
      return !!(j && j.email);
    }
    if (site === 'gemini') {
      const url = page.url();
      if (url.includes('accounts.google.com')) return false;
      if (!url.includes('gemini.google.com')) return false;
      return !/sign in/i.test(await bodyText(page));
    }
    // doubao：有输入框，且正文里没有「登录/注册」按钮文案
    const hasComposer =
      (await page.locator('textarea, [contenteditable="true"]').count()) > 0;
    if (!hasComposer) return false;
    return !/登录|注册/.test(await bodyText(page));
  } catch {
    return false;
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
