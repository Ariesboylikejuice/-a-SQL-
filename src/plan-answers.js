/* 45 天练习的参考答案与解析
   ans  : 可直接在练习台运行的 SQL 数组，test/verify-plan.mjs 会逐条执行验证
   task : 引用 tasks.js 里某道题的官方答案（单点维护，避免和练习台答案不一致）
   exp  : 解析，HTML 片段
*/
const PLAN_ANS = {

  /* ================= P0 ================= */
  1: {
    ans: [
      `SELECT * FROM dim_dept;`,
      `SELECT * FROM fact_sales LIMIT 20;`,
      `-- 故意写错：表里没有 department 这个字段
SELECT department FROM dim_dept;`
    ],
    exp: `<b>先认识报错，比先背语法有用。</b>第三行会报 <code>no such column: department</code>。
这三类报错覆盖 90% 的初学问题：
<br>· <code>no such column</code> —— 列名不存在，通常是抄错字或表里真没这列
<br>· <code>no such table</code> —— 表名错，注意是 <code>fact_sales</code> 不是 <code>sales</code>
<br>· <code>syntax error near ...</code> —— 少逗号、少括号、关键字拼错
<br><br>第一行会返回 <b>8 行 3 列</b>（dept_id / dept_name / cost_center），第二行返回 20 行 8 列。
报错不会咬人，改一个字重跑就行。真正的危险是<b>不报错但算错</b>，后面会反复遇到。`
  },

  /* ================= P1 ================= */
  2: {
    ans: [
      `SELECT cust_code AS 客户编码,
       cust_name AS 客户名称,
       region    AS 区域
FROM dim_customer
LIMIT 10;`,
      `SELECT * FROM dim_customer LIMIT 3;`
    ],
    exp: `第一条只出 3 列，第二条出 <b>7 列</b>（cust_code、cust_name、industry、region、sales_owner、credit_limit、onboard_date）。
<br><br><b>为什么真实工作不写 <code>SELECT *</code>：</b>
<br>① 表有 40 列时，结果表你得横向滚动才能找到要看的数
<br>② 别人给表加了一列，你的程序列顺序全乱
<br>③ 查出来不用的列要占内存和网络
<br><br>中文别名不用加引号，但**别名里不能有空格和减号**。写成 <code>AS 客户 名称</code> 会报错。`
  },
  3: {
    ans: [
      `-- ① 数量大于 30 的行
SELECT bill_no, bill_date, sku, qty
FROM fact_sales
WHERE qty > 30
LIMIT 20;`,
      `-- ② 退货：数量为负
SELECT bill_no, bill_date, sku, qty
FROM fact_sales
WHERE qty < 0
LIMIT 20;`,
      `-- ③ 2026-10 的单据（注意：日期有两种写法）
SELECT bill_no, bill_date, cust_code, qty
FROM fact_sales
WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10'
LIMIT 20;`
    ],
    exp: `<b>第三问是这道题真正的考点，藏着 66 行的坑。</b>
<br><br>表里 24,429 行日期写成 <code>2026-10-05</code>，855 行写成 <code>2026/10/05</code>。
所以你如果直接写 <code>WHERE bill_date LIKE '2026-10%'</code>，只会捞到 <b>1,557 行</b>，
而 2026-10 实际有 <b>1,623 行</b> —— 少 66 行，而且<b>不会报错</b>。
<br><br><code>REPLACE(bill_date,'/','-')</code> 把斜杠统一成横杠，<code>substr(...,1,7)</code> 取前 7 位（4+1+2 正好是 <code>2026-10</code>）。
<br><br><b>第二问的反思：</b><code>qty &lt; 0</code> 查出来的不是脏数据，是<b>退货</b>。
业务上退货就是负数入库，所以算收入时它会自然冲减。如果你加上 <code>WHERE qty &gt; 0</code> 把退货排掉，
收入就会虚高 —— 这是财务做报表最常犯的错。
<br><br><b>AND / OR 混用必须加括号：</b><code>WHERE a=1 OR b=2 AND c=3</code> 实际执行的是 <code>a=1 OR (b=2 AND c=3)</code>，AND 优先级高于 OR。`
  },
  4: {
    ans: [
      `SELECT cust_code, cust_name, credit_limit
FROM dim_customer
ORDER BY credit_limit DESC
LIMIT 10;`,
      `-- 加兜底字段：额度相同时也保证顺序固定
SELECT cust_code, cust_name, credit_limit
FROM dim_customer
ORDER BY credit_limit DESC, cust_code
LIMIT 10;`
    ],
    exp: `<b>128 个客户只有 88 个不同的信用额度</b>，所以并列非常多（前 10 名里就有两对同额度）。
SQL 不保证并列行的先后顺序，数据库换个执行计划、加个索引，顺序就可能变。
<br><br>表现是：今天跑第一行是 C1012，明天跑可能变成 C1045。如果这份结果要发给老板、或者要存档对账，
<b>顺序跳动就是事故</b>。
<br><br>兜底原则：<b>排序的最后一定跟一个唯一的字段</b>（主键、编码、单号）。这样结果永远可复现。
你在 T11 帕累托题里会踩到这个坑 —— 累计占比是按顺序累加的，顺序一乱，累计值就全错位。`
  },
  5: {
    ans: [
      `SELECT COUNT(*)            AS 行数,
       SUM(qty)             AS 总数量,
       ROUND(AVG(unit_price), 2) AS 平均单价,
       MAX(unit_price)      AS 最高单价
FROM fact_sales;`,
      `-- COUNT(*) 和 COUNT(列) 的差别
SELECT COUNT(*)              AS 全部行,
       COUNT(discount)       AS 折扣非空行,
       COUNT(*) - COUNT(discount) AS 折扣为NULL
FROM fact_sales;`
    ],
    exp: `第二行结果是 <b>26284 / 25470 / 814</b>。
<br><br><code>COUNT(*)</code> 数的是行数，<code>COUNT(discount)</code> 数的是<b>这一列非 NULL 的行数</b>。
两者差 814 就是折扣为 NULL 的行 —— 这批数据故意留了 3% 的空折扣。
<br><br>这是"数据水分"的第一课：<b>你以为是 0 的地方，其实什么都没有。</b>
在 Excel 里空单元格和 0 看起来不一样，在数据库里 NULL 和 0 是完全两个东西。
<br><br>顺带记一句：<code>SUM</code> 和 <code>AVG</code> 会自动跳过 NULL，<code>COUNT(*)</code> 不会。
所以同一个字段，用 COUNT 数出来的和用 AVG 当分母算出来的，口径可能不一致。Day 16 会专门拆这个问题。`
  },
  6: {
    ans: [
      `-- ① 按客户汇总数量
SELECT cust_code, SUM(qty) AS 总数量
FROM fact_sales
GROUP BY cust_code
ORDER BY 总数量 DESC
LIMIT 8;`,
      `-- ② 按产品汇总
SELECT sku, SUM(qty) AS 总数量
FROM fact_sales
GROUP BY sku
ORDER BY 总数量 DESC
LIMIT 8;`,
      `-- ③ 错误示范：不替换斜杠
SELECT substr(bill_date, 1, 7) AS 月份, COUNT(*) AS 行数
FROM fact_sales
GROUP BY 1
ORDER BY 1;`,
      `-- ③ 正确写法：先统一斜杠再截取
SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份, COUNT(*) AS 行数
FROM fact_sales
GROUP BY 1
ORDER BY 1;`
    ],
    exp: `<b>把第③组两条对比着跑，你会看到 44 行和 22 行。</b>
<br><br>真实月份只有 22 个（2025-01 到 2026-10），但第三条会返回 <b>44 行</b> ——
因为 <code>2026/10</code> 被当成了另一个月份，和 <code>2026-10</code> 各占一行。2026-10 因此被拆成 1557 + 66 两行。
<br><br>这是本套数据最阴的一个坑：<b>不报错、不丢行，只是把你一个月的数拆成两半</b>。
你在做月度趋势、环比、预算对比时，只要用它，结论全错。
<br><br><b>GROUP BY 的硬规则：</b>SELECT 里出现的非聚合列，必须出现在 GROUP BY 里。
<br>· <code>SELECT cust_code, region, SUM(qty) ... GROUP BY cust_code</code> 会报错（region 没分组）
<br>· 写 <code>GROUP BY 1</code> 是简写，指"按 SELECT 的第 1 个字段分组"，列多时容易数错，正式交付的 SQL 建议写全字段名`
  },
  7: {
    ans: [
      `SELECT cust_code,
       ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales
GROUP BY cust_code
HAVING SUM(qty * unit_price * (1 - COALESCE(discount, 0))) > 5000000
ORDER BY 收入万 DESC;`,
      `-- 反例：把聚合条件写进 WHERE
SELECT cust_code
FROM fact_sales
WHERE SUM(qty) > 100
GROUP BY cust_code;`
    ],
    exp: `第二条会报 <code>misuse of aggregate: SUM()</code> —— 不是你的语法写错了，
而是<b>执行到 WHERE 的时候还没分组，哪来的 SUM</b>。
<br><br>执行顺序是你必须背下来的一条：
<br><code>FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY</code>
<br><br>所以：
<br>· WHERE 只能筛<b>单行</b>的条件（qty &gt; 30、日期、客户编码）
<br>· HAVING 筛的是<b>组</b>的条件（SUM、COUNT、AVG）
<br>· SELECT 里起的别名（收入万），HAVING 里<b>不能</b>用，因为 HAVING 比 SELECT 先执行
<br><br>上面第一条我重复写了一遍长表达式，就是为了不依赖别名。想少打字可以套一层子查询，
Day 25 会讲。`
  },
  8: {
    ans: [
      `-- ① 我们有几个部门
SELECT COUNT(*) AS 部门数 FROM dim_dept;`,
      `-- ② 哪个区域客户最多
SELECT region AS 区域, COUNT(*) AS 客户数
FROM dim_customer
GROUP BY region
ORDER BY 客户数 DESC;`,
      `-- ③ 销售明细一共多少行
SELECT COUNT(*) AS 明细行数 FROM fact_sales;`,
      `-- ④ 2026年10月有多少张单据（注意是单据数，不是行数）
SELECT COUNT(DISTINCT bill_no) AS 单据数
FROM fact_sales
WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10';`,
      `-- ⑤ 单价最贵的 5 个产品
SELECT sku, sku_name, category, list_price
FROM dim_product
ORDER BY list_price DESC
LIMIT 5;`
    ],
    exp: `标准答案：<b>8 个部门 / 华东 43 个客户 / 26,284 行明细 / 499 张单据 / 5 个最高价产品</b>。
<br><br>只有第④问有陷阱。如果你写 <code>COUNT(*)</code>，会得到 1,623 —— 那是<b>明细行数</b>。
一张单据平均有 3 行产品，所以行数永远大于单据数。
<br><br><b>"多少张单"必须用 <code>COUNT(DISTINCT bill_no)</code>。</b>
这是财务口径的典型分歧：老板问"这个月做了多少单生意"，他问的是单据数；
如果你报行数，他会以为业务量是实际的三倍。
<br><br>第⑤问如果你还想着 <code>SELECT *</code>，现在应该已经能条件反射地只取需要的列了。`
  },

  /* ================= P2 ================= */
  9: {
    ans: [
      `-- 对一列去重：5 个区域
SELECT DISTINCT region FROM dim_customer;`,
      `-- 对整行去重：26,284 变成 26,073
SELECT COUNT(*) AS 整行去重后 FROM (SELECT DISTINCT * FROM fact_sales);
SELECT COUNT(*) AS 原始行数   FROM fact_sales;`,
      `-- 对「单据+客户」这个组合去重：8,680
SELECT COUNT(*) AS 单据客户组合
FROM (SELECT DISTINCT bill_no, cust_code FROM fact_sales);`
    ],
    exp: `<b>关键数字：26,284 → 26,073，少了 211 行。</b>
这 211 行就是 T01 要你找出来的"完全重复的记录"。
<br><br>三个数字的关系：
<br>· 26,284 = 明细表原始行数
<br>· 26,073 = 整行完全相同的只剩一份（去重后）
<br>· 8,680 = 单据数（每张单平均 3.03 行产品）
<br><br><b>最容易搞混的地方：</b><code>SELECT DISTINCT bill_no, cust_code</code> 得到 8,680，
这不代表"有 8,680 张单需要去重"，而是"单据 + 客户的组合有 8,680 个"。
一张单可以有多行不同产品，那些行<b>不是重复</b>。
<br><br>所以判断重复的唯一标准是：<b>所有业务字段都相同</b>（单据号、客户、产品、数量、单价、折扣）。
少带一个字段，就会把正常的明细误判成重复。`
  },
  10: {
    ans: [
      `-- ① 让空格现形：用方括号包起来看
SELECT '[' || cust_name || ']' AS 带括号的名字
FROM dim_customer
WHERE cust_name <> TRIM(cust_name)
LIMIT 8;`,
      `-- ② 空格的真正杀伤力：精确匹配查不到
SELECT COUNT(*) AS 精确匹配 FROM dim_customer WHERE cust_name = '恒晟实业(华东)';
SELECT COUNT(*) AS TRIM后匹配 FROM dim_customer WHERE TRIM(cust_name) = '恒晟实业(华东)';`,
      `-- ③ 统计口径：行数 vs 唯一名字
SELECT COUNT(*)                        AS 档案行数,
       COUNT(DISTINCT cust_name)        AS 名字去重,
       COUNT(DISTINCT TRIM(cust_name))  AS 去空格去重
FROM dim_customer;`
    ],
    exp: `<b>第②组是本日最该记住的东西：结果是 0 和 1。</b>
<br><br><code>WHERE cust_name = '恒晟实业(华东)'</code> 返回 <b>0 行</b>，因为表里存的实际是
<code>'恒晟实业(华东) '</code>（末尾带一个空格）。这个客户是 C1001 —— 全公司收入最高的客户，
收入 33,748 万。你用他的名字去查，查不到。
<br><br>第③组三个数字是 <b>128 / 120 / 120</b>。注意后两个<b>一样</b>：
因为"一客多码"的重复建档和"尾随空格"是两件独立的事，这套数据里它们恰好没有叠加，
所以 <code>COUNT(DISTINCT)</code> 加不加 TRIM 结果相同。
<br><br><b>这就是为什么不能用 COUNT 来判断有没有空格问题</b> ——
它对这个坑是瞎的。要靠第①组那种 <code>&lt;&gt; TRIM()</code> 的写法，或者 <code>'[' || 字段 || ']'</code> 把不可见的字符显出来。
<br><br>实务口诀：<b>任何来自外部系统的文本字段，先 TRIM 再用。</b>
Excel 导出的客户名、员工姓名、商品名称，第一件事都是清洗。`
  },
  11: { task: 'T03',
    exp: `<b>答案：128 行档案，120 个真实客户。</b>差的 8 个是"一客多码"重复建档。
<br><br>这题只有一行两列，是全套里最简单的，但它定下了一个重要习惯：
<b>报数字之前先说清口径。</b>"我们有 128 个客户"和"我们有 120 个客户"都对，
取决于你说的是"档案条数"还是"去重后的客户数"。财务交报表时这句话必须带清楚。
<br><br>写法上要注意：<code>COUNT(DISTINCT TRIM(cust_name))</code> 是<b>先 TRIM 再去重</b>，
不是"去重后再 TRIM"。函数嵌套的顺序在这里不能反。`
  },
  12: { task: 'T01',
    exp: `<b>答案：211 行重复，涉及 60 张单据。</b>
<br><br>这题的思维坎在于：<b>一张单据本来就有多行，那不是重复。</b>
所以 GROUP BY 必须把能唯一确定一行业务含义的字段全带上：
<code>bill_no, cust_code, sku, qty, unit_price, discount</code>。
<br><br>如果你只写 <code>GROUP BY bill_no HAVING COUNT(*) &gt; 1</code>，
会查出来 8,680 张单里的一大半 —— 那全是正常的多产品单据，白忙一场。
<br><br>反过来，字段带太多也不行：如果把 <code>bill_date</code> 也加进去，
万一重复录入时日期被改了，你就永远查不出来。
<br><br><b>判断标准：这组字段能不能唯一描述"一行业务"。</b>
对销售明细就是"哪张单、哪个客户、哪个产品、多少量、什么价、什么折扣"。`
  },
  13: { task: 'T02',
    exp: `<b>答案：8 组重复建档，每组 2 个编码。</b>
<br><br>难点是名字带尾随空格，所以必须先 <code>TRIM</code> 再分组，
否则 <code>'恒晟实业(华东)'</code> 和 <code>'恒晟实业(华东) '</code> 会被当成两个不同的客户，
你反而查不出重复。这里 TRIM 是<b>为了合并</b>，和 Day 10 里 TRIM 是<b>为了匹配</b>，目的不同但手法相同。
<br><br>业务影响：C1001 和它的重复编码各占一半销售额，于是
<br>· 按客户排名时，这个大客户会被拆成两个"中等客户"，掉出前几名
<br>· 按客户算毛利率时，两边的样本量都变小，波动变大
<br>· 应收账龄会分成两份，催收时可能漏掉一份
<br><br>真实公司里这类问题极常见，来源通常是"销售在系统里新建客户，没搜到就新建了一个"。
修复动作是主数据治理：合并编码、停用重复档案，不是改报表 SQL。`
  },
  14: {
    ans: [],
    exp: `<b>今天没有新答案，只有验收表。</b>关掉提示和答案，掐表 30 分钟。三题全过才算 P2 过关。
<br><br>自查清单（每题只问一个核心问题）：
<br>· T01 —— 你能讲清"为什么 <code>GROUP BY bill_no</code> 查出来的不算重复"吗？
<br>· T02 —— 你能讲清"TRIM 在这题里是为了合并，不是为了匹配"吗？
<br>· T03 —— 你能讲清"128 和 120 分别是什么口径"吗？
<br><br>任何一题靠看答案过的，明天用回炉日重做。这不是惩罚，是因为 P3 会用到这三题的全部结论：
T04 的去重要用 T01 的结果，T06 的分区域毛利率会被 T02 的重复编码影响。`
  },
  15: {
    ans: [
      `-- 一条 SQL 出完整脏数据清单
SELECT '重复单据行' AS 问题, COUNT(*) AS 条数 FROM (
  SELECT bill_no, cust_code, sku, qty, unit_price, discount
  FROM fact_sales
  GROUP BY 1, 2, 3, 4, 5, 6
  HAVING COUNT(*) > 1
)
UNION ALL
SELECT '一客多码（组）', COUNT(*) FROM (
  SELECT TRIM(cust_name) FROM dim_customer
  GROUP BY 1 HAVING COUNT(DISTINCT cust_code) > 1
)
UNION ALL
SELECT '客户名带尾随空格', COUNT(*) FROM dim_customer
WHERE cust_name <> TRIM(cust_name)
UNION ALL
SELECT '斜杠日期（行）', COUNT(*) FROM fact_sales
WHERE bill_date LIKE '%/%'
UNION ALL
SELECT '折扣为 NULL（行）', COUNT(*) FROM fact_sales
WHERE discount IS NULL
UNION ALL
SELECT '退货行', COUNT(*) FROM fact_sales
WHERE qty < 0;`
    ],
    exp: `<b>这条 SQL 请存进你的笔记，以后接到任何一张新表都能照着改。</b>
<br><br>跑出来是 6 行：重复单据行 211 / 一客多码 8 组 / 带空格 42 条 / 斜杠日期 855 行 / 折扣 NULL 814 行 / 退货 424 行。
<br><br>三个技术点：
<br>· <code>UNION ALL</code> 是"上下拼两张结果表"，要求两边列数、类型一致。
用 <code>UNION</code> 会去重（这里不会重，但多一次排序开销），一律用 <code>UNION ALL</code>
<br>· 每段都是"一个数字 + 一个说明"，拼起来就是一张体检报告
<br>· 数字要写死在结果里（'重复单据行'），别只输出光秃秃的数字，否则过两天你自己都不知道哪行是什么
<br><br><b>为什么这件事值得单独一天：</b>真实工作里，你接到的数据没有说明书。
你唯一能确定的就是"它可能脏"。先体检、再计算，是财务做数据分析唯一可靠的顺序。
反过来先算再看，等你发现数不对时，已经给老板发出去三版了。`
  },

  /* ================= P3 ================= */
  16: {
    ans: [
      `-- ① = NULL 永远查不到东西
SELECT COUNT(*) AS 用等号 FROM fact_sales WHERE discount = NULL;
SELECT COUNT(*) AS 用IS   FROM fact_sales WHERE discount IS NULL;`,
      `-- ② SUM 看不出差别（重点：一样大）
SELECT ROUND(SUM(qty * unit_price * discount), 0)                AS 不补0,
       ROUND(SUM(qty * unit_price * COALESCE(discount, 0)), 0)   AS 补0
FROM fact_sales;`,
      `-- ③ AVG 才看得出差别（分母不同）
SELECT ROUND(AVG(discount), 4)                 AS 忽略NULL,
       ROUND(AVG(COALESCE(discount, 0)), 4)    AS NULL当0,
       COUNT(*)                                AS 总行,
       COUNT(discount)                         AS 非空行
FROM fact_sales;`,
      `-- ④ 最隐蔽的坑：用 = 0 筛会漏掉 NULL
SELECT COUNT(*) AS 等号0     FROM fact_sales WHERE discount = 0;
SELECT COUNT(*) AS 补0后等于0 FROM fact_sales WHERE COALESCE(discount, 0) = 0;`
    ],
    exp: `<b>这一天要纠正一个很常见的误解：以为 SUM 加不加 COALESCE 结果会差。</b>
第②组跑出来<b>两个数完全一样</b>（都是 734,048,908），因为 SUM 本来就跳过 NULL，
效果等同于把 NULL 当 0 加。<b>所以指望靠 SUM 的差异发现 NULL 问题，是发现不了的。</b>
<br><br>真正会出错的是这三处：
<br>· <b>第①组</b>：<code>= NULL</code> 返回 0 行。SQL 里 NULL 表示"未知"，
未知等于未知吗？不成立。所以判断 NULL 只能用 <code>IS NULL</code> / <code>IS NOT NULL</code>。
<br>· <b>第③组</b>：<code>AVG(discount)</code> 是 0.0780，<code>AVG(COALESCE(discount,0))</code> 是 0.0756。
差的这 0.24 个百分点，就是 814 行 NULL 被排除在分母外的结果。
<b>报"平均折扣 7.8%"之前，你得知道这个 7.8% 是怎么算出来的。</b>
<br>· <b>第④组</b>：843 行折扣真的是 0，814 行是 NULL。用 <code>discount = 0</code> 只捞到 843 行，
用 <code>COALESCE(discount,0) = 0</code> 捞到 1,657 行。少的那 814 行，
在"折扣为零的订单分析"里就凭空消失了。
<br><br>口诀：<b>NULL 不是 0，是"没有"。</b>它在 COUNT 里不计数、在 SUM 里跳过、在 AVG 里不进分母、
在任何比较运算里都不成立。要动它，先 <code>COALESCE</code> 或 <code>IS NULL</code>。`
  },
  17: {
    ans: [
      `-- 有多少行日期是函数解析不了的
SELECT COUNT(*)                                  AS 总行数,
       COUNT(date(bill_date))                    AS 直接date,
       COUNT(date(REPLACE(bill_date, '/', '-')))  AS 替换后date
FROM fact_sales;`,
      `-- 看看解析失败的是哪些
SELECT bill_date
FROM fact_sales
WHERE date(bill_date) IS NULL
LIMIT 10;`,
      `-- 对比：julianday 也一样失效
SELECT julianday('2026/10/05')                  AS 斜杠,
       julianday('2026-10-05')                  AS 标准;`
    ],
    exp: `<b>结果：26,284 / 25,429 / 26,284。</b>直接写 <code>date(bill_date)</code> 有 855 行返回 NULL，
而且<b>一声不响，不报错</b>。
<br><br>第三组最直观：<code>julianday('2026/10/05')</code> 返回 <code>NULL</code>，
<code>julianday('2026-10-05')</code> 返回 <code>2460953.5</code> 这种数字。
SQLite 的日期函数只认 <code>YYYY-MM-DD</code>，斜杠是"非法输入"，但它的处理方式是<b>返回 NULL 而不是报错</b>。
<br><br><b>这就是"静默失败"，比报错危险得多。</b>报错你会改，返回 NULL 你会以为这行本来就没日期。
<br><br>后果链条：如果拿它算账龄，<code>julianday('2026-10-31') - julianday(due_date)</code> 得到 NULL，
CASE WHEN 里所有比较都不成立，最终全落到 ELSE 分支 ——
<br>· 过期的发票被算成"90天以上"
<br>· 或者更糟：被算成"未到期"
<br>账龄表直接失真，而你看不出任何异常。
<br><br>所以 Day 29 做账龄题之前，先跑一遍"有没有 NULL 混进来"的体检。`
  },
  18: {
    ans: [
      `-- 先不分组，看明细：逾期天数和分档
SELECT invoice_no,
       due_date,
       CAST(julianday('2026-10-31') - julianday(due_date) AS INT) AS 逾期天数,
       CASE
         WHEN julianday('2026-10-31') - julianday(due_date) <= 0  THEN '未到期'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 30 THEN '1-30天'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 90 THEN '31-90天'
         ELSE '90天以上'
       END AS 账龄区间
FROM fact_ar
WHERE amount - settled_amt > 0
ORDER BY 逾期天数 DESC
LIMIT 20;`,
      `-- 加上分组，就是一张账龄表
SELECT CASE
         WHEN julianday('2026-10-31') - julianday(due_date) <= 0  THEN '未到期'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 30 THEN '1-30天'
         WHEN julianday('2026-10-31') - julianday(due_date) <= 90 THEN '31-90天'
         ELSE '90天以上'
       END AS 账龄区间,
       COUNT(*) AS 笔数,
       ROUND(SUM(amount - settled_amt) / 10000, 1) AS 未收万元
FROM fact_ar
WHERE amount - settled_amt > 0
GROUP BY 1;`
    ],
    exp: `<b>CASE WHEN 是从上往下判断，第一个成立的就停，所以顺序决定了结果。</b>
<br><br>四个分支的顺序不能乱：如果先写"大于 90 天"，那么负数（未到期）也会满足"不大于 90"以外的条件，
落进 ELSE。正确做法是<b>从严格到宽松</b>排：先 &lt;= 0，再 &lt;= 30，再 &lt;= 90，剩下的进 ELSE。
<br><br>注意这里用的是 <code>&lt;=</code> 而不是 <code>&lt;</code>：
逾期 30 天整到底算"1-30 天"还是"31-90 天"？必须是前者，否则 30 天这一天的发票会凭空消失。
<br><br><b>为什么先看明细再分组：</b>直接 GROUP BY 你只能看到 4 个数字，
看不出有没有 NULL、有没有负数、边界值落在哪。先看 20 行明细，问题一眼就露出来。
<br><br>第二步结果：未到期 199 笔 6,419.6 万，1-30 天 95 笔 3,457 万，
31-90 天 113 笔 3,481 万，90 天以上 132 笔 4,236.3 万。
<br><br>顺带一个专业习惯：账龄表的"基准日"（这里是 2026-10-31）要写死在 SQL 里或用参数传，
<b>不要用 <code>julianday('now')</code></b>。否则你今天跑和下个月跑，同一张表的结果不一样，没法对账。`
  },
  19: { task: 'T04',
    exp: `<b>答案：2026-10 收入 49,810.1 万元（约 4.98 亿）。</b>
<br><br>这题同时处理三件事，缺一个数字就错：
<br>· <b>去重</b>：211 行重复录入必须只算一次（<code>SELECT DISTINCT</code> 所有业务字段）
<br>· <b>退货</b>：<code>qty &lt; 0</code> 的行不要排除，让负数自然冲减收入
<br>· <b>日期</b>：<code>REPLACE</code> 统一斜杠，否则少 66 行
<br><br><b>验证技巧：</b>如果算出来是 5.2 亿左右，说明没去重（重复单被算了两次）；
如果是 4.9 亿但差一点点，多半是漏了斜杠日期那 66 行。
<br><br>这题的 <code>WITH clean AS (...)</code> 是关键资产 —— 后面 T07 账表核对直接复用它。
建议你现在就把这段 CTE 存成模板：<b>干净明细 = 整行去重 + 统一日期</b>。
<br><br>另外：题目要求"万元保留 1 位"，所以除以 10000 再 ROUND。别在明细层就除，
那样小数误差会累积，金额大时要差几十块。`
  },
  20: { task: 'T05',
    exp: `<b>退货 424 行，占总行数 26,284 的 1.61%。</b>这个比例在制造业/批发业算健康（超过 5% 要查原因）。
<br><br>这题唯一的坑是<b>符号</b>。退货在明细里是负数，两个选择：
<br>· 保持负数：报表显示"-12.3 万"，老板会问"这是亏了还是退了"
<br>· 加负号转正：<code>SUM(-qty * unit_price * ...)</code>，显示"退货 12.3 万"，一眼就懂
<br><br>题目要求后者。这不只是好看 —— 在报表里，<b>退货和收入应该能相加</b>：
收入 4.98 亿 + 退货 -0.03 亿 = 净收入。如果你把退货也弄成正数，加总就错了。
<br><br>第二层思考：退货金额要不要从收入里减？
<br>要。因为总账里退货是冲减收入的（借方 6001），如果明细不减，
你的明细永远比总账大 —— 这正是 T07 账表核对要查的东西之一。
<br><br>一个容易被忽略的细节：部分退货。数据里有些行的 qty 是 -8（原单 20 件退了 8 件），
这种行说明"同一张单既有销售又有退货"，你按单据汇总时它们会自动合在一起。这是正常的，
不要为了"干净"把退货行单独存一张表。`
  },
  21: {
    ans: [
      `-- ① 用 LEFT JOIN 找「2026-10 没下单的客户」
SELECT c.cust_code, TRIM(c.cust_name) AS 客户
FROM dim_customer c
LEFT JOIN fact_sales s
       ON c.cust_code = s.cust_code
      AND substr(REPLACE(s.bill_date, '/', '-'), 1, 7) = '2026-10'
WHERE s.bill_no IS NULL
ORDER BY 1;`,
      `-- ② 反例：月份条件写进 WHERE，LEFT 就变成 INNER 了
SELECT COUNT(*) AS 结果行数
FROM dim_customer c
LEFT JOIN fact_sales s ON c.cust_code = s.cust_code
WHERE substr(REPLACE(s.bill_date, '/', '-'), 1, 7) = '2026-10';`,
      `-- ③ 对照：同样的条件写 INNER
SELECT COUNT(*) AS 结果行数
FROM dim_customer c
INNER JOIN fact_sales s
        ON c.cust_code = s.cust_code
       AND substr(REPLACE(s.bill_date, '/', '-'), 1, 7) = '2026-10';`
    ],
    exp: `<b>第②和第③跑出来都是 1,623 行 —— 一模一样。</b>
这就是 LEFT JOIN 最经典的坑：<b>把右表的过滤条件写进 WHERE，LEFT JOIN 会退化成 INNER JOIN。</b>
<br><br>原因：LEFT JOIN 保留左表全部行，右表没匹配上的地方补 NULL。
可你一旦在 WHERE 里写 <code>s.bill_date = '2026-10'</code>，
那些被补成 NULL 的行就<b>不满足条件</b>，被 WHERE 筛掉了 —— 等于没保留。
<br><br><b>正确做法是第①组：条件写在 <code>ON</code> 里。</b>
这样"先按月份匹配，匹配不上就留 NULL"，再用 <code>WHERE s.bill_no IS NULL</code> 把没匹配的挑出来。
<br><br>结果：<b>6 个客户在 2026-10 一单没下</b>（C1002、C1006、C1008、C1014、C1056 等，集中在华北和总部）。
这才是业务真正想知道的："哪些老客户这个月没动静了？" —— 这是客户流失预警的第一步。
<br><br><b>顺带破除一个误解：</b>你可能想试"有客户档案但从来没下过单"的查询，跑出来是 <b>0 行</b>
—— 这套数据里所有客户都下过单。所以 LEFT JOIN 的价值不体现在"孤儿数据"上，
而体现在<b>加时间维度后</b>：任何一个月，总有一批客户没下单。
<br><br>判断口诀就一句：<b>右表的过滤条件，永远放 ON，不要放 WHERE。</b>`
  },
  22: { task: 'T06',
    exp: `<b>答案：5 个区域，毛利率都在 34.8% - 36.1% 之间。</b>分布很均匀，说明数据是健康的。
<br><br>三个技术点：
<br>· <b>收入用折扣后</b>：<code>qty * unit_price * (1 - COALESCE(discount,0))</code>。
不加 COALESCE，含 NULL 折扣的行会变成 NULL，被 SUM 跳过 → 收入凭空变少
<br>· <b>成本用标准成本</b>：<code>qty * std_cost</code>，不是 <code>list_price</code>。挂牌价不是成本
<br>· <b>分母保护</b>：<code>NULLIF(分母, 0)</code>。某个区域如果收入恰好为 0（比如只有退货），
不保护就会报除零错误，或者返回 NULL 让你以为没数据
<br><br><b>为什么不能用含税收入算毛利率：</b>
增值税是代收代付，不是你的收入，也不进利润表。用含税收入当分母，
毛利率会被系统性低估（除以 1.13 和除以 1 的差别）。
财务口径上，收入永远是<b>不含税</b>的。这套数据的 unit_price 已经是不含税价，所以不用再除。
<br><br>如果你算出来某个区域毛利率明显偏离（比如 20% 或 50%），先检查 JOIN 条件 ——
多半是 <code>ON s.sku = p.sku</code> 写漏了，导致笛卡尔积把成本重复加了。`
  },
  23: {
    ans: [],
    exp: `<b>回炉日，只做事。T04、T05、T06 三题，每题限时 20 分钟。</b>
<br><br>今天要盯的不是"做出来"，而是"做得快"。判断标准：
<br>· T04 能在 10 分钟内写出 <code>WITH clean AS</code> 那层，说明去重和日期已成肌肉记忆
<br>· T05 不用想就知道退货是负数、要转正显示
<br>· T06 提笔就写 <code>NULLIF</code>，说明你对除零有本能防御
<br><br>三题全过，P3 就过关了。你现在具备的是<b>处理脏数据 + 定义口径</b>的能力，
这两件事比会写窗口函数稀缺得多 —— 会写窗口函数的人一抓一把，
能说清"你这个数为什么和我差 300 万"的人不多。
<br><br>有卡住的，回去看对应那天的 exp 最后一段"为什么"，不要重看语法。`
  },

  /* ================= P4 ================= */
  24: {
    ans: [
      `-- 正常总额：89.96 亿
SELECT ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))), 0) AS 正常总额
FROM fact_sales;`,
      `-- 事故现场：先按单据汇总，再 join 回明细
SELECT ROUND(SUM(b.amt), 0) AS 被放大的金额
FROM (SELECT bill_no,
             SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS amt
      FROM fact_sales
      GROUP BY bill_no) b
JOIN fact_sales s ON s.bill_no = b.bill_no;`,
      `-- 直接 join 产品表不会翻倍（sku 是唯一的）
SELECT ROUND(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))), 0) AS join后总额
FROM fact_sales s
JOIN dim_product p ON s.sku = p.sku;`
    ],
    exp: `<b>第①组 89.96 亿，第②组 336.32 亿 —— 放大 3.7 倍。</b>
<br><br>原因很简单：<b>平均每张单有 3.03 行产品</b>。
你把"每张单一行"的汇总表，join 到"每行产品一行"的明细表，
每张单就被复制成了它的行数份，金额自然翻 3 倍多。
<br><br>这是财务做报表最真实的事故：数字大得离谱，但 SQL 不报错，
你甚至可能觉得"这个月业务真好"。等交上去被问"为什么收入是这个月的四倍"才发现。
<br><br><b>第③组为什么没翻倍？</b>因为 <code>dim_product.sku</code> 是唯一的，
一个 sku 只有一条产品记录，一对多的方向是"一条产品对多条明细"，
从明细这边看过去是"多对一"，不会放大。
<br><br>所以判断公式是：<b>放大发生在"从一对多关系的『一』侧，去 join 『多』侧"的时候。</b>
<br>· 单据汇总表 join 明细表 → 会放大
<br>· 明细表 join 产品档案 → 不会
<br>· 客户档案 join 明细表 → 会放大（一个客户对多行）
<br><br><b>防御手段：</b>做任何 join 之后算金额，先比一次"join 前后总行数"和"总金额"。
数字对不上就立刻停手。这个习惯能救你至少三次。`
  },
  25: {
    ans: [
      `-- ① 标量子查询：返回一个数，可以放 SELECT 里
SELECT (SELECT SUM(qty)
        FROM fact_sales
        WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10') AS 十月总数量;`,
      `-- ② IN 子查询：返回一列，用来筛选
SELECT cust_code, TRIM(cust_name) AS 客户
FROM dim_customer
WHERE cust_code IN (SELECT DISTINCT cust_code
                    FROM fact_sales
                    WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10')
ORDER BY 1
LIMIT 10;`,
      `-- ③ 派生表（FROM 子查询）：返回一张表，当临时表用
SELECT ROUND(SUM(收入) / 10000, 1) AS 十月收入万
FROM (SELECT qty * unit_price * (1 - COALESCE(discount, 0)) AS 收入
      FROM fact_sales
      WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) = '2026-10') t;`
    ],
    exp: `<b>三种形态的区别只看一件事：子查询返回的是"一个值""一列"还是"一张表"。</b>
<br><br>· <b>标量</b>（返回 1 个值）：能直接塞进 SELECT、WHERE、甚至另一个计算式里。
用得最多的地方是"算占比"：<code>SUM(x) / (SELECT SUM(x) FROM ...)</code>
<br>· <b>IN</b>（返回 1 列）：本质是"先查一张名单，再拿名单去筛"。注意 <code>NOT IN</code> 有个坑 ——
名单里只要有一个 NULL，整个 <code>NOT IN</code> 就返回空。要用 <code>NOT EXISTS</code> 或先排除 NULL
<br>· <b>派生表</b>（返回一张表）：<code>FROM (SELECT ...) t</code>，括号后面<b>必须给别名</b>（这里是 t），
否则报错。它就是"临时表"，是后面 <code>WITH</code> 的前身
<br><br><b>为什么推荐升级成 WITH：</b>第③组只套了一层还好，一旦套三层，
SQL 会变成"从里往外读"的俄罗斯套娃，别人审你的代码要盯十分钟。
<code>WITH</code> 把它变成"从上往下读"的流水线，这是专业和业余的分界线。
<br><br>改写后长这样，等下 Day 26 就会用到：
<pre>WITH clean AS (
  SELECT DISTINCT bill_no, bill_date, cust_code, sku, qty, unit_price, discount
  FROM fact_sales
)
SELECT ... FROM clean WHERE ...</pre>`
  },
  26: { task: 'T07',
    exp: `<b>答案：明细 527,945,503 元，总账 498,100,566 元，差额 29,844,937 元（约 2,984 万）。</b>
<br><br>明细比总账<b>多</b>，多出来的就是重复录入的行。这道题的认知核心是：
<b>差额本身就是线索，不是需要消灭的误差。</b>
<br><br>大多数人的第一反应是"先去重让明细变干净，再去对账"，结果两边正好相等，
差额 0，汇报"账实相符"。但真相是那 60 张单被录了两遍，
总账那边只记了一次，你在明细里强行去重，等于<b>把事故抹平了</b>。
<br><br>正确顺序：
<br>① 明细不去重，直接和总账比 → 拿到差额 2,984 万
<br>② 用 T01 的方法定位重复单据 → 60 张单
<br>③ 算一下这 60 张单的金额合计，应该正好等于差额附近
<br>④ 修正后重算，差额归零
<br><br><b>这个差额里还混着别的东西</b>：斜杠日期漏掉的 66 行、退货的处理方式。
真实对账很少一次对上，要靠"逐项排除"：先按单据号比对，
再按金额比对，最后按日期比对，一层层把原因剥出来。
<br><br>能把这套动作讲清楚，你就能面试财务分析岗了 —— 因为这正是他们每天在做的事。`
  },
  27: {
    ans: [
      `-- 正确：三个条件都要对上
SELECT d.dept_name       AS 部门,
       b.acc_code        AS 科目,
       b.budget_amt      AS 预算,
       g.debit           AS 实际借方
FROM dim_budget b
JOIN fact_gl g
     ON b.period   = g.period
    AND b.dept_id  = g.dept_id
    AND b.acc_code = g.acc_code
JOIN dim_dept d ON d.dept_id = b.dept_id
WHERE b.period = '2026-10'
LIMIT 15;`,
      `-- 事故：ON 里只写期间，金额被放大 1000 倍
SELECT ROUND(SUM(g.debit), 0) AS 少写条件后
FROM dim_budget b
JOIN fact_gl g ON b.period = g.period
WHERE b.period = '2026-10';`,
      `-- 对照：三个条件都写，才是真实金额
SELECT ROUND(SUM(g.debit), 0) AS 条件完整
FROM dim_budget b
JOIN fact_gl g
     ON b.period   = g.period
    AND b.dept_id  = g.dept_id
    AND b.acc_code = g.acc_code
WHERE b.period = '2026-10';`
    ],
    exp: `<b>113.11 亿 vs 1,111 万 —— 差 1000 倍。</b>
<br><br>第②组只按"期间"连接。2026-10 有 8 个部门 × 若干科目，
预算表的每一行都会去匹配总账里同期间的所有行，形成笛卡尔积。
<br><br><b>这张表的连接是"三维对齐"：期间 + 部门 + 科目。</b>
少任何一个维度，就变成"这个月所有部门的预算"去比"这个月所有部门的实际"，
每一行被重复匹配几十次。
<br><br>判断该写几个条件的方法：<b>问自己"这两张表靠什么唯一确定一行"。</b>
<br>· 预算表：一个期间 + 一个部门 + 一个科目 = 一行预算
<br>· 总账：一张凭证 + 一个科目 + 一个部门 = 一行分录（还要加凭证号才唯一）
<br><br>所以连接条件就是把<b>共同的业务维度</b>全对上。
<br><br>财务对账的通行做法就是这样：<b>维度对不齐，金额永远对不上。</b>
你在公司里听到"这个数和明细差在哪"，八成就是某个维度没对齐 ——
可能是部门归属不同（一笔费用记在总部但业务属于华东）、可能是科目不同（记在管理费用还是销售费用）。
先把维度摊平，再看金额。`
  },
  28: { task: 'T08',
    exp: `<b>答案：8 个部门里只有 3 个超支，客户服务部差异率最高（7.4%）。</b>
<br><br>客户服务部：预算 124.3 万 → 实际 133.6 万，<b>超 9.3 万</b>
<br>研发中心：122.8 → 127.9 万，超 5.1 万（4.2%）
<br>销售一部：152.5 → 156.7 万，超 4.2 万（2.8%）
<br>其余五个部门都是节约，销售二部最省（-4.4%）
<br><br><b>客户服务部为什么必超？</b>数据里它的 2026 年管理费用预算被砍了 45%
（原预算约 226 万，砍到 124.3 万），但实际费用没跟着降 —— 砍的是预算数字，
人和合同还在。这类差异要报给管理层，不是让财务去压。
<br><br>两个指标要一起看，缺一个都会误导人（下面是一般原理，不是这套数据的数）：
<br>· <b>只看差异额</b>：预算 2,000 万的部门超 80 万，预算 150 万的部门超 15 万 ——
看起来前者更该管，但前者只超 4%，后者超 10%。<b>绝对额大不代表失控。</b>
<br>· <b>只看差异率</b>：预算 1 万元的部门超支 100%，也只多花 1 万，不值得开会讨论。
<br><br>实务做法：<b>两个都看，再加一个"重要性水平"</b>——
差异额和差异率同时超过阈值（比如 50 万且 5%）才进重点分析清单。
<br><br>技术上的三个坑：
<br>· 差异率分母要保护：<code>NULLIF(budget_amt, 0)</code>，预算为 0 的科目不能算差异率
<br>· <b>预算缺失</b>：如果某部门某科目只有实际没有预算，INNER JOIN 会把它整行丢掉。
要从实际出发 <code>LEFT JOIN dim_budget</code>，把"无预算"的也捞出来
<br>· 借贷方向：<code>fact_gl</code> 里费用是借方（debit），收入是贷方（credit）。
这题只统计费用类，所以取 <code>debit</code>。混着取会把收入和费用加在一起，得到毫无意义的数`
  },
  29: {
    ans: [
      `-- 先看明细：逾期天数算出来是什么样
SELECT invoice_no,
       invoice_date,
       due_date,
       CAST(julianday('2026-10-31') - julianday(due_date) AS INT) AS 逾期天数
FROM fact_ar
ORDER BY 逾期天数 DESC
LIMIT 20;`,
      `-- 体检：有没有 NULL 混进来（有就说明日期格式坏了）
SELECT COUNT(*)                      AS 总行数,
       COUNT(julianday(due_date))     AS 能解析的行数,
       COUNT(*) - COUNT(julianday(due_date)) AS 解析失败
FROM fact_ar;`
    ],
    exp: `<b>体检结果：两个数字相等，解析失败为 0 —— 这张表日期是干净的。</b>
<br><br>为什么这张干净、而销售明细脏？因为 <code>fact_ar</code> 是我们按标准格式生成的，
只有 <code>fact_sales</code> 故意掺了 3% 的斜杠日期。
<b>同一个数据库里，不同表的脏法可能完全不同</b> —— 所以体检要逐表做，
不能"我检查过一张表没问题，其他表就都没问题"。
<br><br><code>CAST(... AS INT)</code> 是把 45.0 这种小数天数变成 45。
不加也能算，但显示成 <code>45.0</code> 不好看，而且做区间比较时容易踩浮点边界的坑。
<br><br><b>逾期天数为负是什么意思？</b>负数表示"还没到期"（到期日在基准日之后）。
这是正常的，不要用 <code>WHERE 逾期天数 &gt; 0</code> 把它过滤掉 —— 账龄表必须包含未到期的，
否则应收总额和科目余额永远对不上。
<br><br><b>"检查 NULL"这个动作值得练成条件反射。</b>任何用日期函数算出来的列，
拿到结果先 <code>COUNT</code> 两遍：总行数，和函数能解析的行数。不相等就说明有脏日期。`
  },
  30: { task: 'T09',
    exp: `<b>答案：未到期 199 笔 6,419.6 万 / 1-30 天 95 笔 3,457 万 / 31-90 天 113 笔 3,481 万 / 90 天以上 132 笔 4,236.3 万。</b>
<br><br>未收总额 17,593.9 万，<b>90 天以上占 24.1%</b> —— 这个比例偏高。
制造业/批发业的健康线一般在 10% 以内，超过 20% 就该挂到管理层议程上了。
<br><br>回答"哪一档最该催"：不是 90 天以上，而是 <b>31-90 天这一档</b>。
<br>· 90 天以上的 132 笔，很多已经坏账或者要打官司，催收成本高于回收价值
<br>· 31-90 天的 113 笔 3,481 万，还来得及，是催收的黄金窗口
<br>· 1-30 天的 95 笔，正常周转，催了反而影响客户关系
<br><br><b>这个判断是账龄表的全部意义：</b>它不是为了展示数字，
是为了告诉业务"力该往哪儿使"。只会做表不会解读，等于没做。
<br><br>技术细节：<code>WHERE amount - settled_amt &gt; 0</code> 这个条件不能省 ——
只算未收部分。已经全额收款的发票即使逾期也不算账龄。
如果写成 <code>amount &gt; 0</code>，会把全部发票都算进来，未收金额虚增。
<br><br>另外注意：<code>settled_amt</code> 是累计已收，可能部分收款。所以未收 = 发票额 - 已收额，
直接用 <code>amount</code> 当未收金额，是新手最常犯的错。`
  },
  31: {
    ans: [],
    exp: `<b>P4 是本套的分水岭。T07、T08、T09 三题，每题限时 20 分钟。</b>
<br><br>这三题分别对应三件不同的事，都要过关：
<br>· <b>T07 账表核对</b> —— 你敢不敢"先不对账、先找差异"。思维题，不是技术题
<br>· <b>T08 预算差异</b> —— 你能不能同时驾驭差异额和差异率，并保护分母
<br>· <b>T09 账龄</b> —— 你能不能把数字翻译成"该催哪一档"的业务动作
<br><br>过了 P4，剩下的窗口函数是<b>纯技术</b>，不再是思维坎。
这很重要：技术是可以查文档的，思维方式查不到。
<br><br>如果你在 T07 上仍然想"先去重再对账"，说明你还没接受"差额是线索"这个观念，
建议把 Day 26 的 exp 再读一遍。这是财务人和"会写 SQL 的人"真正的区别所在。`
  },

  /* ================= P5 ================= */
  32: {
    ans: [
      `-- GROUP BY：22 行，一个月一行，明细信息全没了
SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
       ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales
GROUP BY 1
ORDER BY 1;`,
      `-- 窗口函数：26,284 行一行不少，旁边多出一列
SELECT bill_no, cust_code, qty,
       SUM(qty) OVER (PARTITION BY cust_code) AS 该客户总量,
       ROUND(qty * 100.0 / SUM(qty) OVER (PARTITION BY cust_code), 2) AS 占该客户比
FROM fact_sales
ORDER BY cust_code, bill_no
LIMIT 10;`
    ],
    exp: `<b>一句话区分：GROUP BY 把行"压扁"，窗口函数"保留原行、旁边加一列"。</b>
<br><br>第②组返回 26,284 行 —— 和原表一样多。每一行都还在，
只是多了一列"这个客户的总量"和"本行占该客户的百分比"。
<br><br><b>为什么做"月度收入 + 上月收入"只能用窗口函数：</b>
GROUP BY 之后只剩 22 行，每行只有一个月的数，你没有"上个月"这个东西可以引用。
窗口函数保留了所有行，才能用 <code>LAG</code> 去够上一行。
<br><br><code>OVER (PARTITION BY cust_code)</code> 的意思是"按客户分组，组内计算，但不动行数"。
它和 <code>GROUP BY cust_code</code> 的分组逻辑一样，区别只在输出：
一个压行，一个加列。
<br><br>顺带说 <code>qty * 100.0</code> 里的 <code>.0</code>：整数除整数，SQLite 会给你整数结果（0）。
加个 <code>.0</code> 强制变成浮点。这个坑在算占比、算比率时天天遇到，
另一种写法是 <code>CAST(qty AS REAL)</code>。`
  },
  33: {
    ans: [
      `-- 给每个客户的单据按日期倒序打序号
SELECT cust_code,
       bill_no,
       bill_date,
       ROW_NUMBER() OVER (PARTITION BY cust_code
                          ORDER BY REPLACE(bill_date, '/', '-') DESC, bill_no DESC) AS rn
FROM fact_sales
WHERE cust_code IN ('C1001', 'C1002')
ORDER BY cust_code, rn
LIMIT 12;`
    ],
    exp: `<b><code>PARTITION BY</code> 决定"在哪个范围内排名"，<code>ORDER BY</code> 决定"按什么排"。</b>
两个都不能少，少了 PARTITION BY 就变成全表一个大排名。
<br><br>注意排序里我加了两层：
<br>· <code>ORDER BY REPLACE(bill_date,'/','-') DESC</code> —— 先按日期倒序（最近的排第一）。
<b>必须 REPLACE</b>，否则斜杠日期按字符串排序会跑到最前面或最后面，'2026/10/05' 和 '2026-10-05' 的排序位置不同
<br>· <code>, bill_no DESC</code> —— 同一天有多张单时，用单号兜底，保证 rn 稳定。
这就是 Day 4 讲的"排序要有兜底字段"，在这里第一次真正发挥作用
<br><br><code>ROW_NUMBER</code> 的特点是<b>不留并列</b>：即使两行完全一样，也是 1 和 2。
另外两个兄弟：
<br>· <code>RANK()</code> —— 并列时给相同名次，然后跳号（1,1,3）
<br>· <code>DENSE_RANK()</code> —— 并列时给相同名次，不跳号（1,1,2）
<br>做"取最新一条"用 ROW_NUMBER，做"排名"用 RANK 或 DENSE_RANK。
<br><br>先跑出来看看：C1001 的 rn=1 是哪张单、rn=2 是哪张。确认 rn=1 确实是最新的那张，再往下走。`
  },
  34: { task: 'T12',
    exp: `<b>答案：128 个客户各取最近一笔，最近日期都集中在 2026-10-28。</b>
<br><br>套路固定，背下来：
<pre>WITH t AS (
  SELECT ..., ROW_NUMBER() OVER (PARTITION BY 客户 ORDER BY 日期 DESC) rn
  FROM ...
)
SELECT * FROM t WHERE rn = 1</pre>
<br><br>三个必须检查的地方：
<br>· <b>日期要 REPLACE</b>：斜杠日期排序会错，可能把 2026/10/05 当成"很早"或"很晚"
<br>· <b>要有兜底排序</b>：<code>, bill_no DESC</code>。同一天有多张单时，没有兜底 rn 会跳
<br>· <b>外层才能筛 rn</b>：窗口函数在 SELECT 阶段才计算，WHERE 阶段还没有 rn 这一列。
必须套一层子查询，写 <code>WHERE rn = 1</code> 的那层是外层
<br><br>这个套路能套到无数场景，你只要换两个地方：
<br>· 换 <code>PARTITION BY</code> 的分组字段 → "每个科目最新余额""每个员工最后一次调薪""每个产品最后一次入库"
<br>· 换 <code>ORDER BY</code> → 按金额取最大、按时间取最新、按版本号取最高
<br><br>它比"用 MAX(日期) 子查询再 join 回原表"简单得多，而且不会因为同日多笔而出错。
真实工作里，看到"取每组最新/最大"，第一反应就该是 ROW_NUMBER。`
  },
  35: {
    ans: [
      `WITH m AS (
  SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS 收入
  FROM fact_sales
  GROUP BY 1
)
SELECT 月份,
       ROUND(收入 / 10000, 1) AS 收入万,
       ROUND(LAG(收入) OVER (ORDER BY 月份) / 10000, 1) AS 上月万,
       ROUND((收入 - LAG(收入) OVER (ORDER BY 月份))
             / LAG(收入) OVER (ORDER BY 月份) * 100, 2) AS 环比
FROM m
ORDER BY 月份;`
    ],
    exp: `<b>第一个月的环比是空（NULL），不是 0 —— 这是对的，不要"修"它。</b>
<br><br>因为 2025-01 没有上个月，<code>LAG</code> 够不到东西，只能返回 NULL。
从业务上说，"不知道"和"增长 0%"是两件事：
<br>· 显示 0% 的意思是"这个月和上个月一样"，这是错的陈述
<br>· 显示空白的意思是"没有可比数据"，这是诚实的
<br><br>如果你用 <code>COALESCE(环比, 0)</code> 把它变成 0，报表看起来整齐了，
但会误导读者以为 1 月没增长。<b>在财务报表里，NULL 该显示成 NULL 或"—"，不该填 0。</b>
<br><br>两个技术点：
<br>· <code>LAG(列, n)</code> 的 n 可以取上一行之前的第 n 行。<code>LAG(收入, 12)</code> 就是"去年同月"，做同比
<br>· 环比的分母是上月收入，可能是 0 或 NULL，要么用 <code>NULLIF</code> 保护，要么接受结果是 NULL
<br><br>还有一层结构要注意：<b>必须先 GROUP BY 算好月度收入，再在结果上套 LAG。</b>
不能写 <code>LAG(SUM(收入))</code> 直接套在明细上 —— 那样窗口会在 26,284 行上滑，算出来的东西毫无意义。`
  },
  36: { task: 'T10',
    exp: `<b>答案：110 行（5 个区域 × 22 个月），华东 2026-10 环比是负数。</b>
<br><br>这题的重点是<b>两层结构</b>，不是 LAG 的语法：
<br>① 里层：按"区域 + 月份"聚合，得到 110 行长表
<br>② 外层：在每行上套 <code>LAG(收入) OVER (PARTITION BY 区域 ORDER BY 月份)</code>
<br><br><b>为什么不能写 <code>SELECT region, LAG(SUM(收入))</code>：</b>
窗口函数是在聚合<b>之后</b>才执行的，你不能把窗口套在聚合里面。
正确写法是聚合先发生（里层），窗口在它的结果上计算（外层）。
<br><br><code>PARTITION BY 区域</code> 这句话的意思是"每个区域各自算环比"，
华东的上月是"华东的上个月"，不是"上一个区域"。漏了 PARTITION BY，
就变成跨区域串行排序，环比全乱。
<br><br>结果要检查两件事：
<br>· 总行数应该是 110。如果是 22，说明 PARTITION BY 丢了或者里层没按区域分组
<br>· 每个区域的第一行（2025-01）环比应该是空。如果第一行有值，说明排序或分区写错了
<br><br>环比算出来是百分数，注意乘 100 前先转浮点，不然整数除法会给你 0。`
  },
  37: {
    ans: [
      `WITH m AS (
  SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000 AS 收入万
  FROM fact_sales
  GROUP BY 1
)
SELECT 月份,
       ROUND(收入万, 1)                                   AS 收入万,
       ROUND(SUM(收入万) OVER (ORDER BY 月份), 1)          AS 累计收入万,
       ROUND(SUM(收入万) OVER (), 1)                       AS 全年合计万,
       ROUND(收入万 / SUM(收入万) OVER () * 100, 2)        AS 占全年比
FROM m
ORDER BY 月份;`
    ],
    exp: `<b>就靠括号里有没有 ORDER BY 来区分两个东西：</b>
<br>· <code>SUM(x) OVER (ORDER BY 月份)</code> = <b>累计</b>，跑到当前行为止的合计。逐月往上加
<br>· <code>SUM(x) OVER ()</code> = <b>全表合计</b>，括号里什么都不写，得到一个固定值（899,571.7 万）
<br><br>两者一除，就是"本月占全年多少"。这是所有占比分析的标准写法，
比"再写一个子查询求总额"简洁得多。
<br><br>结果检查：累计那一列最后一行应该正好等于全年合计。<b>如果不等，说明月份有重复或者缺漏。</b>
这是验证累计计算最省事的办法。
<br><br>顺带：<code>OVER (ORDER BY ...)</code> 默认的窗口范围是 <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>，
意思是"从第一行到当前行"。注意是 RANGE 不是 ROWS ——
如果排序字段有重复值（比如同一个月出现两行），RANGE 会把并列的行一起算进去。
所以<b>排序字段最好是唯一的</b>（月份是唯一的，安全）。
<br><br>占全年比加起来应该等于 100%。你可以加一句
<code>SELECT SUM(占全年比)</code> 验证，得到 100 或 99.99 都算正常（四舍五入）。`
  },
  38: { task: 'T11',
    exp: `<b>答案：前 15 个客户累计占 23.5%，要达到 80% 需要 93 个客户（共 128 个）。</b>
<br><br>这套数据<b>帕累托不明显</b> —— 前 4 个客户（就是 T13 里折扣崩掉的那几个）各占 3-4%，
其余近百家各占 1% 左右。真实公司通常更集中（前 20% 客户贡献 70-80%），
所以这里你查不出典型的 80/20 结构。<b>这不是你写错了，是数据本身均匀。</b>
<br><br>这个发现本身就有价值：客户结构很分散，意味着<b>没有大客户依赖风险</b>，
但也意味着营销资源摊得很薄，没有一个能撬动的重点客户群。
<br><br>技术上两个必查项：
<br>· <b>排序必须兜底</b>：<code>ORDER BY 收入 DESC, cust_code</code>。
如果两个客户收入恰好相同又没有兜底，窗口里的累计顺序会随机，累计占比就错位。
这题里恰好没有并列，但你还是得写 —— 这是纪律
<br>· <b>验证最后一行等于 100</b>：把 LIMIT 去掉或改大，
最后一个客户的累计占比应该是 100.00。不等于 100 说明有行被漏了
<br><br>写法上的关键：<b>累计用 <code>SUM() OVER (ORDER BY ...)</code>，
总额用 <code>SUM() OVER ()</code>，两个都在同一个 CTE 里算好</b>，
外层只管除法和排序。不要试图在一层里既算累计又排最终顺序。`
  },
  39: {
    ans: [
      `WITH m AS (
  SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000 AS 收入万
  FROM fact_sales
  GROUP BY 1
)
SELECT 月份,
       ROUND(收入万, 1) AS 收入万,
       ROUND(AVG(收入万) OVER (ORDER BY 月份
                               ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS 三月均,
       ROUND(COUNT(*) OVER (ORDER BY 月份
                            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 0) AS 参与月份数
FROM m
ORDER BY 月份;`
    ],
    exp: `<b><code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code> = "往前数 2 行，到当前行"，共 3 行。</b>
<br><br>前两个月为什么不准？2025-01 只有它自己（1 个值），2025-02 有 2 个值。
所以你看到的"三月均"在开头两行其实是一月均、二月均。
<br><br>我特意加了 <code>COUNT(*) OVER (同一个窗口)</code> 让你看见这件事 ——
前两行的"参与月份数"是 1 和 2，第三行才开始是 3。<b>这就是"移动平均开头不可信"的原因。</b>
<br><br>三种处理方式，各有取舍：
<br>· 照原样显示，让读者接受前两行不准（大多数报表这么做）
<br>· 前两行显示 NULL，标明"数据不足"（更严谨）
<br>· 用 <code>ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>，开头用部分平均（最平滑但口径不一致）
<br><br>注意 <code>ROWS</code> 和 <code>RANGE</code> 的区别：
<code>ROWS</code> 按物理行数数，<code>RANGE</code> 按值的大小范围。
做移动平均要用 <code>ROWS</code>，因为你要的是"前 2 条记录"，不是"值小于等于当前值的所有行"。
<br><br>业务价值：月收入本身波动大（3.2 万到 4.3 万），单月涨跌看不出趋势。
三个月移动平均把噪声压掉，才看得出"整体在往上走"。这也是为什么老板总想看平滑后的曲线。`
  },
  40: {
    ans: [],
    exp: `<b>不看提示，重做 T10、T11、T12，每题限时 20 分钟。</b>
<br><br>验收标准不是"做出来"，而是<b>能说出每道题用的是哪一类窗口函数</b>：
<br>· T10 环比 → <code>LAG</code>（拿上一行）
<br>· T11 帕累托 → <code>SUM() OVER (ORDER BY ...)</code>（累计）+ <code>SUM() OVER ()</code>（总额）
<br>· T12 最近一笔 → <code>ROW_NUMBER</code>（打序号后取 rn=1）
<br><br>这三类覆盖了财务分析 90% 的场景。剩下 10% 是
<code>RANK</code>（排名）、<code>NTILE</code>（分位数）、<code>LEAD</code>（拿下一行），
遇到再查文档就行。
<br><br>如果 T11 卡住，八成是排序没兜底或者累计和总额分了两层写。
如果 T12 卡住，八成是忘了外层才能筛 rn。`
  },
  41: {
    ans: [
      `-- 模板 1：环比（换 维度 / 时间 / 指标 这三处即可）
WITH t AS (
  SELECT c.region AS 维度,
         substr(REPLACE(s.bill_date, '/', '-'), 1, 7) AS 时间,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 指标
  FROM fact_sales s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  GROUP BY 1, 2
)
SELECT 维度, 时间,
       ROUND(指标 / 10000, 1) AS 指标万,
       ROUND(LAG(指标) OVER (PARTITION BY 维度 ORDER BY 时间) / 10000, 1) AS 上期万,
       ROUND((指标 - LAG(指标) OVER (PARTITION BY 维度 ORDER BY 时间))
             / NULLIF(LAG(指标) OVER (PARTITION BY 维度 ORDER BY 时间), 0) * 100, 2) AS 环比
FROM t
ORDER BY 维度, 时间;`,
      `-- 模板 2：占比 + 累计（帕累托）—— 和 T11 一致，先取干净明细
WITH clean AS (
  SELECT DISTINCT bill_no, bill_date, cust_code, sku, qty, unit_price, discount
  FROM fact_sales
), t AS (
  SELECT cust_code AS 维度,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS 金额
  FROM clean
  GROUP BY 1
), r AS (
  SELECT 维度, 金额,
         SUM(金额) OVER (ORDER BY 金额 DESC, 维度) AS 累计,
         SUM(金额) OVER ()                        AS 总额
  FROM t
)
SELECT 维度,
       ROUND(金额 / 10000, 1)        AS 金额万,
       ROUND(累计 / 总额 * 100, 2)    AS 累计占比
FROM r
ORDER BY 金额 DESC
LIMIT 10;`,
      `-- 模板 3：取每组最新一条（换 分组字段 / 时间字段 / 唯一字段）
WITH t AS (
  SELECT cust_code                     AS 分组字段,
         bill_no                       AS 唯一字段,
         REPLACE(bill_date, '/', '-')  AS 时间字段,
         cust_code, qty, unit_price
  FROM fact_sales
), ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY 分组字段
                            ORDER BY 时间字段 DESC, 唯一字段 DESC) AS rn
  FROM t
)
SELECT * FROM ranked WHERE rn = 1 ORDER BY 时间字段 DESC LIMIT 10;`
    ],
    exp: `<b>这三个模板请原样存进你的笔记文件，不要"理解了就行"。</b>
<br><br>真实工作中你不会有时间从零推导。老板下午三点要数，你两点半打开编辑器，
这时候能直接粘一个模板改字段名，和重新想一遍，差的是能不能按时下班。
<br><br>三个模板都有必须保留的细节，别删：
<br>· <b>模板 1 的 <code>NULLIF(分母, 0)</code></b> —— 没有它，某期指标为 0 时整列报错或全变 NULL
<br>· <b>模板 2 的 <code>ORDER BY 金额 DESC, 维度</code></b> —— 兜底字段。少了它，金额并列时累计占比会错位
<br>· <b>模板 3 的 <code>, 唯一字段 DESC</code></b> —— 同一个道理，同一天多条记录时 rn 会跳
<br><br>模板的价值不在于省打字，在于<b>把"我踩过的坑"固化成了默认行为</b>。
你现在写的每一行兜底，都是过去某次交出去的错误报表换来的。`
  },

  /* ================= P6 ================= */
  42: {
    ans: [
      `-- 行转列：把「客户 × 月份」的长表，摊成「客户」一行 + 两个月各一列
SELECT cust_code,
       ROUND(MAX(CASE WHEN 月份 = '2026-09' THEN 收入 END) / 10000, 1) AS 九月万,
       ROUND(MAX(CASE WHEN 月份 = '2026-10' THEN 收入 END) / 10000, 1) AS 十月万
FROM (SELECT cust_code,
             substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
             SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS 收入
      FROM fact_sales
      WHERE substr(REPLACE(bill_date, '/', '-'), 1, 7) IN ('2026-09', '2026-10')
      GROUP BY 1, 2) t
GROUP BY cust_code
ORDER BY 1
LIMIT 10;`
    ],
    exp: `<b>为什么外面要套 MAX？因为分组之后，每个 CASE 只有一行有值。</b>
<br><br>里层已经按"客户 + 月份"聚合过了，所以每个客户在每个月只有一行。
外层 <code>GROUP BY cust_code</code> 把这两行（九月、十月）压成一行时：
<br>· <code>CASE WHEN 月份='2026-09' THEN 收入 END</code> 在十月的行上返回 NULL
<br>· 所以这两行里，九月那列只有一行有值、另一行是 NULL
<br><br>这时候用 <code>MAX</code> 就能把那唯一一个非 NULL 值捞出来（MAX 会忽略 NULL）。
用 <code>SUM</code> 也行，但 <code>MAX</code> 语义更清楚 —— 你做的是"取那一个值"，不是"求和"。
<br><br><b>这里有个前提：里层必须已经聚合过。</b>
如果直接对明细做 <code>MAX(CASE WHEN ...)</code>，一个客户九月有 50 行，
MAX 只会取其中最大的那一行，不是总和 —— 结果全错。
<br><br>这正是 Excel 透视表在做的事：行放客户、列放月份、值放收入合计。
SQL 里没有透视表，就靠 <code>CASE WHEN + MAX</code> 手工摊。
<br><br>列数固定才能这么写。如果月份是动态的（比如要出 24 个月），
SQL 就得动态拼接，那属于报表工具的活，不该硬写 SQL。`
  },
  43: {
    ans: [
      `-- 第①步：按「客户 + 月份」聚合收入成本，得到长表
SELECT TRIM(c.cust_name) AS 客户,
       substr(REPLACE(s.bill_date, '/', '-'), 1, 7) AS 月份,
       ROUND((SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0)))
              - SUM(s.qty * p.std_cost))
             / NULLIF(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))), 0) * 100, 2) AS 毛利率
FROM fact_sales s
JOIN dim_customer c ON s.cust_code = c.cust_code
JOIN dim_product  p ON s.sku = p.sku
WHERE c.region = '华东'
  AND substr(REPLACE(s.bill_date, '/', '-'), 1, 7) IN ('2026-09', '2026-10')
GROUP BY 1, 2
ORDER BY 1, 2;`,
      `-- 第②步：用 CASE + MAX 摊成两列
WITH p AS (
  SELECT TRIM(c.cust_name) AS 客户,
         substr(REPLACE(s.bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 收入,
         SUM(s.qty * p.std_cost) AS 成本
  FROM fact_sales s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  JOIN dim_product  p ON s.sku = p.sku
  WHERE c.region = '华东'
    AND substr(REPLACE(s.bill_date, '/', '-'), 1, 7) IN ('2026-09', '2026-10')
  GROUP BY 1, 2
)
SELECT 客户,
       ROUND(MAX(CASE WHEN 月份 = '2026-09'
                      THEN (收入 - 成本) / NULLIF(收入, 0) * 100 END), 2) AS 九月毛利率,
       ROUND(MAX(CASE WHEN 月份 = '2026-10'
                      THEN (收入 - 成本) / NULLIF(收入, 0) * 100 END), 2) AS 十月毛利率
FROM p
GROUP BY 客户
HAVING 九月毛利率 IS NOT NULL AND 十月毛利率 IS NOT NULL;`
    ],
    exp: `<b>两步都要单独验证，千万别一次写完。</b>
<br><br><b>第①步验证：</b>结果应该是"客户 × 月份"的两行长表，
每个客户出现两次（九月一行、十月一行），华东大约几十个客户。
如果某个客户只出现一次，说明他只有一个月有销售 —— 这种客户在 T13 里<b>必须被排除</b>，
因为算不出"降幅"。
<br><br><b>第②步验证：</b>摊完之后每个客户一行两列。
<code>HAVING 九月毛利率 IS NOT NULL AND 十月毛利率 IS NOT NULL</code> 就是在排除只有单月销售的客户。
如果你不加这个条件，结果里会出现毛利率是空的客户，排序时它们会跑到最前面（NULL 排序最小），
看起来像是"降幅最大的客户"，其实是数据不全。
<br><br><b>为什么第②步里 <code>CASE</code> 用的是 <code>收入 - 成本</code> 而不是重算一遍：</b>
因为 CTE 里已经把收入和成本分别存好了，外面直接减，比再写一遍长表达式更不容易错，
也更快。这是"把复杂计算拆到 CTE"的好处。
<br><br>一个容易忽视的点：<b>客户名要用 <code>TRIM</code></b>。
这套数据里 C1001 的名字带尾随空格，不 TRIM 的话它在结果里看起来是
<code>恒晟实业(华东) </code>，你复制去别处查会对不上。`
  },
  44: { task: 'T13',
    exp: `<b>答案：4 个华东客户，毛利率从 34%+ 掉到负数，降幅 -28 到 -41 个百分点。</b>
<br><br>第一名恒晟实业(华东)：九月 39.36% → 十月 <b>-2.31%</b>，降 41.67 个点。
<br><br><b>怎么向总监解释这件事（这才是这题的终点）：</b>
<br>折扣从 7% 拉到 35%，而标准成本率约 70%。卖一件 100 元的货：
<br>· 正常：收 93 元，成本 70 元，毛利 23 元
<br>· 十月：收 65 元，成本 70 元，<b>毛利 -5 元</b>
<br><br>所以不是"毛利率下降"，是<b>每卖一件亏 5 块</b>。这 4 个客户十月做了多少量，
乘以 5 块，就是这段时间的净损失。这个说法比"毛利率下降了 41 个点"有力得多 ——
财务的价值在于把百分比翻译成钱。
<br><br>三个技术关卡，任何一关没过结果都不对：
<br>· <b>TRIM 客户名</b>：不然 join 不上、分组会分错
<br>· <b>HAVING 排除单月客户</b>：不然 NULL 会插到排序最前面，假装成"降幅最大"
<br>· <b>NULLIF 保护分母</b>：某客户某月如果收入为 0（只有退货），不保护就报错
<br><br>还有一个隐性关卡：<b>不要用 <code>WHERE 毛利率 IS NOT NULL</code> 之前就 LIMIT 8</b>。
先筛掉无效行，再排序取前 8 —— 顺序错了，你可能取到 8 个 NULL。`
  },
  45: {
    ans: [
      `-- 交付物示例：一张能放进汇报的月度经营汇总
WITH clean AS (
  SELECT DISTINCT bill_no, bill_date, cust_code, sku, qty, unit_price, discount
  FROM fact_sales
), m AS (
  SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) AS 收入,
         SUM(qty * unit_price * (1 - COALESCE(discount, 0))) FILTER (WHERE qty < 0) AS 退货
  FROM clean
  GROUP BY 1
)
SELECT 月份,
       ROUND(收入 / 10000, 1) AS 收入万,
       ROUND(LAG(收入) OVER (ORDER BY 月份) / 10000, 1) AS 上月万,
       ROUND((收入 - LAG(收入) OVER (ORDER BY 月份))
             / NULLIF(LAG(收入) OVER (ORDER BY 月份), 0) * 100, 2) AS 环比,
       ROUND(SUM(收入) OVER (ORDER BY 月份) / 10000, 1) AS 累计万
FROM m
ORDER BY 月份;`
    ],
    exp: `<b>今天不学新东西，做收尾。三件事按顺序做完。</b>
<br><br><b>① 把 13 条 SQL 导出成一个文件。</b>不是截图，是能复制粘贴的 .sql 文件。
按"体检 / 口径 / 多表 / 窗口"分四段，每段前面写一行注释说明这段解决什么问题。
这个东西将来就是你面试时的作品 —— 打开给人看，比说"我考了某某证"有用一百倍。
<br><br><b>② 写下 5 条你踩过的坑。</b>必须是你自己踩的，不是抄的。参考方向：
<br>· 斜杠日期让月份凭空多出一倍（44 行 vs 22 行）
<br>· <code>WHERE cust_name = 'xxx'</code> 因为尾随空格返回 0 行
<br>· 先汇总再 join 明细，金额放大 3.7 倍
<br>· <code>WHERE 条件</code> 写在 LEFT JOIN 的 WHERE 里，退化成 INNER
<br>· 排序没加兜底字段，结果每天不一样
<br><br><b>③ 用真实工作里的一张表，重写一条你以前手工做的查询。</b>
这一步是整套练习唯一能证明"学到的东西能用"的动作。建议从这几个里挑一个：
<br>· 应收账龄（财务每月都要出）
<br>· 费用部门对比（月度经营会要用）
<br>· 某个指标的环比
<br><br>上面那段 SQL 是给你看的成品长什么样：干净的 CTE、口径写清楚、环比和累计都算好。
<b>注意 <code>FILTER (WHERE qty &lt; 0)</code> 这个写法</b> —— 它是 <code>SUM(CASE WHEN ...)</code> 的简化版，
SQLite 3.30+ 支持。你写 <code>CASE WHEN</code> 版本也完全正确，两种都认识就行。
<br><br>做完第③步，这套练习才真正变成你的能力。前面 44 天都是练习，第 45 天是把练习变成工作。`
  }
};
