// 解析 ChatGPT 官方导出的 zip（Settings → Data controls → Export data → 下载）
// 用法：node tools/extract/parse-export.mjs <zip路径>
// 支持 conversations.json（含 mapping）→ 输出 data/raw/chatgpt/all.json
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { RAW_DIR } from './common.mjs';

const zipPath = process.argv[2];
if (!zipPath || !fs.existsSync(zipPath)) {
  console.error('请传入 zip 文件路径：node tools/extract/parse-export.mjs <zip路径>');
  process.exit(1);
}

const OUT_DIR = path.join(RAW_DIR, 'chatgpt');
const tmpDir = path.join(OUT_DIR, '.unzip');
fs.mkdirSync(tmpDir, { recursive: true });
console.log('解压中……');
execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`);

// 找 conversations.json（可能在根目录或子目录）
function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; }
    else if (e.name === name) return p;
  }
  return null;
}

const convFile = findFile(tmpDir, 'conversations.json');
if (!convFile) {
  console.error('未找到 conversations.json，导出包里文件列表：');
  const list = (d) => fs.readdirSync(d).forEach((e) => console.log('  ', e));
  list(tmpDir);
  process.exit(1);
}

console.log('找到 conversations.json:', convFile);
const data = JSON.parse(fs.readFileSync(convFile, 'utf8'));
const conversations = Array.isArray(data) ? data : (data.conversations || data.items || []);

function extractMessages(conv) {
  const mapping = conv.mapping || {};
  const msgs = [];
  for (const nodeId of Object.keys(mapping)) {
    const msg = mapping[nodeId]?.message;
    if (!msg) continue;
    const role = msg.author?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const content = msg.content;
    let text = '';
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content?.parts)) text = content.parts.filter((p) => typeof p === 'string').join('\n');
    else if (content?.content_type === 'text') text = (content.parts || []).filter((p) => typeof p === 'string').join('\n');
    text = (text || '').trim();
    if (!text) continue;
    msgs.push({ role, text, create_time: msg.create_time || null });
  }
  msgs.sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
  const dedup = [];
  for (const m of msgs) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.role === m.role && prev.text === m.text) continue;
    dedup.push(m);
  }
  return dedup;
}

const result = conversations.map((c) => ({
  id: c.id || c.conversation_id || '',
  title: c.title || '',
  create_time: c.create_time || null,
  messages: extractMessages(c),
}));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'all.json'), JSON.stringify(result, null, 2), 'utf8');
const total = result.reduce((s, c) => s + c.messages.length, 0);
console.log(`\n完成：${result.length} 个会话，${total} 条消息 → data/raw/chatgpt/all.json`);
fs.rmSync(tmpDir, { recursive: true, force: true });
