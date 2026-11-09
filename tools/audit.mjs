/**
 * Educational static diagnostics for Express.js core files.
 * Analysis intentionally uses explicit rules: M = 1 + if/loops/case/catch/?:/&&/||/??
 * The results are approximations, NOT SonarQube or ESLint output.
 * Run `npm install` in this directory, then `node tools/audit.mjs ../express/lib`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const root = path.resolve(process.argv[2] || '../express/lib');
const destination = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../results');
const allowed = ['application.js','express.js','request.js','response.js','utils.js','view.js'];
if (!fs.existsSync(root)) {
  console.error(`Не знайдено код Express.js: ${root}. Спочатку виконайте git clone https://github.com/expressjs/express.git`);
  process.exit(2);
}
fs.mkdirSync(destination, { recursive: true });
const rows = [], functions = [], depends = {}, duplicates = [];
const selectors = new Set(['IfStatement','ForStatement','ForInStatement','ForOfStatement','WhileStatement','DoWhileStatement','CatchClause','ConditionalExpression']);
function complexity(node) {
  let m = 1;
  const f = node.body && node.body.type === 'BlockStatement' ? node.body : node.body || node;
  // Skip nested function bodies, which have their own complexity.
  function scan(n) {
    if (!n || typeof n !== 'object') return;
    if (n !== node && /FunctionExpression|FunctionDeclaration|ArrowFunctionExpression/.test(n.type || '')) return;
    if (selectors.has(n.type)) m++;
    if (n.type === 'SwitchCase' && n.test !== null) m++;
    if (n.type === 'LogicalExpression' && ['&&','||','??'].includes(n.operator)) m++;
    for (const [k,v] of Object.entries(n)) {
      if (['start','end','loc','range'].includes(k)) continue;
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === 'object') scan(v);
    }
  }
  scan(f);
  return m;
}
function label(node, src) {
  if (node.id?.name) return node.id.name;
  const prefix = src.slice(Math.max(0,node.start - 160),node.start);
  const m = prefix.match(/(?:\b(?:app|req|res|exports|View\.prototype)\.([\w]+)|\b([\w]+))\s*=\s*$/);
  return m ? m[1] || m[2] : '(anonymous)';
}
const buckets = new Map();
for (const filename of allowed) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) { console.error(`Відсутній обов'язковий файл ${filename}`); process.exit(3); }
  const source = fs.readFileSync(full,'utf8');
  const ast = acorn.parse(source, {ecmaVersion:'latest', sourceType:'script', locations:true, allowHashBang:true});
  const lines = source.split(/\r?\n/);
  const deps = [...new Set([...source.matchAll(/require\(['"]([^'"\n]+)['"]\)/g)].map(x=>x[1]))].sort();
  depends[filename] = deps;
  const entries = [];
  walk.full(ast,(n)=>{
    if (!['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)) return;
    const item = {file:filename, function:label(n,source), line:n.loc.start.line, end_line:n.loc.end.line, loc:n.loc.end.line-n.loc.start.line+1, cc:complexity(n)};
    item.risk = item.cc > 20 ? 'високий' : item.cc > 10 ? 'помірний' : 'низький';
    entries.push(item);
    functions.push(item);
  });
  const chunks = [];
  for (let i=0;i<=lines.length-6;i++) {
    const normalized=lines.slice(i,i+6).map(s=>s.trim()).filter(s=>s && !s.startsWith('*') && !s.startsWith('//')).join(' ');
    if (normalized.length>=100) chunks.push({key:normalized, file:filename, line:i+1});
  }
  buckets.set(filename,chunks);
  rows.push({file:filename, physical_lines:lines.length, nonempty_lines:lines.filter(s=>s.trim()).length, functions:entries.length, max_cc:Math.max(0,...entries.map(x=>x.cc)), over10:entries.filter(x=>x.cc>10).length, direct_dependencies:deps.length});
}
const hashes=new Map();
for (const entries of buckets.values()) for (const chunk of entries) {
  const a=hashes.get(chunk.key)||[];
  a.push({file:chunk.file,line:chunk.line});hashes.set(chunk.key,a);
}
for (const locations of hashes.values()) if (locations.length>1 && new Set(locations.map(v=>v.file)).size>1) duplicates.push(locations);
functions.sort((a,b)=>b.cc-a.cc || a.file.localeCompare(b.file) || a.line-b.line);
const incoming = Object.fromEntries(allowed.map(x=>[x,0]));
for (const deps of Object.values(depends)) for (const d of deps) {
  const target = `${d.replace(/^\.\//,'')}.js`;
  if (target in incoming) incoming[target]++;
}
for (const r of rows) r.incoming_local_dependencies = incoming[r.file];
const data={project:'expressjs/express', scope:allowed, analyzed_at:new Date().toISOString(), root, assumptions:'Підрахунок AST з навчальним правилом 1 + вузли рішень; вкладені функції аналізуються окремо. Дублікати: точні міжфайлові збіги фрагментів довжиною 6 рядків, а не промисловий CPD.', files:rows, methods: functions, dependencies: depends, exact_duplicate_windows_cross_file:duplicates, totals:{files:rows.length,lines:rows.reduce((a,b)=>a+b.physical_lines,0),methods:functions.length, over10:functions.filter(x=>x.cc>10).length, over20:functions.filter(x=>x.cc>20).length}};
fs.writeFileSync(path.join(destination,'metrics.json'),JSON.stringify(data,null,2));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const max=Math.max(1,...rows.map(r=>r.over10));
const cells=rows.map(r=>`<tr><td>${esc(r.file)}</td><td>${r.physical_lines}</td><td>${r.functions}</td><td>${r.max_cc}</td><td style="background:hsl(${120-120*r.over10/max} 75% 82%)">${r.over10}</td><td>${r.direct_dependencies}</td></tr>`).join('');
const ms=functions.slice(0,25).map(x=>`<tr><td>${esc(x.file)}</td><td>${esc(x.function)}</td><td>${x.line}</td><td>${x.cc}</td><td>${esc(x.risk)}</td></tr>`).join('');
const html=`<!doctype html><html lang="uk"><meta charset="utf-8"><title>Express.js — аналіз кодової бази</title><style>body{font:15px Arial,sans-serif;margin:40px auto;max-width:1000px;color:#1d2939}table{border-collapse:collapse;width:100%;margin:14px 0 28px}th,td{border:1px solid #d0d5dd;padding:8px;text-align:left}th{background:#e8eff7}h1,h2{color:#163c68}small{color:#667085}</style><h1>Діагностика кодової бази Express.js</h1><p>Дата: ${esc(data.analyzed_at)} | Охоплення: ${data.totals.files} файлів, ${data.totals.lines} фізичних рядків, ${data.totals.methods} функцій.</p><h2>Файли та теплова карта ризику</h2><p>Колір відображає кількість функцій із CC &gt; 10, а не кількість помилок ESLint.</p><table><thead><tr><th>Файл</th><th>Рядки</th><th>Функції</th><th>Макс. CC</th><th>CC &gt; 10</th><th>Залежності</th></tr></thead><tbody>${cells}</tbody></table><h2>25 найскладніших функцій</h2><table><thead><tr><th>Файл</th><th>Функція</th><th>Рядок</th><th>CC</th><th>Ризик</th></tr></thead><tbody>${ms}</tbody></table><h2>Методика</h2><p>${esc(data.assumptions)}</p><small>Повні результати та залежності — metrics.json. Порушення ESLint рахуються окремо.</small></html>`;
fs.writeFileSync(path.join(destination,'metrics.html'),html);
const escapeCsv=s=>'"'+String(s).replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(destination,'top_methods.csv'),['file,function,line,end_line,loc,cc,risk',...functions.map(x=>[x.file,x.function,x.line,x.end_line,x.loc,x.cc,x.risk].map(escapeCsv).join(','))].join('\n'));
console.log(`Збережено results/metrics.json, metrics.html, top_methods.csv. Файли: ${rows.length}; рядки: ${data.totals.lines}; методи: ${functions.length}.`);
