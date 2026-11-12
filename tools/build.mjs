// 构建：content/**/*.md → data/questions.json → 内嵌进 index.html
// 题目 markdown 格式见 CONTRIBUTING.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DATA = path.join(ROOT, 'data');
const TEMPLATE = path.join(__dirname, 'template.html');
const OUT_HTML = path.join(ROOT, 'index.html');

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      } else if (val.startsWith('"') || val.startsWith("'")) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  }
  return { meta, body: md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '') };
}

function splitQa(body) {
  const qm = body.match(/##\s*题目\s*\n([\s\S]*?)(?=\n##\s*回答|\n##\s*答案|$)/);
  const am = body.match(/##\s*(?:回答|答案)\s*\n([\s\S]*)$/);
  return { question: (qm?.[1] || '').trim(), answer: (am?.[1] || '').trim() };
}

function walkMd(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walkMd(CONTENT);
const questions = [];

for (const f of files) {
  const rel = path.relative(CONTENT, f);
  const parts = rel.split(path.sep);
  const category = parts[0] || '未分类';
  const subcategory = parts.length > 2 ? parts[1] : '';
  const { meta, body } = parseFrontmatter(fs.readFileSync(f, 'utf8'));
  const { question, answer } = splitQa(body);
  if (!question) { console.warn('跳过（无题目）:', rel); continue; }
  questions.push({
    id: meta.id || path.basename(f, '.md'),
    category,
    subcategory,
    type: meta.type || '其他',
    difficulty: meta.difficulty || 'medium',
    tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
    sources: Array.isArray(meta.sources) ? meta.sources : (meta.sources ? [meta.sources] : []),
    date: meta.date || '',
    question,
    answer,
  });
}

questions.sort((a, b) => a.category.localeCompare(b.category, 'zh') || a.id.localeCompare(b.id));

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'questions.json'), JSON.stringify(questions, null, 2), 'utf8');

// 生成 index.html
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
const html = tpl.replace('__QUESTIONS_JSON__', JSON.stringify(questions));
fs.writeFileSync(OUT_HTML, html, 'utf8');

console.log(`构建完成：${questions.length} 道题 → data/questions.json 与 index.html`);
const byCat = {};
for (const q of questions) byCat[q.category] = (byCat[q.category] || 0) + 1;
for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}: ${v}`);
