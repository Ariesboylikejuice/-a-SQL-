/* ==========================================================================
 * 题库：13 道真实工单
 * 每个任务含：场景（谁在问）、要求（交付什么）、提示（坑在哪）、参考答案
 * ========================================================================== */

const CLEAN = `WITH clean AS (
  SELECT DISTINCT bill_no, bill_date, cust_code, sku, qty, unit_price, discount, tax_rate
  FROM fact_sales
)`;

const TASKS = [
  /* ---------------- 阶段一：数据体检 ---------------- */
  {
    id: 'T01', stage: '数据体检', title: '单据重复录入排查',
    scene: 'IT 说上月系统升级时导过一次数据，有人反映"重导了一遍"。你打开销售明细，同一张单据好像出现了两次。',
    ask: '找出"整行完全重复"的记录（同一单据号、同客户、同产品、同数量、同单价、同折扣出现多次）。注意：一张单据本来就有多行不同产品，那不算重复。',
    cols: ['bill_no', 'cust_code', 'sku', 'qty', 'unit_price', 'discount', '重复次数'],
    hint: 'GROUP BY 要把"能唯一确定一行"的字段全带上；HAVING 筛出计数大于 1 的组。',
    answer: `SELECT bill_no, cust_code, sku, qty, unit_price, discount, COUNT(*) AS 重复次数
FROM fact_sales
GROUP BY bill_no, cust_code, sku, qty, unit_price, discount
HAVING COUNT(*) > 1
ORDER BY 重复次数 DESC, bill_no
LIMIT 20;`
  },
  {
    id: 'T02', stage: '数据体检', title: '一客多码（重复建档）',
    scene: '业务员抱怨客户档案里"同一个客户有两个编码"，导致同一个客户的销售额被拆成两半。',
    ask: '找出名称相同、却有多个客户编码的客户。客户名有前后空格，必须先去空格再分组。',
    cols: ['客户名称', '编码数'],
    hint: 'TRIM() 去空格。GROUP BY 里也要用 TRIM 后的表达式，不能 GROUP BY 原字段。',
    answer: `SELECT TRIM(cust_name) AS 客户名称, COUNT(*) AS 编码数
FROM dim_customer
GROUP BY TRIM(cust_name)
HAVING COUNT(*) > 1
ORDER BY 客户名称;`
  },
  {
    id: 'T03', stage: '数据体检', title: '清洗前后客户数对比',
    scene: '你想知道客户主数据到底有多少"水分"。',
    ask: '统计：原始客户档案有多少行？去掉名称空格后去重，真实客户有多少个？',
    cols: ['原始行数', '去重客户数'],
    hint: 'COUNT(*) 数行数，COUNT(DISTINCT TRIM(cust_name)) 数去重后的真实客户。',
    answer: `SELECT COUNT(*) AS 原始行数,
       COUNT(DISTINCT TRIM(cust_name)) AS 去重客户数
FROM dim_customer;`
  },

  /* ---------------- 阶段二：口径与聚合 ---------------- */
  {
    id: 'T04', stage: '口径与聚合', title: '月度收入趋势（正确处理脏数据）',
    scene: '总监要看近两年的收入走势，准备放进月度经营会材料。',
    ask: '按月汇总销售收入（万元，保留 1 位小数），按月份升序。三个坑：① 重复单据要先去掉；② 退货是负数，要冲减收入；③ 3% 的日期写成 2026/10/05 这种斜杠格式，也要能正确归月。',
    cols: ['月份', '收入万元'],
    hint: '去重用 SELECT DISTINCT 子查询；日期用 REPLACE(bill_date,\'/\',\'-\') 统一格式后取前 7 位；折扣有 NULL，用 COALESCE(discount,0)。',
    answer: `${CLEAN}
SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
       ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 收入万元
FROM clean
GROUP BY 月份
ORDER BY 月份;`
  },
  {
    id: 'T05', stage: '口径与聚合', title: '退货情况分析',
    scene: '质量部问：退货到底影响多少收入？是不是集中在某几个月？',
    ask: '按月统计退货行数和退货金额（万元，正数表示退货金额）。',
    cols: ['月份', '退货行数', '退货金额万元'],
    hint: '数量为负就是退货。金额取绝对值或加负号，让报表读起来是"退货 12.3 万"而不是"-12.3 万"。',
    answer: `${CLEAN}
SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
       COUNT(*) AS 退货行数,
       ROUND(SUM(-qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 退货金额万元
FROM clean
WHERE qty < 0
GROUP BY 月份
ORDER BY 月份;`
  },
  {
    id: 'T06', stage: '口径与聚合', title: '分区域毛利率',
    scene: '老板问："哪个大区最赚钱？"你不能只报收入，得报毛利率。',
    ask: '按客户所在区域汇总：收入（万元）、毛利率（%，保留 2 位）。毛利率 =（收入 - 标准成本）÷ 收入。按收入降序。',
    cols: ['区域', '收入万元', '毛利率'],
    hint: '需要 JOIN：fact_sales 关联 dim_customer 拿区域、关联 dim_product 拿 std_cost。成本用 qty * std_cost。',
    answer: `${CLEAN}
SELECT c.region AS 区域,
       ROUND(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) / 10000, 1) AS 收入万元,
       ROUND((SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) - SUM(s.qty * p.std_cost))
             / SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) * 100, 2) AS 毛利率
FROM clean s
JOIN dim_customer c ON s.cust_code = c.cust_code
JOIN dim_product p ON s.sku = p.sku
GROUP BY c.region
ORDER BY 收入万元 DESC;`
  },

  /* ---------------- 阶段三：多表连接与账表核对 ---------------- */
  {
    id: 'T07', stage: '多表连接', title: '账表核对：明细与总账差额',
    scene: '财务最经典的一问：销售明细汇总的收入，和总账 6001 科目的贷方发生额对不上。差额本身就是线索——它一般就是重复导入、漏记或跨期。',
    ask: '查 2026-10 一个月：明细收入、总账收入、差额（明细 - 总账），单位元。注意这里明细侧**不要**先去重，否则你永远发现不了差额。',
    cols: ['月份', '明细收入', '总账收入', '差额'],
    hint: '明细侧直接从 fact_sales 汇总（保留重复），总账侧取 fact_gl 中 acc_code=\'6001\' 的 credit 合计。两个子查询直接 SELECT ... FROM m, g 拼一行即可。差出来的钱，回头用 T01 的办法查是哪几张单重复了。',
    answer: `WITH m AS (
  SELECT ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))), 0) AS 明细收入
  FROM fact_sales
  WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10'
),
g AS (
  SELECT ROUND(SUM(credit), 0) AS 总账收入
  FROM fact_gl
  WHERE acc_code = '6001' AND period = '2026-10'
)
SELECT '2026-10' AS 月份, m.明细收入, g.总账收入, m.明细收入 - g.总账收入 AS 差额
FROM m, g;`
  },
  {
    id: 'T08', stage: '多表连接', title: '费用预算执行差异',
    scene: '月结后要出"预算执行分析表"，超支的部门要被叫去解释。',
    ask: '查 2026-10 各部门的预算数、实际发生数、差异额、差异率（%），按差异率从高到低。单位万元，保留 1 位小数。',
    cols: ['部门', '预算万元', '实际万元', '差异率'],
    hint: '三表连接：dim_budget + fact_gl（on 期间 AND 部门 AND 科目）+ dim_dept 拿部门名。实际数用 debit。差异率 =（实际-预算）/预算×100。',
    answer: `SELECT d.dept_name AS 部门,
       ROUND(SUM(b.budget_amt) / 10000, 1) AS 预算万元,
       ROUND(SUM(g.debit) / 10000, 1) AS 实际万元,
       ROUND((SUM(g.debit) - SUM(b.budget_amt)) / SUM(b.budget_amt) * 100, 1) AS 差异率
FROM dim_budget b
JOIN fact_gl g ON b.period = g.period AND b.dept_id = g.dept_id AND b.acc_code = g.acc_code
JOIN dim_dept d ON d.dept_id = b.dept_id
WHERE b.period = '2026-10'
GROUP BY d.dept_name
ORDER BY 差异率 DESC;`
  },
  {
    id: 'T09', stage: '多表连接', title: '应收账龄分档',
    scene: '快照日 2026-10-31，要给老板一张账龄表，判断有多少钱可能收不回来。',
    ask: '把未收款的发票（amount - settled_amt > 0）分成：未到期、1-30 天、31-90 天、90 天以上四档，统计笔数和未收金额（万元，保留 1 位）。',
    cols: ['账龄区间', '笔数', '未收万元'],
    hint: '逾期天数 = julianday(快照日) - julianday(due_date)。用 CASE WHEN 分档。快照日直接写 \'2026-10-31\'。',
    answer: `SELECT CASE
         WHEN julianday('2026-10-31') - julianday(due_date) <= 0 THEN '未到期'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 30 THEN '1-30天'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 90 THEN '31-90天'
         ELSE '90天以上'
       END AS 账龄区间,
       COUNT(*) AS 笔数,
       ROUND(SUM(amount - settled_amt) / 10000, 1) AS 未收万元
FROM fact_ar
WHERE amount - settled_amt > 0
GROUP BY 账龄区间
ORDER BY 账龄区间;`
  },

  /* ---------------- 阶段四：窗口函数 ---------------- */
  {
    id: 'T10', stage: '窗口函数', title: '各区域收入环比',
    scene: '经营会上最常被问的一句："这个月比上月怎么样？"',
    ask: '按区域、月份列出收入（万元）、上月收入（万元）、环比增长率（%，保留 2 位）。按区域、月份排序。',
    cols: ['区域', '月份', '收入万元', '上月收入万元', '环比'],
    hint: 'LAG(收入) OVER (PARTITION BY 区域 ORDER BY 月份)。窗口函数不能直接嵌套聚合，要先用子查询算出月度收入，外层再套 LAG。',
    answer: `${CLEAN},
m AS (
  SELECT substr(REPLACE(s.bill_date, '/', '-'), 1, 7) AS 月份,
         c.region AS 区域,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 收入
  FROM clean s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  GROUP BY 月份, 区域
)
SELECT 区域, 月份,
       ROUND(收入 / 10000, 1) AS 收入万元,
       ROUND(LAG(收入) OVER (PARTITION BY 区域 ORDER BY 月份) / 10000, 1) AS 上月收入万元,
       ROUND((收入 - LAG(收入) OVER (PARTITION BY 区域 ORDER BY 月份))
             / LAG(收入) OVER (PARTITION BY 区域 ORDER BY 月份) * 100, 2) AS 环比
FROM m
ORDER BY 区域, 月份;`
  },
  {
    id: 'T11', stage: '窗口函数', title: '客户收入帕累托（80/20）',
    scene: '你想证明"少数客户贡献大部分收入"，好跟老板要资源维护大客户。',
    ask: '按收入从高到低列出前 15 个客户：收入（万元）、累计收入占比（%，保留 2 位）。',
    cols: ['cust_code', '收入万元', '累计占比'],
    hint: '两层窗口：SUM(收入) OVER (ORDER BY 收入 DESC, cust_code) 算累计，SUM(收入) OVER () 算总额。排序要加 cust_code 兜底，否则金额相同的行顺序不定，累计值会跳。',
    answer: `${CLEAN},
c AS (
  SELECT cust_code, SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS 收入
  FROM clean GROUP BY cust_code
),
r AS (
  SELECT cust_code, 收入,
         SUM(收入) OVER (ORDER BY 收入 DESC, cust_code) AS 累计,
         SUM(收入) OVER () AS 总额
  FROM c
)
SELECT cust_code,
       ROUND(收入 / 10000, 1) AS 收入万元,
       ROUND(累计 / 总额 * 100, 2) AS 累计占比
FROM r
ORDER BY 收入 DESC, cust_code
LIMIT 15;`
  },
  {
    id: 'T12', stage: '窗口函数', title: '每个客户的最近一笔订单',
    scene: '要做客户回访，得知道每个客户最后一次下单是什么时候、哪张单。',
    ask: '列出 128 个客户各自的最近一笔单据号与日期，按最近日期降序取前 10 条。',
    cols: ['cust_code', '客户', '最近单据', '最近日期'],
    hint: 'ROW_NUMBER() OVER (PARTITION BY cust_code ORDER BY 日期 DESC, bill_no DESC) 打序号，外层筛 rn = 1。日期有斜杠格式，排序前先 REPLACE 统一。',
    answer: `WITH clean AS (
  SELECT DISTINCT bill_no, bill_date, cust_code FROM fact_sales
),
r AS (
  SELECT cust_code, bill_no,
         REPLACE(bill_date, '/', '-') AS d,
         ROW_NUMBER() OVER (
           PARTITION BY cust_code
           ORDER BY REPLACE(bill_date, '/', '-') DESC, bill_no DESC
         ) AS rn
  FROM clean
)
SELECT r.cust_code, TRIM(dc.cust_name) AS 客户, r.bill_no AS 最近单据, r.d AS 最近日期
FROM r
JOIN dim_customer dc ON dc.cust_code = r.cust_code
WHERE r.rn = 1
ORDER BY r.d DESC, r.bill_no DESC
LIMIT 10;`
  },

  /* ---------------- 阶段五：真实工单 ---------------- */
  {
    id: 'T13', stage: '真实工单', title: '【核心工单】10 月毛利率异常定位',
    scene: '总监把报表拍在你桌上："华东 10 月毛利率比 9 月掉了 8 个点，你给我找出是哪几个客户干的。"这是你在这套数据里要交的最终答卷。',
    ask: '在华东区、同时在 9 月和 10 月都有销售的客户中，算出各自两个月毛利率，按毛利率降幅（10 月 - 9 月）从小到大排，取前 8 个。',
    cols: ['客户', '九月毛利率', '十月毛利率', '降幅'],
    hint: '思路：先按 客户×月份 聚合出收入和成本 → 用 CASE WHEN + MAX 把两个月横向摊成两列（行转列）→ 再相减排序。注意一客多码：分组要用 TRIM(cust_name) 而不是 cust_code。',
    answer: `${CLEAN},
m AS (
  SELECT TRIM(c.cust_name) AS 客户,
         substr(REPLACE(s.bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 收入,
         SUM(s.qty * p.std_cost) AS 成本
  FROM clean s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  JOIN dim_product p ON s.sku = p.sku
  WHERE c.region = '华东'
    AND substr(REPLACE(s.bill_date, '/', '-'), 1, 7) IN ('2026-09', '2026-10')
  GROUP BY 客户, 月份
),
p AS (
  SELECT 客户,
         MAX(CASE WHEN 月份 = '2026-09' THEN ROUND((收入 - 成本) / 收入 * 100, 2) END) AS 九月毛利率,
         MAX(CASE WHEN 月份 = '2026-10' THEN ROUND((收入 - 成本) / 收入 * 100, 2) END) AS 十月毛利率
  FROM m
  GROUP BY 客户
)
SELECT 客户, 九月毛利率, 十月毛利率,
       ROUND(十月毛利率 - 九月毛利率, 2) AS 降幅
FROM p
WHERE 九月毛利率 IS NOT NULL AND 十月毛利率 IS NOT NULL
ORDER BY 降幅 ASC
LIMIT 8;`
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TASKS };
}
