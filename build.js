const fs = require('fs');
const tpl = fs.readFileSync('template.html', 'utf8');
const engine = fs.readFileSync('sql_engine.js', 'utf8');
const ui = fs.readFileSync('ui_logic.js', 'utf8');

for (const [name, code] of [['engine', engine], ['ui', ui]]) {
  if (/<\/script/i.test(code)) throw new Error(name + ' 含有 </script，会破坏 HTML 结构');
}

let out = tpl.replace('/*ENGINE_PLACEHOLDER*/', () => engine);
out = out.replace('/*UI_PLACEHOLDER*/', () => ui);

if (out.includes('ENGINE_PLACEHOLDER') || out.includes('UI_PLACEHOLDER')) {
  throw new Error('占位符未被替换，构建失败');
}

fs.writeFileSync('index.html', out, 'utf8');
fs.writeFileSync('sql_finance_workbench.html', out, 'utf8');

const checks = {
  'CASE WHEN': out.includes('parseCase'),
  '子查询': out.includes('scalar_subquery'),
  '窗口函数': out.includes('computeWindow'),
  'Excel 导入': out.includes('parseXlsxBuffer'),
  '导入入口': out.includes('importDataBtn'),
};
let ok = true;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? 'OK  ' : 'MISS') + ' ' + k);
  if (!v) ok = false;
}
const ext = out.match(/https?:\/\/[^"'\s)]+/g) || [];
console.log('外部链接数:', ext.length, ext.length ? ext.slice(0, 3).join(' | ') : '(无外链)');
console.log('构建完成：' + (out.length / 1024).toFixed(1) + 'KB');
if (!ok) process.exit(1);
