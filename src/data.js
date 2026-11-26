/* ==========================================================================
 * 数据生成器 —— 确定性（同一 seed 每次生成完全相同的数据）
 * 设计目标：模拟一套真实但"脏"的财务数据仓库
 * ========================================================================== */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCHEMA = `
CREATE TABLE dim_customer (
  cust_code    TEXT PRIMARY KEY,
  cust_name    TEXT,
  industry     TEXT,
  region       TEXT,
  sales_owner  TEXT,
  credit_limit REAL,
  onboard_date TEXT
);
CREATE TABLE dim_product (
  sku       TEXT PRIMARY KEY,
  sku_name  TEXT,
  category  TEXT,
  std_cost  REAL,
  list_price REAL
);
CREATE TABLE dim_dept (
  dept_id     INTEGER PRIMARY KEY,
  dept_name   TEXT,
  cost_center TEXT
);
CREATE TABLE fact_sales (
  bill_no    TEXT,
  bill_date  TEXT,
  cust_code  TEXT,
  sku        TEXT,
  qty        REAL,
  unit_price REAL,
  discount   REAL,
  tax_rate   REAL
);
CREATE TABLE fact_gl (
  voucher_no TEXT,
  post_date  TEXT,
  period     TEXT,
  acc_code   TEXT,
  acc_name   TEXT,
  dept_id    INTEGER,
  debit      REAL,
  credit     REAL,
  summary    TEXT
);
CREATE TABLE dim_budget (
  period     TEXT,
  dept_id    INTEGER,
  acc_code   TEXT,
  budget_amt REAL
);
CREATE TABLE fact_ar (
  cust_code     TEXT,
  invoice_no    TEXT,
  invoice_date  TEXT,
  due_date      TEXT,
  amount        REAL,
  settled_amt   REAL,
  snapshot_date TEXT
);
`;

const REGIONS = ['华东', '华北', '华南', '西南', '华中'];
const INDUSTRIES = ['制造业', '零售', '贸易', '服务业', '互联网', '医疗', '建筑', '教育'];
const OWNERS = ['叶青', '李晖', '王振', '陈曦', '周瑞', '孙莉'];
const BASE_NAMES = ['恒晟实业', '鼎和科技', '中远物流', '嘉禾食品', '启明电子',
  '泰和制药', '华翔建材', '新域传媒', '睿达能源', '远方教育',
  '博纳医疗', '天成机械', '联信通信', '金桥商贸', '紫光数据',
  '恒信汽车', '安居地产', '瑞丰农业', '星辰文旅', '海川环保'];
const SUFFIX_PAIRS = [
  { suf: '(华东)', region: '华东' }, { suf: '(华北)', region: '华北' },
  { suf: '(华南)', region: '华南' }, { suf: '(西南)', region: '西南' },
  { suf: '(华中)', region: '华中' }, { suf: '(总部)', region: '华东' }
];

const CATEGORIES = [
  { cat: '服务器', costRate: 0.72, price: 42000 },
  { cat: '网络设备', costRate: 0.65, price: 18000 },
  { cat: '存储设备', costRate: 0.70, price: 32000 },
  { cat: '软件授权', costRate: 0.28, price: 26000 },
  { cat: '技术服务', costRate: 0.45, price: 12000 },
  { cat: '云服务', costRate: 0.52, price: 9000 },
  { cat: '耗材', costRate: 0.58, price: 1200 },
  { cat: '配件', costRate: 0.62, price: 2600 }
];

const DEPTS = [
  { id: 1, name: '销售一部', cc: 'CC1001' },
  { id: 2, name: '销售二部', cc: 'CC1002' },
  { id: 3, name: '销售三部', cc: 'CC1003' },
  { id: 4, name: '市场部', cc: 'CC2001' },
  { id: 5, name: '财务部', cc: 'CC3001' },
  { id: 6, name: '行政人事部', cc: 'CC3002' },
  { id: 7, name: '研发中心', cc: 'CC4001' },
  { id: 8, name: '客户服务部', cc: 'CC5001' }
];

const GL_ACCOUNTS = [
  { code: '6001', name: '主营业务收入', dir: 'credit' },
  { code: '6401', name: '主营业务成本', dir: 'debit' },
  { code: '6601', name: '销售费用', dir: 'debit' },
  { code: '6602', name: '管理费用', dir: 'debit' },
  { code: '6603', name: '财务费用', dir: 'debit' },
  { code: '6604', name: '研发费用', dir: 'debit' }
];

// 22 个月：2025-01 ~ 2026-10
const PERIODS = (() => {
  const out = [];
  for (let y = 2025; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 10) break;
      out.push(y + '-' + String(m).padStart(2, '0'));
    }
  }
  return out;
})();

function periodOf(dateStr) {
  return String(dateStr).slice(0, 7).replace('/', '-');
}

function buildData() {
  const rng = mulberry32(20261126);
  const rand = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const rnd = (a, b) => a + rng() * (b - a);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  /* ---------- 客户主数据：120 正常 + 8 组一客多码 ---------- */
  const customers = [];
  let codeSeq = 1001;
  BASE_NAMES.forEach((base, bi) => {
    SUFFIX_PAIRS.forEach((sp) => {
      customers.push({
        cust_code: 'C' + (codeSeq++),
        cust_name: base + sp.suf,
        industry: pick(INDUSTRIES),
        region: sp.region,
        sales_owner: pick(OWNERS),
        credit_limit: rand(20, 200) * 10000,
        onboard_date: `${rand(2019, 2025)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
      });
    });
  });
  // 脏化：34% 的名称带尾随空格 / 全角括号
  customers.forEach((c, i) => {
    if (i % 3 === 0) c.cust_name = c.cust_name + ' ';
    else if (i % 7 === 0) c.cust_name = c.cust_name.replace('(', '（').replace(')', '）');
  });
  // 一客多码：复制 8 个客户，编码不同但名称完全相同（必须在脏化之后复制，保持名称一致）
  const dupSrc = [3, 17, 41, 58, 66, 79, 92, 110];
  dupSrc.forEach((i) => {
    const c = customers[i];
    customers.push({ ...c, cust_code: 'C' + (codeSeq++), sales_owner: pick(OWNERS) });
  });

  /* ---------- 产品 ---------- */
  const products = [];
  let skuSeq = 1;
  CATEGORIES.forEach((c) => {
    const n = rand(6, 9);
    for (let i = 0; i < n; i++) {
      const list = Math.round(c.price * rnd(0.85, 1.2) / 10) * 10;
      products.push({
        sku: 'SKU' + String(skuSeq++).padStart(4, '0'),
        sku_name: c.cat + '-' + String.fromCharCode(65 + i) + '型',
        category: c.cat,
        std_cost: Math.round(list * c.costRate * 100) / 100,
        list_price: list
      });
    }
  });

  /* ---------- 销售明细 ---------- */
  // 埋点 A：这 4 个华东大客户从 2026-09 起折扣异常放大，导致 10 月区域毛利率下滑
  const promoCustomers = customers.filter((c) => c.region === '华东' && c.cust_name.indexOf('总部') < 0)
    .slice(0, 4).map((c) => c.cust_code);
  const promoPool = customers.filter((c) => promoCustomers.indexOf(c.cust_code) >= 0);
  // 埋点 B：这 3 个客户 2026-08 之后不再下单（流失）
  const churnCustomers = customers.filter((c) => c.region === '华北').slice(0, 3).map((c) => c.cust_code);

  const sales = [];
  let billSeq = 1;
  PERIODS.forEach((period) => {
    const [y, m] = period.split('-').map(Number);
    const monthIdx = (y - 2025) * 12 + m;
    // 季节性 + 增长趋势
    let billCount = Math.round(340 * (0.9 + 0.02 * monthIdx) * rnd(0.92, 1.08));

    const makeBill = (fixedCust) => {
      const cust = fixedCust || (rng() < 0.10 ? pick(promoPool) : pick(customers));
      const day = rand(1, 28);
      // 脏化 D：3% 的日期写成 YYYY/MM/DD
      const dateStr = rng() < 0.03
        ? `${y}/${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}`
        : `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const billNo = 'SO' + y + String(m).padStart(2, '0') + String(billSeq++).padStart(5, '0');

      const lines = rand(1, 5);
      for (let l = 0; l < lines; l++) {
        const p = pick(products);
        let qty = rand(1, 40);
        let disc = Math.round(rnd(0, 0.15) * 100) / 100;

        // 埋点 A 生效：这些客户 2026-10 起折扣异常放大（9 月还是正常价）
        if (period >= '2026-10' && promoCustomers.indexOf(cust.cust_code) >= 0) {
          disc = Math.round(rnd(0.32, 0.42) * 100) / 100;
        }
        // 埋点 B 生效：流失客户 2026-09 起不再出现
        if (period >= '2026-09' && churnCustomers.indexOf(cust.cust_code) >= 0) continue;

        // 脏化 C：1.6% 的行是部分退货（负数，20%~60% 的量退回）
        if (rng() < 0.016) qty = -Math.max(1, Math.round(Math.abs(qty) * rnd(0.2, 0.6)));
        // 脏化 E：3% 的折扣为 NULL
        const discount = rng() < 0.03 ? null : disc;
        const tax_rate = p.category === '技术服务' ? 0.06 : 0.13;

        sales.push({
          bill_no: billNo,
          bill_date: dateStr,
          cust_code: cust.cust_code,
          sku: p.sku,
          qty,
          unit_price: Math.round(p.list_price * rnd(0.95, 1.05) * 100) / 100,
          discount,
          tax_rate
        });
      }
    };

    // 保证促销客户从 2026-08 起每月都有稳定单量，异常才能被稳定复现
    if (period >= '2026-08') {
      promoPool.forEach((pc) => { for (let k = 0; k < 6; k++) makeBill(pc); });
    }
    for (let b = 0; b < billCount; b++) makeBill(null);
  });

  // 脏化 F：近两个月有 40 张单据被重复导入（这才是"账表对不上"的真实原因）
  const dupBills = new Set();
  const recent = sales.filter((r) => ['2026-09', '2026-10'].indexOf(periodOf(r.bill_date)) >= 0);
  for (let i = 0; i < 60; i++) dupBills.add(recent[rand(0, recent.length - 1)].bill_no);
  const dupRows = sales.filter((r) => dupBills.has(r.bill_no));
  const allSales = sales.concat(dupRows);

  /* ---------- 总账凭证（收入/成本与销售明细对账一致）---------- */
  // 按"去重后的明细"汇总每月真实收入与成本，写入总账
  const costOf = {};
  products.forEach((p) => { costOf[p.sku] = p.std_cost; });
  const monthRev = {};
  const monthCost = {};
  const seen = new Set();
  sales.forEach((r) => {
    const key = [r.bill_no, r.cust_code, r.sku, r.qty, r.unit_price, r.discount].join('|');
    if (seen.has(key)) return; // 去重，总账只认正确数
    seen.add(key);
    const p = periodOf(r.bill_date);
    const rev = r.qty * r.unit_price * (1 - (r.discount === null ? 0 : r.discount));
    monthRev[p] = (monthRev[p] || 0) + rev;
    monthCost[p] = (monthCost[p] || 0) + r.qty * (costOf[r.sku] || 0);
  });

  const gl = [];
  let vSeq = 1;
  PERIODS.forEach((period) => {
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const postDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const rev = monthRev[period] || 0;
    const cogs = monthCost[period] || 0;
    const revSplit = [0.42, 0.34, 0.24]; // 销售一部/二部/三部
    const costSplit = [0.42, 0.34, 0.24];

    DEPTS.forEach((d) => {
      GL_ACCOUNTS.forEach((acc) => {
        let amt = 0;
        if (acc.code === '6001') {
          if (d.id > 3) return;
          amt = Math.round(rev * revSplit[d.id - 1]);
        } else if (acc.code === '6401') {
          if (d.id > 3) return;
          amt = Math.round(cogs * costSplit[d.id - 1]);
        } else {
          const base = acc.code === '6604' ? rnd(30, 70) * 10000 : rnd(10, 35) * 10000;
          amt = Math.round(base * (0.9 + 0.01 * ((y - 2025) * 12 + m)));
        }
        gl.push({
          voucher_no: 'PZ' + period.replace('-', '') + String(vSeq++).padStart(4, '0'),
          post_date: postDate,
          period,
          acc_code: acc.code,
          acc_name: acc.name,
          dept_id: d.id,
          debit: acc.dir === 'debit' ? amt : 0,
          credit: acc.dir === 'credit' ? amt : 0,
          summary: period + ' ' + acc.name + ' 结转'
        });
      });
    });
  });

  /* ---------- 预算（围绕实际倒推，差异控制在 ±15% 内）---------- */
  const budget = [];
  gl.forEach((g) => {
    if (['6601', '6602', '6603', '6604'].indexOf(g.acc_code) < 0) return;
    let amt = Math.round(g.debit * rnd(0.88, 1.12));
    // 埋点 C：客户服务部 2026 年管理费用预算被砍 45%，实际必然超支
    if (g.dept_id === 8 && g.acc_code === '6602' && g.period >= '2026-01') {
      amt = Math.round(amt * 0.55);
    }
    budget.push({ period: g.period, dept_id: g.dept_id, acc_code: g.acc_code, budget_amt: amt });
  });

  /* ---------- 应收发票 ---------- */
  const ar = [];
  let invSeq = 1;
  PERIODS.forEach((period, pIdx) => {
    const [y, m] = period.split('-').map(Number);
    const n = rand(90, 130);
    const ageMonths = (PERIODS.length - 1) - pIdx; // 距快照的月数
    for (let i = 0; i < n; i++) {
      const cust = pick(customers);
      const day = rand(1, 28);
      const invDate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const due = new Date(y, m - 1, day + 60);
      const amount = Math.round(rnd(3, 90) * 10000);
      // 账期 60 天：头两个月基本未收，之后收回概率快速上升 → 账龄分布接近真实
      const paidProb = ageMonths < 2 ? 0.08 : Math.min(0.97, 0.08 + (ageMonths - 1) * 0.13);
      let paid;
      if (rng() < paidProb) paid = amount;
      else if (rng() < 0.45) paid = 0;
      else paid = Math.round(amount * rnd(0.15, 0.85));
      ar.push({
        cust_code: cust.cust_code,
        invoice_no: 'INV' + String(invSeq++).padStart(7, '0'),
        invoice_date: invDate,
        due_date: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`,
        amount,
        settled_amt: paid,
        snapshot_date: '2026-10-31'
      });
    }
  });

  return {
    customers,
    products,
    sales: allSales,
    gl,
    budget,
    ar,
    depts: DEPTS.map((d) => ({ dept_id: d.id, dept_name: d.name, cost_center: d.cc }))
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildData, SCHEMA, PERIODS };
}
