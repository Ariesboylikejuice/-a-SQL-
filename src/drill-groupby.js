/* GROUP BY 分组专项 · 8 题
   配套 45 天计划的 Day 06。
   每条 ans 里的 SQL 都在真实账套上跑过（test/verify-drill.mjs 可复验），解析里的数字全部来自真实结果。
   数据里故意埋的坑：退货负数行 424 行、斜杠日期 855 行、折扣 NULL 814 行、60 张单据重复录入、8 个客户一客多码、42 条客户名带尾随空格。 */

const DRILLS = [
  /* ---------------- 1 ---------------- */
  {
    n: 1,
    title: 'GROUP BY 到底在做什么',
    min: '15 min',
    learn: 'GROUP BY 就是「把值相同的行攒成一堆，每堆只输出一行」。<br>规则只有一条：SELECT 里除聚合函数外的列，必须出现在 GROUP BY 里，否则结果不确定。',
    todo: '① 按 <code>region</code> 数客户；② 按 <code>industry</code> 数客户。各跑一次，看行数。',
    check: '能说出为什么一次 5 行、一次 8 行，而且两次加起来都是 128。',
    ans: [
      `-- ① 按区域
SELECT region AS 区域, COUNT(*) AS 客户数
FROM dim_customer
GROUP BY region
ORDER BY 客户数 DESC;`,
      `-- ② 按行业
SELECT industry AS 行业, COUNT(*) AS 客户数
FROM dim_customer
GROUP BY industry
ORDER BY 客户数 DESC;`
    ],
    exp: `<b>结果是 5 行和 8 行，两边都合计 128。</b>
<br>区域：华东 43、华南 22、西南 21、华北 21、华中 21。
<br>行业：制造业 21、互联网 20、医疗 18、零售 17、教育 16、服务业 14、建筑 13、贸易 9。
<br><br>关键认知：<b>输出行数 = 分组键里有几个不同取值</b>。区域只有 5 个值，所以 5 行，和表里有多少行客户无关。GROUP BY 不减少“数据量”，它减少的是“输出行数”，128 个客户全被算进去了。
<br><br>一个必须知道的坑：如果你写
<pre>SELECT region, cust_name, COUNT(*)
FROM dim_customer
GROUP BY region;</pre>
SQLite <b>不会报错</b>，它会从每组里随手挑一个 <code>cust_name</code> 给你。结果是“华东 43 人”，但客户名显示的是某一个随机客户 —— 这个数看着对，含义是假的。
<br>MySQL 在 <code>ONLY_FULL_GROUP_BY</code> 模式下会直接拦下这种写法，SQLite 却放行。所以在练习台里写错了没提示，不代表写对了。`
  },

  /* ---------------- 2 ---------------- */
  {
    n: 2,
    title: 'SUM 里有负数：退货要不要算',
    min: '20 min',
    learn: 'GROUP BY 只管分组，不管正负。<code>SUM</code> 会把负数一起加进来 —— 这通常是<b>对的</b>，因为退货本来就要冲减销量。',
    todo: '按品类汇总 <code>qty</code>，同时数一下明细行数。再单独查一次 <code>WHERE qty &lt; 0</code> 有多少行、合计多少件。',
    check: '能解释为什么 8 个品类的销量都不是整数感，并说清「过滤掉退货」为什么是错的。',
    ans: [
      `-- 按品类汇总销量
SELECT p.category AS 品类,
       SUM(s.qty)   AS 销量,
       COUNT(*)     AS 明细行数
FROM fact_sales s
JOIN dim_product p ON s.sku = p.sku
GROUP BY p.category
ORDER BY 销量 DESC;`,
      `-- 退货到底有多少
SELECT COUNT(*)  AS 退货行数,
       SUM(qty)  AS 退货件数
FROM fact_sales
WHERE qty < 0;`
    ],
    exp: `<b>8 个品类的销量：</b>耗材 80,504、存储设备 80,299、技术服务 78,565、配件 63,987、服务器 62,640、网络设备 56,060、软件授权 53,766、云服务 51,677。
<br><br><b>退货：424 行，合计 -3,573 件。</b>退货行数占全表 26,284 行的 1.6%，和造数据时设定的比例一致。
<br><br>所以那两个数字是这么来的：耗材正向卖出 81,011 件，退掉 507 件，净 80,504 件。
<br><br>下面这个错法很常见，而且看起来很“干净”：
<pre>-- 错：把退货当脏数据过滤掉
WHERE qty &gt; 0</pre>
销量会整体偏高 0.5% 左右，每个品类都偏高一点点，<b>不会报错、不会离谱，只是每个月都比业务部门的数多一点点</b>。这种错误最难查。
<br><br>判断标准很简单：<b>退货是业务事实，负数是它的表达方式，不是脏数据。</b>真正该过滤的是重复录入（那是录入事故），不是退货。
<br><br>另一个容易混的：<code>SUM(qty)</code> 是件数，<code>SUM(qty*unit_price)</code> 是金额。两个不能放进同一张表按同一列排序 —— 单位不同，排出来的顺序没有意义。`
  },

  /* ---------------- 3 ---------------- */
  {
    n: 3,
    title: '分组前先洗分组键：月份',
    min: '25 min',
    learn: 'GROUP BY 是拿“值”去比对的。<b>值不一样就是不同的组</b>，哪怕它们在业务上是同一个月。所以分组键必须先洗干净再分组。',
    todo: '先不加 REPLACE 按 <code>substr(bill_date,1,7)</code> 汇总一次，再加上 <code>REPLACE</code> 跑一次，数行数。',
    check: '44 行 vs 22 行；2026-10 在第一次里被拆成 1557 行和 66 行两行。',
    ans: [
      `-- 错：不洗日期直接分组
SELECT substr(bill_date, 1, 7) AS 月份, COUNT(*) AS 行数
FROM fact_sales
GROUP BY 1
ORDER BY 1;`,
      `-- 对：先统一分隔符再分组
SELECT substr(REPLACE(bill_date, '/', '-'), 1, 7) AS 月份,
       ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales
GROUP BY 1
ORDER BY 1;`
    ],
    exp: `<b>错的那句得到 44 行，对的那句得到 22 行。</b>
<br>2025-01 到 2026-10，一共 22 个月，全年合计 899,571.7 万元。
<br><br>多出来的 22 行全是假的：<code>2026-10</code> 和 <code>2026/10</code> 被当成两个不同的组。2026-10 那一个月被拆成 <b>1,557 行 + 66 行</b>两组，两边金额都不对。
<br><br>更阴的地方在于：<b>如果你只看总数，它是对的</b>（22 个月加起来还是 899,571.7 万）。只有按月看趋势、算环比时才会发现“某个月突然掉了一半，下个月又翻倍”。
<br><br>要建立的反射：<b>凡是 <code>GROUP BY substr(日期列, ...)</code>，先问一句“这个日期列的格式统一吗”。</b>查一次就知道了：
<pre>SELECT substr(bill_date, 5, 1) AS 第5位, COUNT(*) AS 行数
FROM fact_sales
GROUP BY 1;</pre>
会有两行：<code>-</code> 有 25,429 行，<code>/</code> 有 855 行。
<br><br>另一种更彻底的写法是先在子查询里把月份算成一列，外层再 GROUP BY 别名。这样分组键只算一次，不会出现“上面写了 REPLACE、下面忘了写”的不一致：
<pre>SELECT 月份, SUM(...) FROM (
  SELECT substr(REPLACE(bill_date,'/','-'),1,7) AS 月份, ...
) GROUP BY 月份;</pre>`
  },

  /* ---------------- 4 ---------------- */
  {
    n: 4,
    title: 'HAVING：筛的是组，不是行',
    min: '20 min',
    learn: 'WHERE 在分组<b>之前</b>筛行，HAVING 在分组<b>之后</b>筛组。聚合结果（SUM/COUNT/AVG）只能在 HAVING 里判断，写进 WHERE 一定报错。',
    todo: '找出全年收入超过 1 亿的客户。先故意把条件写进 WHERE，看报什么错，再改用 HAVING。',
    check: '4 个客户，且都在华东；能说清 WHERE 和 HAVING 的执行顺序为什么决定了这件事。',
    ans: [
      `-- 错：聚合条件写进 WHERE
SELECT cust_code, SUM(qty * unit_price) AS 收入
FROM fact_sales
WHERE SUM(qty * unit_price) > 100000000
GROUP BY cust_code;`,
      `-- 对：聚合条件写进 HAVING
SELECT cust_code,
       ROUND(SUM(qty * unit_price * (1 - COALESCE(discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales
GROUP BY cust_code
HAVING SUM(qty * unit_price * (1 - COALESCE(discount, 0))) > 100000000
ORDER BY 收入万 DESC;`
    ],
    exp: `<b>结果 4 行：</b>C1001 34,085.7 万、C1007 30,450.1 万、C1013 28,716.5 万、C1019 27,335.0 万。
<br>四个全是华东客户，第 5 名 C1097 只有 8,990.9 万 —— 断层很明显，过亿的只有这 4 家。
<br><br>错误那句报 <code>misuse of aggregate: SUM()</code>。原因是执行顺序：
<pre>FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY</pre>
WHERE 阶段连“组”都还没生成，自然没有 SUM 值可判断。这就是为什么规则不是“建议”，而是语法上就不可能。
<br><br>实务提醒：HAVING 里把 SUM 表达式重复写一遍很啰嗦，而且容易和 SELECT 里写的不一致（比如这边扣了折扣、那边忘了扣）。MySQL 和 SQLite 允许 HAVING 直接用 SELECT 的别名，但标准 SQL 不支持，换到别的库会报错。稳妥做法是套一层：
<pre>SELECT * FROM (
  SELECT cust_code, ROUND(SUM(...),0) AS 收入
  FROM fact_sales GROUP BY cust_code
) WHERE 收入 &gt; 100000000;</pre>
这层子查询不丢人，反而更容易被人看懂。`
  },

  /* ---------------- 5 ---------------- */
  {
    n: 5,
    title: '两维分组：GROUP BY 两列',
    min: '20 min',
    learn: 'GROUP BY 写两列，分的是「组合」而不是「两列分别」。<code>GROUP BY region, category</code> 得到的是 (华东,服务器) 这样的格子，不是两张独立的表。',
    todo: '做一张「区域 × 品类」的收入表。数一下多少行，再想为什么是这个数。',
    check: '40 行 = 5 个区域 × 8 个品类，没有空格子；能说出这结果离透视表还差什么。',
    ans: [
      `SELECT c.region   AS 区域,
       p.category AS 品类,
       ROUND(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales s
JOIN dim_customer c ON s.cust_code = c.cust_code
JOIN dim_product  p ON s.sku       = p.sku
GROUP BY 1, 2
ORDER BY 1, 收入万 DESC;`
    ],
    exp: `<b>40 行，5 × 8 正好铺满，一格不空。</b>说明每个区域每个品类都有交易 —— 这一点值得顺手记下来，如果哪天真出现空格子（某区域某品类零销售），那本身就是一个业务问题。
<br><br>最高的一格是<b>华东 × 存储设备 105,714.5 万</b>，是华中同类（35,536.8 万）的三倍。华东整个区域收入约占全公司一半，这个集中度后面 Day 42 做行转列时会更直观。
<br><br>要理解的关键点：<b><code>GROUP BY 1, 2</code> 不是“先按区域分、再按品类分”，而是“按 (区域, 品类) 这个组合分”。</b>区域内部的品类顺序、品类内部的区域顺序，都不会影响结果。
<br><br>顺带说 <code>GROUP BY 1, 2</code> 的写法：数字指 SELECT 里的第几列。它省事，但 SELECT 一改列顺序，分组就悄悄变了，而且不报错。<b>正式交付的 SQL 建议写列名</b>，只有临时代码才用序号。
<br><br>这个结果已经是透视表的“长表”形态了。要变成老板想看的样子（行是区域、列是品类），还差一步行转列 —— 就是 Day 42 会做的 <code>MAX(CASE WHEN ... END)</code>。`
  },

  /* ---------------- 6 ---------------- */
  {
    n: 6,
    title: 'COUNT(*) 的陷阱：行数不是单数',
    min: '25 min',
    learn: '<code>COUNT(*)</code> 数行，<code>COUNT(DISTINCT 列)</code> 数不重复值。一张单据有多个产品行，所以这两个数能差三倍。',
    todo: '按 <code>sales_owner</code> 汇总三个指标：明细行数、真实单据数、收入。然后算一下全表平均每张单几行。',
    check: '能说出为什么第一列比第二列大约 3 倍，以及对外报「开了多少单」时该用哪个。',
    ans: [
      `SELECT c.sales_owner                AS 负责人,
       COUNT(*)                          AS 明细行数,
       COUNT(DISTINCT s.bill_no)         AS 真实单据数,
       ROUND(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales s
JOIN dim_customer c ON s.cust_code = c.cust_code
GROUP BY c.sales_owner
ORDER BY 收入万 DESC;`,
      `-- 全表核对：平均每单几行
SELECT COUNT(*)                  AS 明细行数,
       COUNT(DISTINCT bill_no)   AS 单据数,
       ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT bill_no), 2) AS 平均每单行数
FROM fact_sales;`
    ],
    exp: `<b>六个人的结果：</b>叶青 6,361 行 / 2,104 单 / 216,022.4 万；周瑞 4,508 / 1,465 / 156,166.8 万；李晖 3,909 / 1,293 / 133,888.4 万；王振 3,835 / 1,279 / 133,210.4 万；陈曦 3,881 / 1,284 / 131,515.4 万；孙莉 3,790 / 1,255 / 128,768.2 万。
<br>全表：<b>26,284 行 / 8,680 单 / 平均每单 3.03 行。</b>
<br><br>所以“叶青开了 6,361 单”是错的，他开的是 <b>2,104 单</b>。6,361 是他经手的产品明细行数。
<br><br>这件事在财务上很关键：<b>对外报「本月开单量」，写 COUNT(*) 会虚高 3 倍。</b>业务部门一核对就发现对不上，然后你所有数字的可信度都会被打折。
<br><br>同一个 GROUP BY 里，三个 COUNT 含义完全不同：
<pre>COUNT(*)                    -- 行数（明细条数）
COUNT(DISTINCT bill_no)     -- 单据数
COUNT(DISTINCT cust_code)   -- 客户数</pre>
写之前先想清楚要回答的是哪个问题，别指望一个 COUNT 通吃。
<br><br>还有一个细节：<code>COUNT(列名)</code> 和 <code>COUNT(*)</code> 也不一样 —— 前者跳过 NULL。这套数据里 <code>discount</code> 有 814 行是 NULL，所以 <code>COUNT(discount)</code> 会比 <code>COUNT(*)</code> 少 814。`
  },

  /* ---------------- 7 ---------------- */
  {
    n: 7,
    title: '一客多码：按名字分组还是按编码分组',
    min: '25 min',
    learn: '分组键选谁，决定了你数出来的是「结算主体」还是「公司名字」。这两个数在这套账里差 8，而背后藏着真实的业务风险。',
    todo: '分别按 <code>cust_code</code> 和 <code>TRIM(cust_name)</code> 分组，比组数；再单独看「远方教育(华中)」这个客户。',
    check: '128 vs 120；能找出 8 个双编码客户；能说出按名称合并后远方教育排到第几。',
    ans: [
      `-- 按编码分组（结算主体口径）
SELECT COUNT(DISTINCT cust_code) AS 编码组数 FROM dim_customer;`,
      `-- 按名称分组（必须先 TRIM）
SELECT COUNT(*) AS 名称组数 FROM (
  SELECT TRIM(cust_name) FROM dim_customer GROUP BY 1
);`,
      `-- 找出双编码客户
SELECT TRIM(cust_name) AS 客户,
       COUNT(*)        AS 编码数,
       GROUP_CONCAT(cust_code) AS 编码
FROM dim_customer
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY 客户;`,
      `-- 远方教育：按名称合并后是多少
SELECT TRIM(c.cust_name) AS 客户,
       COUNT(DISTINCT c.cust_code) AS 编码数,
       ROUND(SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) / 10000, 1) AS 收入万
FROM fact_sales s
JOIN dim_customer c ON s.cust_code = c.cust_code
WHERE TRIM(c.cust_name) = '远方教育(华中)'
GROUP BY 1;`
    ],
    exp: `<b>128 个编码，120 个名称，差 8 个。</b>
<br><br>这 8 个客户各有两个编码：
<br>恒晟实业(西南) C1004 / C1121、中远物流(总部) C1018 / C1122、华翔建材(总部) C1042 / C1123、远方教育(华中) C1059 / C1124、天成机械(华东) C1067 / C1125、金桥商贸(华北) C1080 / C1126、恒信汽车(华南) C1093 / C1127、星辰文旅(华南) C1111 / C1128。
<br><br>远方教育(华中) 拆开看：C1059 收入 7,898.5 万，C1124 收入 6,594.1 万，合并后 <b>14,492.5 万</b>。
<br>这个差距决定排名：按编码它是两家各自进不了前十的中型客户，按名称合并后能进前五。这就是“大客户看不见”和“客户数虚高”同时发生的机制。
<br><br>那到底该按哪个分组？<b>看你要回答什么问题：</b>
<br>· 算应收账龄、信用额度占用 → 按<b>编码</b>。每个编码是独立的结算主体，额度是分开给的，合并会算出超额但其实没超。
<br>· 数“服务了多少家公司”、做客户集中度分析 → 按<b>名称</b>合并，但前提是有一张主数据映射表，而不是靠 TRIM 猜。
<br><br>实务上的正确做法不是二选一，而是<b>先修主数据</b>：建一张 <code>cust_code → 主客户ID</code> 的映射表，两个口径都能出，且能解释差异。直接按名字汇总看着省事，实际是把两个不同的信用主体合成一个，账龄一算就露馅。
<br><br>最后一个坑：<code>cust_name</code> 有 42 条带尾随空格。按名字分组<b>必须 TRIM</b>，否则 <code>'恒晟实业(华东)'</code> 和 <code>'恒晟实业(华东) '</code> 会被算成两家 —— 这个比一客多码更隐蔽，因为它不报错、组数还会变成 121 这种奇怪的数。`
  },

  /* ---------------- 8 ---------------- */
  {
    n: 8,
    title: '每组第一名：GROUP BY 给不了的东西',
    min: '30 min',
    learn: 'GROUP BY 的输出是「每组一行」。而“每组第一名”需要知道组内<b>每一行</b>的排名 —— 这是两个不同层次的信息，必须分两步。',
    todo: '找出每个区域收入最高的那个客户。先试一下能不能只用 GROUP BY 写出来，再上窗口函数。',
    check: '5 行，每个区域一个；能说清为什么必须分两层。',
    ans: [
      `-- 推荐：CTE + ROW_NUMBER
WITH t AS (
  SELECT c.region    AS 区域,
         s.cust_code AS 客户,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 收入
  FROM fact_sales s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  GROUP BY 1, 2
),
r AS (
  SELECT 区域, 客户, 收入,
         ROW_NUMBER() OVER (PARTITION BY 区域 ORDER BY 收入 DESC, 客户) AS rn
  FROM t
)
SELECT 区域, 客户, ROUND(收入 / 10000, 1) AS 收入万
FROM r
WHERE rn = 1
ORDER BY 收入万 DESC;`,
      `-- 退一步：不用窗口函数的老写法（聚合两次，再 JOIN 回去）
WITH t AS (
  SELECT c.region    AS 区域,
         s.cust_code AS 客户,
         SUM(s.qty * s.unit_price * (1 - COALESCE(s.discount, 0))) AS 收入
  FROM fact_sales s
  JOIN dim_customer c ON s.cust_code = c.cust_code
  GROUP BY 1, 2
),
m AS (
  SELECT 区域, MAX(收入) AS 最高 FROM t GROUP BY 区域
)
SELECT t.区域, t.客户, ROUND(t.收入 / 10000, 1) AS 收入万
FROM t
JOIN m ON m.区域 = t.区域 AND m.最高 = t.收入
ORDER BY 收入万 DESC;`
    ],
    exp: `<b>5 行，每个区域一个：</b>华东 C1001 34,085.7 万、华北 C1098 8,647.0 万、华中 C1017 8,388.8 万、华南 C1009 8,074.0 万、西南 C1100 7,355.7 万。
<br><br>为什么单纯 GROUP BY 写不出来：GROUP BY 已经“把一组的行压成一行”了，输出里根本没有“组内其他行”的信息。<code>MAX(收入)</code> 能告诉你最大金额是多少，但<b>告诉不了你是谁</b>。
<br><br>所以必须分两层：
<br>· 内层 GROUP BY：把 26,284 行明细压成“区域 × 客户”的金额表
<br>· 外层 ROW_NUMBER：在这张已经汇总好的表上，按区域编号
<br><br>这个“先聚合、再排名”的顺序千万别反过来。如果在内层还没聚合时就用 <code>PARTITION BY region ORDER BY qty*unit_price</code>，你排的是单行明细，不是客户。
<br><br><code>ORDER BY 收入 DESC, 客户</code> 后面那个 <code>客户</code> 是为了<b>并列时结果稳定</b>。没有它，两家金额相同时每次跑出来谁是第一都可能不一样 —— 这种不确定性在审计场景是灾难。
<br><br>第 2 段那种写法（聚合两次再 JOIN 回去）也能得到同样的 5 行，它不依赖窗口函数，在很老的数据库上也能跑。但有两点不如 ROW_NUMBER：
<br>· <b>并列时会多出行</b>。如果某区域有两家并列第一，JOIN 会把两家都留下 —— 有时候这正是你想要的（并列第一就是两家），有时候不是。
<br>· 要扫两遍数据，还得在内存里再连一次。
<br>ROW_NUMBER 可以人为裁决（再补一个排序键），也可以用 <code>RANK()</code> 保留并列，控制权在你手上。
<br><br>一个我自己在这套数据上踩到的坑，值得记一下：我最初想用「相关子查询」把内层 MAX 关联到外层，写成
<pre>HAVING SUM(...) = (
  SELECT MAX(x.amt) FROM (...) x
  WHERE x.rg = c.region )</pre>
SQLite <b>不报错，直接返回 0 行</b> —— 它没能从 HAVING 里的派生表反向关联外层的分组列 <code>c.region</code>。这种「不报错、结果是空」的错最耗时间，遇到了先怀疑关联写错，别怀疑数据里没有。
<br><br>顺带一个业务读数：华东第一名（3.4 亿）是华北第一名（8,647 万）的<b>近 4 倍</b>。区域之间不是均势，是华东一家独大。这类结论比“华东收入最高”有价值得多，因为前者直接指向资源该往哪投。`
  }
];

if (typeof window !== 'undefined') window.DRILLS = DRILLS;
if (typeof module !== 'undefined' && module.exports) module.exports = { DRILLS };
