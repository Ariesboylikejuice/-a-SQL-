/* 把生成的数据灌进 SQLite（浏览器与 node 共用） */
function insertAll(db, d) {
  const plan = [
    ['dim_customer', ['cust_code', 'cust_name', 'industry', 'region', 'sales_owner', 'credit_limit', 'onboard_date'], d.customers],
    ['dim_product', ['sku', 'sku_name', 'category', 'std_cost', 'list_price'], d.products],
    ['dim_dept', ['dept_id', 'dept_name', 'cost_center'], d.depts],
    ['fact_sales', ['bill_no', 'bill_date', 'cust_code', 'sku', 'qty', 'unit_price', 'discount', 'tax_rate'], d.sales],
    ['fact_gl', ['voucher_no', 'post_date', 'period', 'acc_code', 'acc_name', 'dept_id', 'debit', 'credit', 'summary'], d.gl],
    ['dim_budget', ['period', 'dept_id', 'acc_code', 'budget_amt'], d.budget],
    ['fact_ar', ['cust_code', 'invoice_no', 'invoice_date', 'due_date', 'amount', 'settled_amt', 'snapshot_date'], d.ar]
  ];
  db.run('BEGIN');
  plan.forEach(([table, cols, rows]) => {
    const ph = '(' + cols.map(() => '?').join(',') + ')';
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${ph}`);
    rows.forEach((r) => {
      stmt.run(cols.map((c) => (r[c] === undefined ? null : r[c])));
    });
    stmt.free();
  });
  db.run('COMMIT');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { insertAll };
}
