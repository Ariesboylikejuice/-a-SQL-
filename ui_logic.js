/* ============================================================
 * SQL 财务分析练习台 —— 界面与交互逻辑（浏览器端）
 * 依赖：sql_engine.js 暴露的 buildDB() / runSQL()
 * ============================================================ */
(function () {
  'use strict';

  const LS_DB = 'wb_sqlfin_db_v1';
  const LS_Q = 'wb_sqlfin_queries_v1';
  const MAX_ROWS = 800; // 结果渲染上限

  let DB = null;

  /* ---------- 持久化 ---------- */
  function loadDB() {
    try {
      const s = localStorage.getItem(LS_DB);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  }
  function saveDB() {
    try { localStorage.setItem(LS_DB, JSON.stringify(DB)); } catch (e) {}
  }
  function resetDB() {
    DB = buildDB();
    saveDB();
    renderTableList();
    showTable(currentTable || 'vouchers');
    toast('已重置为初始虚拟财务数据');
  }

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtNum(v) {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (isNaN(n)) return esc(v);
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }
  function isMoneyCol(h) {
    return /amount|budget|val|revenue|expense|total|actual|ar|amt|tot|收入|费用|余额|合计|预算/i.test(h);
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- 今日练习任务（置顶） ---------- */
  const TASKS = [
    { title: '浏览全部凭证', desc: '查看凭证明细表前 20 条，认识数据结构', sql: 'SELECT * FROM vouchers LIMIT 20;' },
    { title: '各部门销售费用合计', desc: 'JOIN + 聚合函数实战', sql: "SELECT d.dept_name AS 部门, SUM(v.amount) AS 销售费用 FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id WHERE v.acc_code = '6601' GROUP BY d.dept_name ORDER BY 销售费用 DESC;" },
    { title: '月度收入趋势', desc: '用 YEAR / MONTH 做时间分组', sql: "SELECT YEAR(date) AS 年, MONTH(date) AS 月, SUM(amount) AS 收入 FROM vouchers WHERE acc_code = '6001' AND direction = '贷' GROUP BY YEAR(date), MONTH(date) ORDER BY 年, 月;" },
    { title: '销售费用预算', desc: '预算表与部门表关联', sql: "SELECT d.dept_name AS 部门, b.month AS 月份, SUM(b.budget_amount) AS 预算费用 FROM budgets b JOIN departments d ON b.dept_id = d.dept_id WHERE b.acc_code = '6601' GROUP BY d.dept_name, b.month ORDER BY d.dept_name, b.month LIMIT 10;" },
    { title: '应收账款客户排行', desc: 'JOIN 客户表做账龄分析', sql: "SELECT c.cust_name AS 客户, SUM(v.amount) AS 应收余额 FROM vouchers v JOIN customers c ON v.cust_id = c.cust_id WHERE v.acc_code = '1122' AND v.direction = '借' GROUP BY c.cust_name ORDER BY 应收余额 DESC;" },
  ];

  function renderTasks() {
    const box = $('#taskList');
    box.innerHTML = '';
    TASKS.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML =
        `<div class="task-no">练习 ${i + 1}</div>` +
        `<div class="task-title">${esc(t.title)}</div>` +
        `<div class="task-desc">${esc(t.desc)}</div>` +
        `<button class="btn btn-run" data-i="${i}">载入并运行</button>`;
      box.appendChild(card);
    });
    $all('.btn-run', box).forEach((b) => {
      b.addEventListener('click', () => loadTask(TASKS[+b.dataset.i].sql));
    });
  }
  function loadTask(sql) {
    $('#sqlInput').value = sql;
    switchTab('sandbox');
    runSQLcmd();
  }

  /* ---------- 数据浏览 ---------- */
  let currentTable = 'vouchers';
  const RELATIONS = {
    vouchers: '凭证表：dept_id→departments，acc_code→accounts，cust_id→customers',
    budgets: '预算表：dept_id→departments，acc_code→accounts',
    departments: '部门表：被 vouchers / budgets 引用（dept_id）',
    accounts: '会计科目表：被 vouchers / budgets 引用（acc_code）',
    customers: '客户表：被 vouchers 引用（cust_id，可为空）',
  };

  function renderTableList() {
    const box = $('#tableList');
    box.innerHTML = '';
    Object.keys(DB).forEach((name) => {
      const b = document.createElement('button');
      b.className = 'chip' + (name === currentTable ? ' active' : '');
      b.textContent = name + ' (' + DB[name].rows.length + ')';
      b.addEventListener('click', () => showTable(name));
      box.appendChild(b);
    });
  }

  function typeOf(v) {
    if (v == null) return 'NULL';
    if (typeof v === 'number') return '数值';
    return '文本';
  }

  function showTable(name) {
    currentTable = name;
    renderTableList();
    const t = DB[name];
    const cols = t.cols;
    // schema
    const schema = $('#schema');
    schema.innerHTML = '<div class="schema-title">表结构（' + cols.length + ' 列）</div>' +
      '<div class="schema-grid">' + cols.map((c) => {
        const sample = t.rows.length ? typeOf(t.rows[0][c]) : '—';
        return `<div class="schema-col"><span class="sc-name">${esc(c)}</span><span class="sc-type">${sample}</span></div>`;
      }).join('') + '</div>' +
      (RELATIONS[name] ? `<div class="rel-note"><svg class="ico-sm"><use href="#ic-link"></use></svg>${esc(RELATIONS[name])}</div>` : '');
    // preview
    const prev = $('#preview');
    const rows = t.rows.slice(0, 100);
    let html = '<table class="data-table"><thead><tr>' + cols.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach((r) => {
      html += '<tr>' + cols.map((c) => `<td class="${isMoneyCol(c) ? 'money' : ''} ${c === 'direction' ? 'dir-' + r[c] : ''}">${fmtCell(r[c])}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    prev.innerHTML = html + (t.rows.length > 100 ? `<div class="more-note">仅显示前 100 行，共 ${t.rows.length} 行</div>` : '');
  }
  function fmtCell(v) {
    if (v == null) return '<span class="nullv">NULL</span>';
    if (typeof v === 'number') return fmtNum(v);
    return esc(v);
  }

  /* ---------- SQL 沙盒 ---------- */
  const EXAMPLES = [
    { label: '示例：各部门费用合计', sql: "SELECT d.dept_name AS 部门, SUM(v.amount) AS 费用合计 FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id WHERE v.acc_code = '6601' GROUP BY d.dept_name ORDER BY 费用合计 DESC;" },
    { label: '示例：月度收入趋势', sql: "SELECT YEAR(date) AS 年, MONTH(date) AS 月, SUM(amount) AS 收入 FROM vouchers WHERE acc_code = '6001' AND direction = '贷' GROUP BY YEAR(date), MONTH(date) ORDER BY 年, 月;" },
    { label: '示例：应收账款客户排行', sql: "SELECT c.cust_name AS 客户, SUM(v.amount) AS 应收余额 FROM vouchers v JOIN customers c ON v.cust_id = c.cust_id WHERE v.acc_code = '1122' AND v.direction = '借' GROUP BY c.cust_name ORDER BY 应收余额 DESC;" },
    { label: '示例：查询大额凭证(>10万)', sql: "SELECT vid, date, dept_id, acc_code, amount FROM vouchers WHERE amount > 100000 ORDER BY amount DESC LIMIT 10;" },
    { label: '示例：LIKE 模糊查询', sql: "SELECT * FROM vouchers WHERE summary LIKE '%应收%' LIMIT 10;" },
    { label: '示例：INSERT 新增一行', sql: "INSERT INTO vouchers (vid, date, dept_id, acc_code, direction, amount, cust_id, summary) VALUES (9999, '2025-06-15', 1, '6601', '借', 8888, NULL, '练习插入');" },
    { label: '示例：CREATE 自建练习表', sql: "CREATE TABLE my_practice (id INT, 项目 TEXT, 金额 NUMERIC);" },
  ];

  function runSQLcmd() {
    const sql = $('#sqlInput').value.trim();
    if (!sql) { toast('请输入 SQL 语句'); return; }
    const t0 = performance.now();
    let res;
    try {
      res = runSQL(sql, DB);
    } catch (e) {
      renderError(e.message);
      return;
    }
    const dt = (performance.now() - t0).toFixed(1);
    // 若是 DML / DDL，持久化
    if (res.message) { saveDB(); renderTableList(); }
    renderResult(res, dt);
  }

  function renderResult(res, dt) {
    const area = $('#resultArea');
    if (res.message && (!res.columns || res.columns.length === 0)) {
      area.innerHTML = `<div class="ok-msg">${esc(res.message)}</div>`;
      return;
    }
    const cols = res.columns, rows = res.rows;
    const shown = rows.slice(0, MAX_ROWS);
    let html = `<div class="result-meta">共 <b>${res.rowCount}</b> 行 · 用时 ${dt} ms` +
      (rows.length > MAX_ROWS ? ` · 仅渲染前 ${MAX_ROWS} 行` : '') + `</div>`;
    html += '<div class="result-scroll"><table class="data-table result-table"><thead><tr>' +
      cols.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    shown.forEach((r) => {
      html += '<tr>' + cols.map((c, i) => `<td class="${isMoneyCol(c) ? 'money' : ''} ${c === 'direction' ? 'dir-' + r[i] : ''}">${fmtCell(r[i])}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table></div>';
    area.innerHTML = html;
  }
  function renderError(msg) {
    $('#resultArea').innerHTML = `<div class="err-msg">执行出错：${esc(msg)}<div class="err-hint">提示：本练习台支持 SELECT / INSERT / UPDATE / DELETE / CREATE / DROP，以及 JOIN、聚合、GROUP BY、CASE WHEN、子查询、窗口函数 等。</div></div>`;
  }

  function exportCSV() {
    const area = $('#resultArea');
    const table = area.querySelector('table');
    if (!table) { toast('暂无可导出的结果'); return; }
    const lines = [];
    $all('tr', table).forEach((tr) => {
      const cells = $all('th,td', tr).map((c) => {
        let v = c.textContent;
        if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      });
      lines.push(cells.join(','));
    });
    const csv = '﻿' + lines.join('\n');
    download(csv, 'sql_result.csv', 'text/csv;charset=utf-8');
  }
  function download(content, fname, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- 保存的查询 ---------- */
  function loadQueries() {
    try { return JSON.parse(localStorage.getItem(LS_Q) || '[]'); } catch (e) { return []; }
  }
  function saveQueries(q) { localStorage.setItem(LS_Q, JSON.stringify(q)); }
  function renderSaved() {
    const box = $('#savedList');
    const q = loadQueries();
    if (!q.length) { box.innerHTML = '<div class="saved-empty">还没有保存的查询。写好 SQL 后点“保存查询”即可收藏。</div>'; return; }
    box.innerHTML = '';
    q.forEach((item, i) => {
      const d = document.createElement('div');
      d.className = 'saved-item';
      d.innerHTML = `<div class="saved-name">${esc(item.name)}</div><div class="saved-sql">${esc(item.sql)}</div>` +
        `<div class="saved-actions"><button class="btn-mini" data-act="load" data-i="${i}">载入</button><button class="btn-mini danger" data-act="del" data-i="${i}">删除</button></div>`;
      box.appendChild(d);
    });
    $all('button', box).forEach((b) => {
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const q = loadQueries();
        if (b.dataset.act === 'load') { $('#sqlInput').value = q[i].sql; switchTab('sandbox'); toast('已载入查询'); }
        else { q.splice(i, 1); saveQueries(q); renderSaved(); }
      });
    });
  }
  function saveCurrentQuery() {
    const sql = $('#sqlInput').value.trim();
    if (!sql) { toast('没有可保存的 SQL'); return; }
    const name = prompt('给这条查询起个名字：', sql.slice(0, 20));
    if (!name) return;
    const q = loadQueries();
    q.unshift({ name, sql });
    saveQueries(q);
    renderSaved();
    toast('已保存查询');
  }

  /* ---------- 备份导入导出 ---------- */
  function exportBackup() {
    const payload = { tables: DB, queries: loadQueries() };
    download('﻿' + JSON.stringify(payload, null, 2), 'sqlfin_backup.json', 'application/json');
  }
  function importBackup() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.tables) throw new Error('文件格式不正确');
          DB = data.tables;
          if (data.queries) saveQueries(data.queries);
          saveDB();
          renderTableList();
          showTable(currentTable);
          renderSaved();
          toast('备份已恢复');
        } catch (e) { alert('导入失败：' + e.message); }
      };
      reader.readAsText(f);
    };
    inp.click();
  }

  /* ---------- 语法速查 ---------- */
  const REF = [
    { cat: 'SELECT 基础查询', items: [
      { d: '查询表中所有列', s: 'SELECT * FROM departments;' },
      { d: '查询指定列', s: 'SELECT dept_name, region FROM departments;' },
      { d: '给列起别名（AS 可省略）', s: "SELECT dept_name AS 部门, region 区域 FROM departments;" },
      { d: '查询不重复的组合（DISTINCT）', s: 'SELECT DISTINCT acc_code FROM vouchers;' },
    ]},
    { cat: 'WHERE 条件过滤', items: [
      { d: '等于 / 不等于', s: "SELECT * FROM vouchers WHERE direction = '借';" },
      { d: '数值比较（大于）', s: 'SELECT * FROM vouchers WHERE amount > 50000;' },
      { d: '逻辑 AND / OR', s: "SELECT * FROM vouchers WHERE dept_id = 1 AND direction = '借';" },
      { d: 'IN 列表匹配', s: 'SELECT * FROM vouchers WHERE dept_id IN (1, 2, 3);' },
      { d: 'BETWEEN 区间', s: 'SELECT * FROM vouchers WHERE amount BETWEEN 30000 AND 60000;' },
      { d: 'IS NULL / IS NOT NULL', s: 'SELECT * FROM vouchers WHERE cust_id IS NULL LIMIT 10;' },
      { d: 'LIKE 模糊匹配（% 任意，_ 单字）', s: "SELECT * FROM vouchers WHERE summary LIKE '%应收%' LIMIT 10;" },
    ]},
    { cat: '排序与分页', items: [
      { d: 'ORDER BY 升序 / 降序', s: 'SELECT * FROM vouchers ORDER BY amount DESC LIMIT 10;' },
      { d: '多列排序', s: 'SELECT dept_id, amount FROM vouchers ORDER BY dept_id ASC, amount DESC LIMIT 20;' },
      { d: 'LIMIT 限制返回行数', s: 'SELECT * FROM vouchers LIMIT 5;' },
    ]},
    { cat: '聚合函数', items: [
      { d: 'COUNT 计数', s: 'SELECT COUNT(*) AS 总笔数 FROM vouchers;' },
      { d: 'SUM 求和', s: "SELECT SUM(amount) AS 总借方 FROM vouchers WHERE direction = '借';" },
      { d: 'AVG / MIN / MAX', s: "SELECT AVG(amount) AS 平均, MIN(amount) AS 最小, MAX(amount) AS 最大 FROM vouchers WHERE direction = '借';" },
    ]},
    { cat: 'GROUP BY 与 HAVING', items: [
      { d: '按科目分组汇总', s: 'SELECT acc_code, SUM(amount) AS 合计 FROM vouchers GROUP BY acc_code ORDER BY 合计 DESC;' },
      { d: '多列分组', s: 'SELECT dept_id, direction, SUM(amount) AS 合计 FROM vouchers GROUP BY dept_id, direction ORDER BY dept_id;' },
      { d: 'HAVING 过滤分组结果', s: 'SELECT dept_id, COUNT(*) AS 笔数 FROM vouchers GROUP BY dept_id HAVING COUNT(*) > 100;' },
      { d: 'HAVING 用聚合别名', s: 'SELECT acc_code, SUM(amount) AS 合计 FROM vouchers GROUP BY acc_code HAVING 合计 > 1000000;' },
    ]},
    { cat: '多表连接 JOIN', items: [
      { d: 'INNER JOIN 内连接', s: "SELECT d.dept_name, v.amount FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id LIMIT 10;" },
      { d: 'LEFT JOIN 左连接', s: "SELECT d.dept_name, SUM(v.amount) AS 费用 FROM vouchers v LEFT JOIN departments d ON v.dept_id = d.dept_id GROUP BY d.dept_name;" },
      { d: '三表连接（凭证+部门+客户）', s: "SELECT c.cust_name, SUM(v.amount) AS 应收 FROM vouchers v JOIN customers c ON v.cust_id = c.cust_id WHERE v.acc_code = '1122' GROUP BY c.cust_name;" },
      { d: '连接预算与实际（预算执行率基础）', s: "SELECT d.dept_name, b.month, SUM(b.budget_amount) AS 预算 FROM budgets b JOIN departments d ON b.dept_id = d.dept_id WHERE b.acc_code = '6601' GROUP BY d.dept_name, b.month LIMIT 12;" },
    ]},
    { cat: 'CASE WHEN 条件判断', items: [
      { d: '搜索型 CASE（最常用）', s: "SELECT vid, amount, CASE WHEN amount >= 100000 THEN '大额' WHEN amount >= 10000 THEN '中额' ELSE '小额' END AS 档位 FROM vouchers LIMIT 10;" },
      { d: '简单型 CASE（等值匹配）', s: "SELECT vid, direction, CASE direction WHEN '借' THEN amount ELSE -amount END AS 净额 FROM vouchers LIMIT 10;" },
      { d: 'CASE 配合分组（GROUP BY 里要重写完整表达式，不能用别名）', s: "SELECT CASE WHEN amount >= 100000 THEN '大额' ELSE '其他' END AS 档位, COUNT(*) AS 笔数 FROM vouchers GROUP BY CASE WHEN amount >= 100000 THEN '大额' ELSE '其他' END;" },
    ]},
    { cat: '子查询 Subquery', items: [
      { d: '标量子查询（返回一个值，内层先跑）', s: 'SELECT vid, amount FROM vouchers WHERE amount > (SELECT AVG(amount) FROM vouchers) LIMIT 10;' },
      { d: 'IN 子查询（返回一列值）', s: "SELECT vid, dept_id FROM vouchers WHERE dept_id IN (SELECT dept_id FROM departments WHERE region = '华东') LIMIT 10;" },
      { d: 'FROM 派生表（必须起别名）', s: 'SELECT t.dept_id, t.cnt FROM (SELECT dept_id, COUNT(*) AS cnt FROM vouchers GROUP BY dept_id) t WHERE t.cnt > 100;' },
    ]},
    { cat: '窗口函数 Window Function', items: [
      { d: 'ROW_NUMBER 分组内编号（行数不变）', s: 'SELECT vid, dept_id, amount, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY amount DESC) AS rn FROM vouchers LIMIT 10;' },
      { d: 'RANK / DENSE_RANK 排名', s: 'SELECT vid, dept_id, amount, RANK() OVER (PARTITION BY dept_id ORDER BY amount DESC) AS rk FROM vouchers LIMIT 10;' },
      { d: 'SUM OVER 分组内累计求和', s: 'SELECT vid, dept_id, amount, SUM(amount) OVER (PARTITION BY dept_id ORDER BY amount DESC) AS 累计 FROM vouchers LIMIT 10;' },
      { d: '窗口 + 子查询：取每组前 N 名', s: 'SELECT t.dept_id, t.vid, t.amount FROM (SELECT dept_id, vid, amount, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY amount DESC) AS rn FROM vouchers) t WHERE t.rn <= 3;' },
    ]},
    { cat: '常用函数', items: [
      { d: 'YEAR / MONTH 提取年月', s: "SELECT YEAR(date) AS 年, MONTH(date) AS 月, SUM(amount) AS 收入 FROM vouchers WHERE acc_code = '6001' GROUP BY YEAR(date), MONTH(date);" },
      { d: 'ROUND 四舍五入', s: 'SELECT ROUND(AVG(amount), 2) AS 平均金额 FROM vouchers;' },
      { d: 'COALESCE 处理空值', s: "SELECT vid, COALESCE(cust_id, '无客户') AS 客户 FROM vouchers LIMIT 10;" },
      { d: 'UPPER / LOWER 大小写', s: 'SELECT UPPER(acc_name) FROM accounts LIMIT 5;' },
      { d: 'CONCAT 拼接', s: "SELECT CONCAT(dept_name, '-', region) AS 部门地区 FROM departments;" },
    ]},
    { cat: '数据操作 DML', items: [
      { d: 'INSERT 插入一行', s: "INSERT INTO vouchers (vid, date, dept_id, acc_code, direction, amount, cust_id, summary) VALUES (9999, '2025-06-15', 1, '6601', '借', 8888, NULL, '练习插入');" },
      { d: 'INSERT 多行', s: "INSERT INTO vouchers (vid, date, dept_id, acc_code, direction, amount, cust_id, summary) VALUES (9001, '2025-07-01', 2, '6602', '借', 1000, NULL, 'A'), (9002, '2025-07-02', 2, '6602', '借', 2000, NULL, 'B');" },
      { d: 'UPDATE 更新', s: "UPDATE vouchers SET amount = 9999 WHERE vid = 9999;" },
      { d: 'DELETE 删除', s: 'DELETE FROM vouchers WHERE vid = 9999;' },
    ]},
    { cat: '表定义 DDL', items: [
      { d: 'CREATE TABLE 建表', s: 'CREATE TABLE my_practice (id INT, 项目 TEXT, 金额 NUMERIC);' },
      { d: 'DROP TABLE 删表', s: 'DROP TABLE my_practice;' },
      { d: '常见数据类型', s: '-- INT 整数 / NUMERIC 数值 / TEXT 文本 / DATE 日期 / VARCHAR(50) 变长文本' },
    ]},
    { cat: '本练习台的限制（已知边界）', items: [
      { d: '不支持相关子查询', s: '-- 子查询内部不能引用外层表的列；独立子查询正常可用' },
      { d: '不支持 CTE（WITH）', s: '-- WITH 语法暂不支持，请改用 FROM (SELECT ...) t 派生表' },
      { d: '不支持 FULL JOIN', s: '-- INNER / LEFT / RIGHT JOIN 已支持；FULL JOIN 不支持' },
      { d: '建议练习路径', s: '-- SELECT+WHERE → GROUP BY/HAVING → JOIN → CASE WHEN → 子查询 → 窗口函数' },
    ]},
  ];

  function renderRef() {
    const box = $('#refList');
    box.innerHTML = '';
    REF.forEach((group, gi) => {
      const sec = document.createElement('div');
      sec.className = 'ref-group';
      const head = document.createElement('button');
      head.className = 'ref-head';
      head.innerHTML = `<span>${esc(group.cat)}</span><span class="arrow">▾</span>`;
      const body = document.createElement('div');
      body.className = 'ref-body';
      group.items.forEach((it) => {
        const item = document.createElement('div');
        item.className = 'ref-item';
        item.innerHTML = `<div class="ref-desc">${esc(it.d)}</div>` +
          `<pre class="ref-sql" title="点击载入到沙盒">${esc(it.s)}</pre>` +
          `<button class="btn-mini" data-sql="${esc(it.s)}">载入沙盒</button>`;
        body.appendChild(item);
      });
      head.addEventListener('click', () => {
        sec.classList.toggle('open');
      });
      head.addEventListener('click', () => { /* toggle arrow */ });
      sec.appendChild(head); sec.appendChild(body);
      box.appendChild(sec);
    });
    // 默认展开前两组
    $all('.ref-group', box).slice(0, 2).forEach((g) => g.classList.add('open'));
    $all('.ref-sql', box).forEach((pre) => {
      pre.addEventListener('click', () => {
        const sql = pre.textContent.replace(/^--.*\n?/gm, '').trim();
        if (!sql) return;
        $('#sqlInput').value = sql;
        switchTab('sandbox');
        runSQLcmd();
      });
    });
    $all('button.btn-mini[data-sql]', box).forEach((b) => {
      b.addEventListener('click', () => {
        const sql = b.dataset.sql.replace(/^--.*\n?/gm, '').trim();
        if (!sql) return;
        $('#sqlInput').value = sql;
        switchTab('sandbox');
        runSQLcmd();
      });
    });
  }

  /* ---------- Tab 切换 ---------- */
  function switchTab(name) {
    $all('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $all('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + name));
  }

  /* ---------- 导入用户数据（xlsx / csv） ---------- */
  function decodeXmlEnt(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
  function colLetterToIdx(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function parseCsvText(text) {
    const first = text.split(/\r?\n/)[0] || '';
    const delim = first.split('\t').length > first.split(',').length ? '\t' : ',';
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  async function parseXlsxBuffer(buf) {
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持内置解压，请在 Excel 里用"另存为 CSV"后再导入');
    const data = new Uint8Array(buf);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let eocd = -1;
    const min = Math.max(0, data.length - 65558);
    for (let i = data.length - 22; i >= min; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 xlsx 文件');
    const cdCount = dv.getUint16(eocd + 10, true);
    let ptr = dv.getUint32(eocd + 16, true);
    const entries = {};
    for (let i = 0; i < cdCount; i++) {
      if (ptr + 46 > data.length || dv.getUint32(ptr, true) !== 0x02014b50) break;
      const method = dv.getUint16(ptr + 10, true);
      const compSize = dv.getUint32(ptr + 20, true);
      const nameLen = dv.getUint16(ptr + 28, true);
      const extraLen = dv.getUint16(ptr + 30, true);
      const commentLen = dv.getUint16(ptr + 32, true);
      const localOffset = dv.getUint32(ptr + 42, true);
      let name = '';
      for (let j = 0; j < nameLen; j++) name += String.fromCharCode(data[ptr + 46 + j]);
      entries[name] = { method, compSize, localOffset };
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    async function readEntry(name) {
      const e = entries[name];
      if (!e) return null;
      const nameLen = dv.getUint16(e.localOffset + 26, true);
      const extraLen = dv.getUint16(e.localOffset + 28, true);
      const start = e.localOffset + 30 + nameLen + extraLen;
      const chunk = data.subarray(start, start + e.compSize);
      if (e.method === 0) return new TextDecoder('utf-8').decode(chunk);
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([chunk]).stream().pipeThrough(ds);
      const out = await new Response(stream).arrayBuffer();
      return new TextDecoder('utf-8').decode(out);
    }
    const shared = [];
    const ssXml = await readEntry('xl/sharedStrings.xml');
    if (ssXml) {
      const re = /<si>([\s\S]*?)<\/si>/g; let m;
      while ((m = re.exec(ssXml))) {
        let s = '';
        const tre = /<t[^>]*>([\s\S]*?)<\/t>/g; let tm;
        while ((tm = tre.exec(m[1]))) s += decodeXmlEnt(tm[1]);
        shared.push(s);
      }
    }
    let sheetXml = await readEntry('xl/worksheets/sheet1.xml');
    if (!sheetXml) {
      const k = Object.keys(entries).find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      if (k) sheetXml = await readEntry(k);
    }
    if (!sheetXml) throw new Error('未找到工作表内容');
    const rows = [];
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>|<row[^>]*\/>/g; let rm;
    while ((rm = rowRe.exec(sheetXml))) {
      const rowXml = rm[0];
      const cells = [];
      const cRe = /<c\s([^>]*?)>([\s\S]*?)<\/c>|<c\s([^>]*?)\/>/g; let cm;
      while ((cm = cRe.exec(rowXml))) {
        const attrs = cm[1] || cm[3] || '';
        const inner = cm[2] || '';
        const rM = /r="([A-Z]+)/.exec(attrs);
        const tM = /t="([^"]+)"/.exec(attrs);
        const vM = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        const isM = /<is>([\s\S]*?)<\/is>/.exec(inner);
        const idx = rM ? colLetterToIdx(rM[1]) : cells.length;
        let val = '';
        if (tM && tM[1] === 'inlineStr' && isM) {
          let s = '';
          const tre = /<t[^>]*>([\s\S]*?)<\/t>/g; let tm;
          while ((tm = tre.exec(isM[1]))) s += decodeXmlEnt(tm[1]);
          val = s;
        } else if (vM) {
          const raw = decodeXmlEnt(vM[1]);
          val = (tM && tM[1] === 's') ? (shared[parseInt(raw, 10)] ?? '') : raw;
        }
        cells[idx] = val;
      }
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
      rows.push(cells);
    }
    return rows;
  }
  function rowsToTable(rows) {
    if (!rows.length) throw new Error('文件是空的');
    const header = rows[0].map((h, i) => {
      const s = String(h == null ? '' : h).trim();
      return s === '' ? 'col' + (i + 1) : s;
    });
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const src = rows[i] || [];
      if (src.every((v) => v === '' || v == null)) continue;
      const o = {};
      header.forEach((h, j) => {
        let v = src[j];
        if (typeof v === 'string') {
          const t = v.trim();
          v = (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) ? Number(t) : t;
        }
        o[h] = v;
      });
      out.push(o);
    }
    return { cols: header, rows: out };
  }
  function tableNameFrom(fname) {
    let n = fname.replace(/\.(xlsx|csv|tsv|txt)$/i, '').trim();
    n = n.replace(/[^\w一-龥]/g, '_');
    if (!n) n = 'my_data';
    if (/^\d/.test(n)) n = 'my_' + n;
    return n;
  }
  async function handleImportFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    ev.target.value = '';
    const hint = $('#importHint');
    hint.style.display = 'block';
    hint.textContent = '正在解析 ' + file.name + ' ...';
    try {
      let rows;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
        const buf = await file.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.indexOf('\uFFFD') >= 0) {
          try {
            const gbk = new TextDecoder('gbk').decode(buf);
            if (gbk.indexOf('\uFFFD') < 0) text = gbk;
          } catch (e) { /* 浏览器不支持 GBK 则沿用 UTF-8 结果 */ }
        }
        rows = parseCsvText(text.replace(/^﻿/, ''));
      } else if (lower.endsWith('.xlsx')) {
        rows = await parseXlsxBuffer(await file.arrayBuffer());
      } else {
        throw new Error('仅支持 .xlsx / .csv 文件（Excel 可用"另存为 CSV"）');
      }
      const t = rowsToTable(rows);
      if (!t.cols.length) throw new Error('未能识别表头，请确认第一行是列名');
      let name = tableNameFrom(file.name);
      if (DB[name]) { let i = 2; while (DB[name + '_' + i]) i++; name = name + '_' + i; }
      DB[name] = { cols: t.cols, rows: t.rows };
      saveDB();
      renderTableList();
      showTable(name);
      hint.textContent = '已导入表 ' + name + '（' + t.rows.length + ' 行 x ' + t.cols.length + ' 列），可在 SQL 沙盒里直接查询。';
      toast('导入成功：' + name);
    } catch (e) {
      hint.textContent = '导入失败：' + e.message;
      toast('导入失败');
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    DB = loadDB() || buildDB();
    saveDB();

    renderTasks();
    renderTableList();
    showTable(currentTable);
    renderSaved();
    renderRef();

    // 示例下拉
    const exSel = $('#exampleSel');
    EXAMPLES.forEach((e, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = e.label;
      exSel.appendChild(o);
    });
    exSel.addEventListener('change', () => {
      if (exSel.value === '') return;
      $('#sqlInput').value = EXAMPLES[+exSel.value].sql;
      switchTab('sandbox');
      runSQLcmd();
      exSel.value = '';
    });

    // 按钮事件
    $('#runBtn').addEventListener('click', runSQLcmd);
    $('#clearBtn').addEventListener('click', () => { $('#sqlInput').value = ''; $('#resultArea').innerHTML = '<div class="hint">结果将显示在这里。</div>'; $('#sqlInput').focus(); });
    $('#csvBtn').addEventListener('click', exportCSV);
    $('#saveQBtn').addEventListener('click', saveCurrentQuery);
    $('#backupBtn').addEventListener('click', exportBackup);
    $('#importBtn').addEventListener('click', importBackup);
    $('#resetBtn').addEventListener('click', () => {
      if (confirm('确定要重置为初始虚拟财务数据吗？你做的 INSERT/UPDATE/DELETE 与自建表将被清空。')) resetDB();
    });
    $('#refreshDataBtn').addEventListener('click', () => { renderTableList(); showTable(currentTable); toast('已刷新数据视图'); });
    $('#importDataBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', handleImportFile);

    $all('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // 快捷键 Ctrl/Cmd + Enter 运行
    $('#sqlInput').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSQLcmd(); }
    });

    // 预置一条欢迎查询
    $('#sqlInput').value = "SELECT d.dept_name AS 部门, SUM(v.amount) AS 销售费用 FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id WHERE v.acc_code = '6601' GROUP BY d.dept_name ORDER BY 销售费用 DESC;";
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
