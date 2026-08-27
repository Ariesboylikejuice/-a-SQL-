[README.md](https://github.com/user-attachments/files/31507543/README.md)
# 小a SQL语法练习平台

一个**零依赖、纯前端、可离线**的 SQL 练习工作台，专为财务分析新手设计。
内置一套虚拟财务数据，并附带中文 SQL 语法速查，打开网页即可练习，无需安装任何数据库或运行环境。

👉 在线示例（已部署）：https://workbuddy.link/p/oCZFUsbg8g39HGZKxajNaF

---

## 功能特性

- **内置虚拟财务数据**：部门、科目、客户、凭证、预算等 5 张相互关联的表，数据由确定性伪随机算法生成，每次打开结果一致。
- **浏览器内 SQL 引擎**：自研的纯 JavaScript SQL 引擎（无任何第三方依赖），支持查询、聚合、连接、DML（增删改）、DDL（建/删表）。
- **中文语法速查**：覆盖常用 SQL 语法条目，均为中文说明，新手可对照练习。
- **示例一键载入**：常见财务分析场景的示例查询，点击即可运行。
- **结果导出**：查询结果可导出为 CSV。
- **离线缓存**：支持把当前数据库状态保存到浏览器本地（localStorage），刷新不丢失。

---[Uploading sql_engine.js…]()


## 本地使用

不需要任何构建步骤，**双击 `index.html` 用浏览器打开即可**：

```
直接用浏览器打开 index.html
```

或在本仓库目录下起一个静态服务器（可选）：

```bash
python -m http.server 8000
# 然后访问 http://localhost:8000
```

---

## 部署到 GitHub Pages

把本仓库推送到 GitHub 后，开启 Pages 即可获得一个公开网址：

1. 在 GitHub 上新建一个仓库（例如 `sql-finance-workbench`）。
2. 把本目录下的 `index.html` 和 `README.md` 提交并推送到仓库（建议推到 `main` 分支）。
3. 进入仓库 **Settings → Pages**。
4. **Source** 选择 `Deploy from a branch`，**Branch** 选择 `main` / `root`，点击 Save。
5. 等待一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

> 提示：文件名必须是 `index.html`，GitHub Pages 才会默认把它作为站点首页。

---

## 内置数据表

| 表名 | 说明 |
| --- | --- |
| `departments` | 部门表（5 个部门） |
| `accounts` | 会计科目表（含 6603 财务费用等科目） |
| `customers` | 客户表 |
| `vouchers` | 凭证表（核心事实表，含日期/部门/科目/借贷方向/金额/客户/摘要） |
| `budgets` | 预算表（部门 × 费用科目 × 月份 的预算金额） |

表与表之间已预置外键关系（如 `vouchers.dept_id → departments.id`），可直接练习 `JOIN`。

---

## SQL 支持范围

**支持：**
- 查询：`SELECT` / `DISTINCT` / `WHERE` / `GROUP BY` / `HAVING` / `ORDER BY` / `LIMIT` / `OFFSET`
- 连接：`JOIN`（INNER / LEFT / RIGHT）
- 聚合：`COUNT` / `SUM` / `AVG` / `MIN` / `MAX`
- 条件：`LIKE` / `IN` / `BETWEEN` / `IS NULL`
- 函数：`YEAR` / `MONTH` / `ROUND` / `COALESCE` / `UPPER` / `LOWER` / `CONCAT` / `ABS` / `LENGTH`
- DML：`INSERT` / `UPDATE` / `DELETE`
- DDL：`CREATE TABLE` / `DROP TABLE`

**暂不支持（已知边界）：**
- 子查询（嵌套 `SELECT`）
- 窗口函数（`ROW_NUMBER` / `RANK` 等）
- `CASE WHEN`

---

## 文件结构

```
index.html        # 工作台本体（单文件、零依赖，可直接打开或部署）
README.md         # 本说明文件
```

> 如需修改或重新构建，原始工程由 `sql_engine.js`（引擎）+ `ui_logic.js`（界面逻辑）+ `template.html`（骨架）三部分组成，拼合后即为 `index.html`。

---

## 许可证

MIT —— 可自由使用、修改、再分发。

/* =========================================================================
 * SQL 财务分析练习台 —— 纯 JS 浏览器内 SQL 引擎 + 虚拟财务数据
 * 零外部依赖。支持：SELECT / WHERE / GROUP BY / HAVING / ORDER BY / LIMIT /
 * JOIN(INNER/LEFT/RIGHT) / 聚合函数 / 常用标量函数 / INSERT / UPDATE /
 * DELETE / CREATE TABLE / DROP TABLE / DISTINCT / LIKE / IN / BETWEEN / IS NULL
 * ========================================================================= */

/* ---------- 虚拟财务数据（确定性生成，刷新后一致） ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDB() {
  const rng = mulberry32(20260827);
  const rand = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const departments = [
    { dept_id: 1, dept_name: '销售一部', region: '华东' },
    { dept_id: 2, dept_name: '销售二部', region: '华北' },
    { dept_id: 3, dept_name: '市场部', region: '华南' },
    { dept_id: 4, dept_name: '财务部', region: '华东' },
    { dept_id: 5, dept_name: '行政人事部', region: '西南' },
  ];

  const accounts = [
    { acc_code: '1001', acc_name: '库存现金', acc_type: '资产' },
    { acc_code: '1122', acc_name: '应收账款', acc_type: '资产' },
    { acc_code: '2202', acc_name: '应付账款', acc_type: '负债' },
    { acc_code: '2221', acc_name: '应交税费', acc_type: '负债' },
    { acc_code: '3001', acc_name: '实收资本', acc_type: '权益' },
    { acc_code: '6001', acc_name: '主营业务收入', acc_type: '收入' },
    { acc_code: '6051', acc_name: '其他业务收入', acc_type: '收入' },
    { acc_code: '6401', acc_name: '主营业务成本', acc_type: '费用' },
    { acc_code: '6601', acc_name: '销售费用', acc_type: '费用' },
    { acc_code: '6602', acc_name: '管理费用', acc_type: '费用' },
    { acc_code: '6603', acc_name: '财务费用', acc_type: '费用' },
  ];

  const customers = [
    { cust_id: 1, cust_name: '北京智联科技有限公司', region: '华北', level: 'A' },
    { cust_id: 2, cust_name: '上海远见贸易有限公司', region: '华东', level: 'A' },
    { cust_id: 3, cust_name: '广州海纳实业', region: '华南', level: 'B' },
    { cust_id: 4, cust_name: '深圳锐进电子', region: '华南', level: 'A' },
    { cust_id: 5, cust_name: '杭州云栖网络', region: '华东', level: 'B' },
    { cust_id: 6, cust_name: '成都天府软件', region: '西南', level: 'C' },
  ];

  const vouchers = [];
  let vid = 1000;
  const summaries = {
    '6001': ['产品销售收入', '销售回款-收入确认', '季度服务收入'],
    '6051': ['废料处置收入', '租金收入', '咨询服务收入'],
    '6401': ['采购原材料成本', '直接人工成本', '制造费用结转'],
    '6601': ['销售人员差旅费', '市场推广费', '业务招待费', '销售提成'],
    '6602': ['办公费', '管理人员工资', '房租水电', '折旧摊销'],
    '6603': ['银行手续费', '汇兑损益', '借款利息'],
    '1122': ['赊销应收账款', '收回客户欠款'],
    '2202': ['采购应付账款', '支付供应商货款'],
    '2221': ['计提增值税', '缴纳附加税'],
    '1001': ['现金收款', '现金付款', '备用金支取'],
    '3001': ['股东注资', '资本公积转入'],
  };

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    for (const d of departments) {
      // 收入（主营业务收入 + 少量其他业务收入）
      const baseRev = (d.dept_id === 1 || d.dept_id === 2) ? rand(120000, 260000)
        : (d.dept_id === 3) ? rand(60000, 120000)
          : rand(20000, 60000);
      const rev = baseRev - (baseRev % 100);
      vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '6001', direction: '贷', amount: rev, cust_id: pick(customers).cust_id, summary: pick(summaries['6001']) });
      // 应收账款：部分赊销
      if (rng() > 0.5) {
        vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '1122', direction: '借', amount: Math.round(rev * 0.4), cust_id: pick(customers).cust_id, summary: '赊销应收账款' });
      }
      // 成本 ~ 收入的 55%-65%
      const cost = Math.round(rev * (0.55 + rng() * 0.1));
      vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '6401', direction: '借', amount: cost, cust_id: null, summary: pick(summaries['6401']) });
      // 费用按部门规模
      const sScale = (d.dept_id <= 2) ? 40000 : (d.dept_id === 3 ? 30000 : 15000);
      const sCount = rand(1, 3);
      for (let k = 0; k < sCount; k++) {
        vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '6601', direction: '借', amount: rand(3000, sScale), cust_id: null, summary: pick(summaries['6601']) });
      }
      const mCount = rand(1, 3);
      for (let k = 0; k < mCount; k++) {
        vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '6602', direction: '借', amount: rand(2000, 18000), cust_id: null, summary: pick(summaries['6602']) });
      }
      // 财务费用（偶尔）
      if (rng() > 0.6) {
        vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '6603', direction: '借', amount: rand(500, 4000), cust_id: null, summary: pick(summaries['6603']) });
      }
      // 现金
      vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '1001', direction: rng() > 0.5 ? '借' : '贷', amount: rand(5000, 40000), cust_id: null, summary: pick(summaries['1001']) });
      // 应交税费
      vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '2221', direction: '贷', amount: Math.round(rev * 0.13), cust_id: null, summary: '计提增值税' });
      // 应付账款
      if (rng() > 0.5) {
        vouchers.push({ vid: ++vid, date: `2025-${mm}-${rand(1, 27).toString().padStart(2, '0')}`, dept_id: d.dept_id, acc_code: '2202', direction: '贷', amount: rand(10000, 80000), cust_id: null, summary: '采购应付账款' });
      }
    }
    // 实收资本只在 1 月
    if (m === 1) {
      vouchers.push({ vid: ++vid, date: '2025-01-10', dept_id: 4, acc_code: '3001', direction: '贷', amount: 1000000, cust_id: null, summary: '股东注资' });
    }
  }

  // 预算表（部门 × 费用科目 × 月份）
  const budgets = [];
  const budgetAccs = ['6601', '6602', '6603', '6401'];
  for (const d of departments) {
    for (const ac of budgetAccs) {
      const monthly = (ac === '6601' ? (d.dept_id <= 2 ? 90000 : 50000)
        : ac === '6602' ? 40000 : ac === '6603' ? 8000 : 120000);
      for (let m = 1; m <= 12; m++) {
        budgets.push({
          dept_id: d.dept_id,
          month: `2025-${String(m).padStart(2, '0')}`,
          acc_code: ac,
          budget_amount: monthly + rand(-5000, 5000),
        });
      }
    }
  }

  const db = {};
  for (const [name, rows] of [
    ['departments', departments],
    ['accounts', accounts],
    ['customers', customers],
    ['vouchers', vouchers],
    ['budgets', budgets],
  ]) {
    db[name] = { cols: Object.keys(rows[0]), rows };
  }
  return db;
}

/* ======================== SQL 引擎 ======================== */

function tokenize(sql) {
  const tokens = [];
  let i = 0;
  const n = sql.length;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isAlpha = (c) => /[A-Za-z_一-龥]/.test(c);
  const isAlnum = (c) => isAlpha(c) || isDigit(c);
  while (i < n) {
    let c = sql[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { i += 2; while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'") {
      let j = i + 1, s = '';
      while (j < n) { if (sql[j] === "'") { if (sql[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += sql[j]; j++; }
      tokens.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n) { if (sql[j] === '"') { if (sql[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += sql[j]; j++; }
      tokens.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1, s = '';
      while (j < n && sql[j] !== '`') { s += sql[j]; j++; }
      tokens.push({ t: 'ident', v: s }); i = j + 1; continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(sql[i + 1]))) {
      let j = i, s = '';
      while (j < n && (isDigit(sql[j]) || sql[j] === '.')) { s += sql[j]; j++; }
      tokens.push({ t: 'num', v: parseFloat(s) }); i = j; continue;
    }
    if (isAlpha(c)) {
      let j = i, s = '';
      while (j < n && isAlnum(sql[j])) { s += sql[j]; j++; }
      tokens.push({ t: 'ident', v: s }); i = j; continue;
    }
    const two = sql.substr(i, 2);
    if (['<=', '>=', '!=', '<>'].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if ('=<>+-*/%(),.;'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
    throw new Error('无法识别的字符：' + c);
  }
  tokens.push({ t: 'eof' });
  return tokens;
}

function parse(sql0) {
  let sql = sql0.replace(/;\s*$/, '').trim();
  const tokens = tokenize(sql);
  let p = 0;
  const cur = () => tokens[p];
  const next = () => tokens[p++];
  const isKw = (k) => cur().t === 'ident' && cur().v.toUpperCase() === k;
  const isOp = (o) => cur().t === 'op' && cur().v === o;
  const eatKw = (k) => { if (!isKw(k)) throw new Error(`缺少关键字 ${k}`); next(); };
  const eatOp = (o) => { if (!isOp(o)) throw new Error(`缺少符号 ${o}`); next(); };
  const acceptKw = (k) => { if (isKw(k)) { next(); return true; } return false; };
  const acceptOp = (o) => { if (isOp(o)) { next(); return true; } return false; };
  const RESERVED = new Set(['SELECT','FROM','WHERE','GROUP','BY','HAVING','ORDER','LIMIT','OFFSET','JOIN','INNER','LEFT','RIGHT','OUTER','ON','AS','AND','OR','NOT','IN','BETWEEN','LIKE','IS','NULL','ASC','DESC','DISTINCT','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP']);

  // ---- 表达式 ----
  function parseExpr() { return parseOr(); }
  function parseOr() {
    let left = parseAnd();
    while (isKw('OR')) { next(); const right = parseAnd(); left = { type: 'bin', op: 'OR', left, right }; }
    return left;
  }
  function parseAnd() {
    let left = parseNot();
    while (isKw('AND')) { next(); const right = parseNot(); left = { type: 'bin', op: 'AND', left, right }; }
    return left;
  }
  function parseNot() {
    if (isKw('NOT')) { next(); return { type: 'unary', op: 'NOT', expr: parseNot() }; }
    return parseCmp();
  }
  function parseCmp() {
    const left = parseAdd();
    if (isKw('IS')) {
      next(); const notNull = acceptKw('NOT');
      eatKw('NULL');
      return { type: 'bin', op: 'ISNULL', left, isNull: !notNull };
    }
    if (isKw('IN')) {
      next(); eatOp('(');
      const list = [];
      if (!isOp(')')) {
        list.push(parseValue());
        while (acceptOp(',')) list.push(parseValue());
      }
      eatOp(')');
      return { type: 'bin', op: 'IN', left, list };
    }
    if (isKw('BETWEEN')) {
      next(); const low = parseAdd(); eatKw('AND'); const high = parseAdd();
      return { type: 'bin', op: 'BETWEEN', left, low, high };
    }
    if (isKw('LIKE')) {
      next(); const pat = parseAdd();
      return { type: 'bin', op: 'LIKE', left, right: pat };
    }
    if (cur().t === 'op' && ['=', '!=', '<>', '<', '>', '<=', '>='].includes(cur().v)) {
      const op = next().v; const right = parseAdd();
      return { type: 'bin', op, left, right };
    }
    return left;
  }
  function parseValue() {
    // IN 列表里的值（字面量）
    if (cur().t === 'num') return { type: 'lit', value: next().v };
    if (cur().t === 'str') return { type: 'lit', value: next().v };
    if (isKw('NULL')) { next(); return { type: 'lit', value: null }; }
    if (cur().t === 'op' && cur().v === '-') { next(); return { type: 'unary', op: '-', expr: parseValue() }; }
    throw new Error('IN 列表中存在无法解析的值');
  }
  function parseAdd() {
    let left = parseMul();
    while (cur().t === 'op' && (cur().v === '+' || cur().v === '-')) {
      const op = next().v; const right = parseMul();
      left = { type: 'bin', op, left, right };
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (cur().t === 'op' && ['*', '/', '%'].includes(cur().v)) {
      const op = next().v; const right = parseUnary();
      left = { type: 'bin', op, left, right };
    }
    return left;
  }
  function parseUnary() {
    if (cur().t === 'op' && cur().v === '-') { next(); return { type: 'unary', op: '-', expr: parseUnary() }; }
    if (cur().t === 'op' && cur().v === '+') { next(); return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary() {
    if (cur().t === 'num') return { type: 'lit', value: next().v };
    if (cur().t === 'str') return { type: 'lit', value: next().v };
    if (isKw('NULL')) { next(); return { type: 'lit', value: null }; }
    if (cur().t === 'op' && cur().v === '(') { next(); const e = parseExpr(); eatOp(')'); return e; }
    if (cur().t === 'ident') {
      const name = next().v;
      // 函数?
      if (cur().t === 'op' && cur().v === '(') {
        next();
        const fname = name.toUpperCase();
        const AGG = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
        if (AGG.includes(fname)) {
          if (fname === 'COUNT' && cur().t === 'op' && cur().v === '*') { next(); eatOp(')'); return { type: 'agg', fn: 'COUNT', arg: '*' }; }
          let distinct = false;
          if (acceptKw('DISTINCT')) distinct = true;
          const arg = parseExpr();
          eatOp(')');
          return { type: 'agg', fn: fname, arg, distinct };
        }
        const args = [];
        if (!(cur().t === 'op' && cur().v === ')')) {
          args.push(parseExpr());
          while (acceptOp(',')) args.push(parseExpr());
        }
        eatOp(')');
        return { type: 'func', name: fname, args };
      }
      // 列引用（可能 table.col）
      let full = name;
      if (cur().t === 'op' && cur().v === '.') {
        next();
        if (cur().t === 'op' && cur().v === '*') { next(); full = name + '.*'; }
        else if (cur().t === 'ident') full = name + '.' + next().v;
        else throw new Error('列引用格式错误');
      }
      return { type: 'col', name: full };
    }
    throw new Error('无法解析表达式，遇到：' + (cur().t === 'eof' ? '语句结尾' : cur().v));
  }

  // ---- 顶层语句 ----
  const lc = cur().v ? cur().v.toUpperCase() : '';
  if (lc === 'SELECT') return parseSelect();
  if (lc === 'INSERT') return parseInsert();
  if (lc === 'UPDATE') return parseUpdate();
  if (lc === 'DELETE') return parseDelete();
  if (lc === 'CREATE') return parseCreate();
  if (lc === 'DROP') return parseDrop();
  throw new Error('仅支持 SELECT / INSERT / UPDATE / DELETE / CREATE / DROP 语句');

  function parseSelect() {
    eatKw('SELECT');
    const distinct = acceptKw('DISTINCT');
    const items = [];
    function parseItem() {
      if (cur().t === 'op' && cur().v === '*') { next(); items.push({ type: 'star' }); return; }
      const expr = parseExpr();
      let alias = null;
      if (acceptKw('AS')) { if (cur().t === 'ident') alias = next().v; else throw new Error('AS 后缺少别名'); }
      else if (cur().t === 'ident' && !RESERVED.has(cur().v.toUpperCase())) alias = next().v;
      items.push({ type: 'expr', expr, alias });
    }
    parseItem();
    while (acceptOp(',')) parseItem();

    eatKw('FROM');
    const from = parseTableRef();
    const joins = [];
    while (true) {
      let jt = null;
      if (acceptKw('JOIN')) jt = 'INNER';
      else if (acceptKw('INNER')) { eatKw('JOIN'); jt = 'INNER'; }
      else if (acceptKw('LEFT')) { if (acceptKw('OUTER')) { } eatKw('JOIN'); jt = 'LEFT'; }
      else if (acceptKw('RIGHT')) { if (acceptKw('OUTER')) { } eatKw('JOIN'); jt = 'RIGHT'; }
      else break;
      const tref = parseTableRef();
      eatKw('ON');
      const on = parseExpr();
      joins.push({ type: jt, table: tref, on });
    }

    let where = null;
    if (acceptKw('WHERE')) where = parseExpr();
    let groupBy = [];
    if (acceptKw('GROUP')) { eatKw('BY'); groupBy.push(parseExpr()); while (acceptOp(',')) groupBy.push(parseExpr()); }
    let having = null;
    if (acceptKw('HAVING')) having = parseExpr();
    let orderBy = [];
    if (acceptKw('ORDER')) { eatKw('BY'); do { const e = parseExpr(); let dir = 'ASC'; if (isKw('ASC')) { next(); } else if (isKw('DESC')) { next(); dir = 'DESC'; } orderBy.push({ expr: e, dir }); } while (acceptOp(',')); }
    let limit = null, offset = 0;
    if (acceptKw('LIMIT')) {
      if (cur().t === 'num') { limit = next().v; if (acceptKw('OFFSET') && cur().t === 'num') offset = next().v; }
      else throw new Error('LIMIT 后需为数字');
    }
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容：' + cur().v);
    return { kind: 'select', distinct, items, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  function parseTableRef() {
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    let alias = null;
    if (acceptKw('AS')) { if (cur().t === 'ident') alias = next().v; }
    else if (cur().t === 'ident' && !RESERVED.has(cur().v.toUpperCase())) alias = next().v;
    return { name, alias };
  }

  function parseInsert() {
    eatKw('INSERT'); eatKw('INTO');
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    const cols = [];
    if (acceptOp('(')) { if (cur().t !== 'ident') throw new Error('列名错误'); cols.push(next().v); while (acceptOp(',')) cols.push(next().v); eatOp(')'); }
    eatKw('VALUES');
    const rows = [];
    function parseRow() {
      eatOp('('); const vals = []; vals.push(parseValue()); while (acceptOp(',')) vals.push(parseValue()); eatOp(')'); return vals;
    }
    rows.push(parseRow());
    while (acceptOp(',')) rows.push(parseRow());
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容');
    return { kind: 'insert', table: name, cols, rows };
  }

  function parseUpdate() {
    eatKw('UPDATE');
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    eatKw('SET');
    const sets = [];
    function parseSet() {
      if (cur().t !== 'ident') throw new Error('SET 后缺少列名');
      const col = next().v; eatOp('='); const val = parseValue(); sets.push({ col, val });
    }
    parseSet();
    while (acceptOp(',')) parseSet();
    let where = null;
    if (acceptKw('WHERE')) where = parseExpr();
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容');
    return { kind: 'update', table: name, sets, where };
  }

  function parseDelete() {
    eatKw('DELETE'); eatKw('FROM');
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    let where = null;
    if (acceptKw('WHERE')) where = parseExpr();
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容');
    return { kind: 'delete', table: name, where };
  }

  function parseCreate() {
    eatKw('CREATE'); eatKw('TABLE');
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    eatOp('(');
    const cols = [];
    function parseCol() {
      if (cur().t !== 'ident') throw new Error('列名错误');
      const c = next().v;
      // 类型（忽略具体类型，仅占位）
      if (cur().t === 'ident') next();
      else if (cur().t === 'op' && cur().v === '(') { next(); while (cur().t !== 'op' || cur().v !== ')') next(); next(); }
      cols.push(c);
    }
    parseCol();
    while (acceptOp(',')) parseCol();
    eatOp(')');
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容');
    return { kind: 'create', table: name, cols };
  }

  function parseDrop() {
    eatKw('DROP'); eatKw('TABLE');
    if (cur().t !== 'ident') throw new Error('缺少表名');
    const name = next().v;
    if (cur().t !== 'eof') throw new Error('语句末尾存在多余内容');
    return { kind: 'drop', table: name };
  }
}

/* ---------- 求值 ---------- */
function resolveCol(row, name) {
  if (name.includes('.')) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  for (const k of Object.keys(row)) if (k.endsWith('.' + name)) return row[k];
  return undefined;
}
function toNum(v) { if (v === null || v === undefined || v === '') return 0; const n = Number(v); return isNaN(n) ? 0 : n; }
function truthy(v) { return v !== null && v !== undefined && v !== false && v !== 0 && v !== ''; }
function likeOp(v, pat) {
  if (v === null || v === undefined) return false;
  let s = String(v).toLowerCase();
  let p = String(pat).toLowerCase();
  let rx = '^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$';
  return new RegExp(rx).test(s);
}
function cmpOp(op, a, b) {
  let x = a, y = b;
  if (typeof x === 'number' && typeof y === 'number') { /* numeric */ }
  else { x = (x === null || x === undefined) ? '' : String(x); y = (y === null || y === undefined) ? '' : String(y); }
  switch (op) {
    case '=': return x === y;
    case '!=': case '<>': return x !== y;
    case '<': return x < y;
    case '>': return x > y;
    case '<=': return x <= y;
    case '>=': return x >= y;
  }
  return false;
}
function callFunc(name, args) {
  switch (name) {
    case 'ROUND': { const n = toNum(args[0]); const d = args.length > 1 ? args[1] : 0; const f = Math.pow(10, d); return Math.round(n * f) / f; }
    case 'ABS': return Math.abs(toNum(args[0]));
    case 'COALESCE': return args.find((a) => a !== null && a !== undefined) ?? null;
    case 'UPPER': return args[0] == null ? null : String(args[0]).toUpperCase();
    case 'LOWER': return args[0] == null ? null : String(args[0]).toLowerCase();
    case 'LENGTH': return args[0] == null ? null : String(args[0]).length;
    case 'CONCAT': return args.map((a) => (a == null ? '' : String(a))).join('');
    case 'YEAR': { const s = args[0]; return s == null ? null : parseInt(String(s).slice(0, 4), 10); }
    case 'MONTH': { const s = args[0]; if (!s) return null; const m = String(s).slice(5, 7); return m ? parseInt(m, 10) : null; }
    case 'SUBSTR': case 'SUBSTRING': { const s = args[0] == null ? '' : String(args[0]); const start = toNum(args[1]); const len = args.length > 2 ? toNum(args[2]) : undefined; return len != null ? s.substr(start - 1, len) : s.substr(start - 1); }
    default: throw new Error('不支持的函数：' + name);
  }
}
function evalExpr(node, row, groupRows) {
  switch (node.type) {
    case 'lit': return node.value;
    case 'col': return resolveCol(row, node.name);
    case 'unary':
      if (node.op === '-') return -toNum(evalExpr(node.expr, row, groupRows));
      if (node.op === 'NOT') return !truthy(evalExpr(node.expr, row, groupRows));
      return evalExpr(node.expr, row, groupRows);
    case 'bin': {
      const op = node.op;
      if (op === 'AND') return truthy(evalExpr(node.left, row, groupRows)) && truthy(evalExpr(node.right, row, groupRows));
      if (op === 'OR') return truthy(evalExpr(node.left, row, groupRows)) || truthy(evalExpr(node.right, row, groupRows));
      const l = evalExpr(node.left, row, groupRows);
      if (op === 'ISNULL') return (l === null || l === undefined) === node.isNull;
      if (op === 'LIKE') return likeOp(l, evalExpr(node.right, row, groupRows));
      if (op === 'IN') return node.list.some((v) => cmpOp('=', l, v.value));
      if (op === 'BETWEEN') return cmpOp('>=', l, evalExpr(node.low, row, groupRows)) && cmpOp('<=', l, evalExpr(node.high, row, groupRows));
      const r = evalExpr(node.right, row, groupRows);
      if (['=', '!=', '<>', '<', '>', '<=', '>='].includes(op)) return cmpOp(op, l, r);
      if (op === '+') return toNum(l) + toNum(r);
      if (op === '-') return toNum(l) - toNum(r);
      if (op === '*') return toNum(l) * toNum(r);
      if (op === '/') { const d = toNum(r); return d === 0 ? null : toNum(l) / d; }
      if (op === '%') { const d = toNum(r); return d === 0 ? null : toNum(l) % d; }
      throw new Error('未知运算符 ' + op);
    }
    case 'func': return callFunc(node.name, node.args.map((a) => evalExpr(a, row, groupRows)));
    case 'agg':
      return evalAgg(node, groupRows);
  }
  throw new Error('无法求值的表达式节点');
}
function evalAgg(node, groupRows) {
  if (node.fn === 'COUNT') {
    if (node.arg === '*') return groupRows.length;
    let cnt = 0;
    const seen = new Set();
    for (const r of groupRows) {
      const v = evalExpr(node.arg, r, groupRows);
      if (v !== null && v !== undefined) {
        if (node.distinct) { const k = JSON.stringify(v); if (seen.has(k)) continue; seen.add(k); }
        cnt++;
      }
    }
    return cnt;
  }
  const vals = [];
  const seen = new Set();
  for (const r of groupRows) {
    const v = evalExpr(node.arg, r, groupRows);
    if (v !== null && v !== undefined) {
      if (node.distinct) { const k = JSON.stringify(v); if (seen.has(k)) continue; seen.add(k); }
      vals.push(v);
    }
  }
  const nums = vals.map(toNum);
  switch (node.fn) {
    case 'SUM': return nums.reduce((a, b) => a + b, 0);
    case 'AVG': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'MIN': return vals.length ? (typeof vals[0] === 'number' ? Math.min(...nums) : Math.min(...vals.map(String))) : null;
    case 'MAX': return vals.length ? (typeof vals[0] === 'number' ? Math.max(...nums) : Math.max(...vals.map(String))) : null;
  }
  throw new Error('不支持的聚合函数 ' + node.fn);
}

/* ---------- 执行 ---------- */
function loadTable(ref, db) {
  const key = Object.keys(db).find((k) => k.toLowerCase() === ref.name.toLowerCase());
  if (!key) throw new Error('表不存在：' + ref.name);
  const t = db[key];
  const alias = (ref.alias || ref.name).toLowerCase();
  const out = [];
  for (const src of t.rows) {
    const row = {};
    for (const c of t.cols) {
      row[c] = src[c];
      row[alias + '.' + c] = src[c];
    }
    out.push(row);
  }
  return { rows: out, alias, tableName: key };
}

function buildJoinedRow(leftRow, rightMeta, rightSrc, joinType, matched) {
  const row = Object.assign({}, leftRow);
  const alias = rightMeta.alias;
  for (const c of rightMeta.cols) {
    if (matched) {
      row[c] = rightSrc[c];
      row[alias + '.' + c] = rightSrc[c];
    } else {
      row[c] = null;
      row[alias + '.' + c] = null;
    }
  }
  return row;
}

function executeSelect(ast, db) {
  const fromMeta = loadTable(ast.from, db);
  let rows = fromMeta.rows;

  for (const j of ast.joins) {
    const rightMetaRaw = loadTable(j.table, db);
    const rightMeta = { alias: (j.table.alias || j.table.name).toLowerCase(), cols: db[Object.keys(db).find((k) => k.toLowerCase() === j.table.name.toLowerCase())].cols, tableName: rightMetaRaw.tableName };
    const newRows = [];
    for (const lr of rows) {
      let matchedAny = false;
      for (const rr of rightMetaRaw.rows) {
        const combined = buildJoinedRow(lr, rightMeta, rr, j.type, true);
        if (truthy(evalExpr(j.on, combined, [combined]))) { newRows.push(combined); matchedAny = true; }
      }
      if (!matchedAny && (j.type === 'LEFT')) {
        newRows.push(buildJoinedRow(lr, rightMeta, {}, 'LEFT', false));
      }
      if (!matchedAny && (j.type === 'RIGHT')) {
        // RIGHT: 输出右表所有行，左表为 null
        for (const rr of rightMetaRaw.rows) {
          const combined = buildJoinedRow({}, rightMeta, rr, 'RIGHT', true);
          if (truthy(evalExpr(j.on, combined, [combined]))) newRows.push(combined);
        }
      }
    }
    rows = newRows;
  }

  if (ast.where) rows = rows.filter((r) => truthy(evalExpr(ast.where, r, [r])));

  const hasAgg = ast.items.some((it) => it.type === 'expr' && containsAgg(it.expr)) || ast.items.some((it) => it.type === 'star' && false);
  const grouping = ast.groupBy.length > 0;
  const needGroup = grouping || hasAgg;

  // 投影：确定每列的 outKey 与表头
  const columns = []; // {key, header}
  const headerCount = {};
  function registerHeader(h) { headerCount[h] = (headerCount[h] || 0) + 1; }
  function expandStar() {
    if (ast.joins.length === 0) {
      const t = db[fromMeta.tableName];
      for (const c of t.cols) {
        if (headerCount[c]) continue;
        columns.push({ key: c, header: c, expr: { type: 'col', name: c } });
        registerHeader(c);
      }
    } else {
      const sample = rows[0] || lastJoinedRow(ast, db);
      if (!sample) return;
      for (const k of Object.keys(sample)) {
        if (!k.includes('.')) continue;
        const bare = k.split('.').pop();
        const header = headerCount[bare] ? k : bare;
        columns.push({ key: k, header, expr: { type: 'col', name: k } });
        registerHeader(header);
      }
    }
  }
  for (const it of ast.items) {
    if (it.type === 'star') { expandStar(); continue; }
    let header = it.alias || exprText(it.expr);
    // 去掉可能重复
    while (headerCount[header]) header = header + '_';
    registerHeader(header);
    columns.push({ key: header, header, expr: it.expr });
  }

  // 生成中间结果（含 group 引用用于 HAVING）
  let inter = [];
  if (needGroup) {
    if (grouping) {
      const groups = new Map();
      for (const r of rows) {
        const key = ast.groupBy.map((g) => JSON.stringify(evalExpr(g, r, [r]))).join('\u0001');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      for (const grp of groups.values()) {
        inter.push(projectRow(grp[0], grp));
      }
    } else {
      inter.push(projectRow(rows[0] || {}, rows));
    }
  } else {
    for (const r of rows) inter.push(projectRow(r, [r]));
  }

  function projectRow(rep, grp) {
    const data = {};
    for (const col of columns) {
      if (col.expr) data[col.key] = evalExpr(col.expr, rep, grp);
    }
    return { data, group: grp };
  }

  if (ast.having) inter = inter.filter((it) => truthy(evalExpr(ast.having, Object.assign({}, it.group[0], it.data), it.group)));

  if (ast.orderBy.length) {
    inter.sort((a, b) => {
      for (const o of ast.orderBy) {
        const va = evalExpr(o.expr, a.data, a.group);
        const vb = evalExpr(o.expr, b.data, b.group);
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
        else cmp = String(va == null ? '' : va) < String(vb == null ? '' : vb) ? -1 : String(va == null ? '' : va) > String(vb == null ? '' : vb) ? 1 : 0;
        if (cmp !== 0) return o.dir === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  if (ast.distinct) {
    const seen = new Set();
    inter = inter.filter((it) => {
      const sig = JSON.stringify(columns.map((c) => it.data[c.key]));
      if (seen.has(sig)) return false; seen.add(sig); return true;
    });
  }

  if (ast.limit != null) inter = inter.slice(ast.offset, ast.offset + ast.limit);

  const outRows = inter.map((it) => columns.map((c) => it.data[c.key]));
  return { columns: columns.map((c) => c.header), rows: outRows, rowCount: outRows.length };
}

function lastJoinedRow(ast, db) {
  // 当结果为空且含 * 时用于推断列
  const fromMeta = loadTable(ast.from, db);
  let sample = Object.assign({}, fromMeta.rows[0] || {});
  for (const j of ast.joins) {
    const rt = db[Object.keys(db).find((k) => k.toLowerCase() === j.table.name.toLowerCase())];
    const ra = (j.table.alias || j.table.name).toLowerCase();
    const r0 = rt.rows[0] || {};
    for (const c of rt.cols) { sample[c] = null; sample[ra + '.' + c] = null; }
  }
  return sample;
}

function containsAgg(node) {
  if (!node) return false;
  if (node.type === 'agg') return true;
  if (node.type === 'bin') return containsAgg(node.left) || containsAgg(node.right) || (node.low && containsAgg(node.low)) || (node.high && containsAgg(node.high));
  if (node.type === 'unary') return containsAgg(node.expr);
  if (node.type === 'func') return node.args.some((a) => containsAgg(a));
  return false;
}

function exprText(node) {
  if (node.type === 'col') return node.name;
  if (node.type === 'lit') return node.value == null ? 'NULL' : (typeof node.value === 'number' ? String(node.value) : "'" + node.value + "'");
  if (node.type === 'agg') return node.fn + '(' + (node.arg === '*' ? '*' : exprText(node.arg)) + ')';
  if (node.type === 'func') return node.name + '(' + node.args.map((a) => exprText(a.expr !== undefined ? a.expr : a)).join(', ') + ')';
  if (node.type === 'unary') return node.op + exprText(node.expr);
  if (node.type === 'bin') {
    if (node.op === 'ISNULL') return exprText(node.left) + (node.isNull ? ' IS NULL' : ' IS NOT NULL');
    if (node.op === 'LIKE') return exprText(node.left) + ' LIKE ' + exprText(node.right);
    if (node.op === 'IN') return exprText(node.left) + ' IN (' + node.list.map((v) => exprText(v)).join(', ') + ')';
    if (node.op === 'BETWEEN') return exprText(node.left) + ' BETWEEN ' + exprText(node.low) + ' AND ' + exprText(node.high);
    return exprText(node.left) + ' ' + node.op + ' ' + exprText(node.right);
  }
  return '?';
}

function executeDML(ast, db) {
  if (ast.kind === 'create') {
    if (db[ast.table]) throw new Error('表已存在：' + ast.table);
    db[ast.table] = { cols: ast.cols, rows: [] };
    return { columns: ['操作'], rows: [['CREATE TABLE']], rowCount: 0, message: `已创建表 ${ast.table}` };
  }
  if (ast.kind === 'drop') {
    if (!db[ast.table]) throw new Error('表不存在：' + ast.table);
    delete db[ast.table];
    return { columns: ['操作'], rows: [['DROP TABLE']], rowCount: 0, message: `已删除表 ${ast.table}` };
  }
  const key = Object.keys(db).find((k) => k.toLowerCase() === ast.table.toLowerCase());
  if (!key) throw new Error('表不存在：' + ast.table);
  const t = db[key];
  if (ast.kind === 'insert') {
    let affected = 0;
    for (const vals of ast.rows) {
      if (ast.cols.length !== vals.length) throw new Error('列数与值数量不一致');
      const row = {};
      for (let i = 0; i < t.cols.length; i++) row[t.cols[i]] = null;
      ast.cols.forEach((c, i) => { row[c] = vals[i].value; });
      // 自动补 id
      const idCol = t.cols.find((c) => /id$/i.test(c));
      if (idCol && (row[idCol] === null || row[idCol] === undefined)) {
        const maxId = t.rows.reduce((m, r) => Math.max(m, Number(r[idCol]) || 0), 0);
        row[idCol] = maxId + 1;
      }
      t.rows.push(row);
      affected++;
    }
    return { columns: [], rows: [], rowCount: affected, message: `已插入 ${affected} 行` };
  }
  if (ast.kind === 'update' || ast.kind === 'delete') {
    let affected = 0;
    for (const r of t.rows) {
      const hit = ast.where ? truthy(evalExpr(ast.where, r, [r])) : true;
      if (!hit) continue;
      if (ast.kind === 'update') { for (const s of ast.sets) r[s.col] = s.val.value; }
      else { r.__deleted = true; }
      affected++;
    }
    if (ast.kind === 'delete') t.rows = t.rows.filter((r) => !r.__deleted);
    const op = ast.kind === 'update' ? 'UPDATE' : 'DELETE';
    return { columns: [], rows: [], rowCount: affected, message: `已${ast.kind === 'update' ? '更新' : '删除'} ${affected} 行` };
  }
}

function runSQL(sql, db) {
  const ast = parse(sql);
  if (ast.kind === 'select') return executeSelect(ast, db);
  return executeDML(ast, db);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildDB, runSQL, tokenize, parse };
}

/* ======================== 测试 ======================== */
if (require.main === module) {
  const db = buildDB();
  const tests = [
    "SELECT * FROM vouchers LIMIT 3",
    "SELECT vid, date, amount FROM vouchers WHERE amount > 100000 ORDER BY amount DESC LIMIT 5",
    "SELECT dept_id, direction, SUM(amount) AS total FROM vouchers GROUP BY dept_id, direction ORDER BY dept_id, direction",
    "SELECT acc_code, COUNT(*) AS cnt, SUM(amount) AS amt FROM vouchers GROUP BY acc_code ORDER BY amt DESC",
    "SELECT d.dept_name, SUM(v.amount) AS expense FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id WHERE v.acc_code = '6601' GROUP BY d.dept_name ORDER BY expense DESC",
    "SELECT * FROM vouchers WHERE summary LIKE '%应收%' LIMIT 5",
    "SELECT * FROM vouchers WHERE dept_id IN (1,2,3) AND direction = '借' LIMIT 3",
    "SELECT * FROM vouchers WHERE amount BETWEEN 50000 AND 60000 LIMIT 3",
    "SELECT dept_id, COUNT(*) AS cnt FROM vouchers GROUP BY dept_id HAVING COUNT(*) > 100",
    "SELECT DISTINCT acc_type FROM accounts",
    "SELECT YEAR(date) AS yr, MONTH(date) AS mo, SUM(amount) AS revenue FROM vouchers WHERE acc_code = '6001' AND direction = '贷' GROUP BY YEAR(date), MONTH(date) ORDER BY yr, mo",
    "SELECT c.cust_name, SUM(v.amount) AS ar FROM vouchers v JOIN customers c ON v.cust_id = c.cust_id WHERE v.acc_code = '1122' AND v.direction = '借' GROUP BY c.cust_name ORDER BY ar DESC",
    "SELECT d.dept_name, b.month, SUM(v.amount) AS actual FROM vouchers v JOIN departments d ON v.dept_id = d.dept_id JOIN budgets b ON b.dept_id = v.dept_id AND b.month = SUBSTR(v.date,1,7) AND b.acc_code = v.acc_code WHERE v.acc_code = '6601' GROUP BY d.dept_name, b.month ORDER BY d.dept_name, b.month LIMIT 6",
  ];
  let pass = 0;
  for (const t of tests) {
    try {
      const r = runSQL(t, db);
      console.log('✓', t.slice(0, 70));
      console.log('   cols:', r.columns.join(', '), '| rows:', r.rowCount);
      if (r.rows[0]) console.log('   sample:', JSON.stringify(r.rows[0]).slice(0, 160));
      pass++;
    } catch (e) {
      console.log('✗', t.slice(0, 70), '\n   错误:', e.message);
    }
  }
  console.log(`\n通过 ${pass}/${tests.length}`);
}
