const prisma = require('../prisma/client');

const DEFAULT_TOP_LIMIT = 5;

class ReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function startOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function resolvePeriod(period, fromQuery, toQuery) {
  const now = new Date();

  if (period === 'custom') {
    if (!fromQuery || !toQuery) {
      throw new ReportError('from and to are required when period=custom');
    }
    const from = startOfDayUTC(fromQuery);
    const to = endOfDayUTC(toQuery);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new ReportError('from must be a valid date before to');
    }
    return { from, to };
  }

  if (period === 'monthly') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { from, to };
  }

  if (period === 'yearly') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    return { from, to };
  }

  // weekly (default): last 7 days ending today, inclusive
  const to = endOfDayUTC(now);
  const from = startOfDayUTC(now);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from, to };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyBuckets(from, to) {
  const buckets = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    buckets.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function toNumber(decimal) {
  return decimal === null || decimal === undefined ? 0 : Number(decimal);
}

async function getReportSummary({ period = 'weekly', from: fromQuery, to: toQuery, topCategoriesLimit, topCustomersLimit }) {
  const { from, to } = resolvePeriod(period, fromQuery, toQuery);
  const categoriesLimit = topCategoriesLimit || DEFAULT_TOP_LIMIT;
  const customersLimit = topCustomersLimit || DEFAULT_TOP_LIMIT;

  const [sales, expenses] = await Promise.all([
    prisma.sales.findMany({
      where: { bill_date: { gte: from, lte: to } },
      include: { customers: { select: { id: true, name: true } } },
    }),
    prisma.expenses.findMany({
      where: { expense_date: { gte: from, lte: to } },
      include: { expense_categories: { select: { id: true, name: true } } },
    }),
  ]);

  const sales_total = sales.reduce((sum, s) => sum + toNumber(s.total_amount), 0);
  const expenses_total = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const net_profit = sales_total - expenses_total;
  const profit_margin_pct = sales_total > 0 ? Number(((net_profit / sales_total) * 100).toFixed(2)) : 0;

  const dayKeys = buildDailyBuckets(from, to);
  const salesByDay = Object.fromEntries(dayKeys.map((d) => [d, 0]));
  const expensesByDay = Object.fromEntries(dayKeys.map((d) => [d, 0]));

  for (const sale of sales) {
    if (!sale.bill_date) continue;
    const key = dateKey(sale.bill_date);
    if (key in salesByDay) salesByDay[key] += toNumber(sale.total_amount);
  }
  for (const expense of expenses) {
    if (!expense.expense_date) continue;
    const key = dateKey(expense.expense_date);
    if (key in expensesByDay) expensesByDay[key] += toNumber(expense.amount);
  }

  const sales_vs_expenses = dayKeys.map((date) => ({
    date,
    sales: Number(salesByDay[date].toFixed(2)),
    expenses: Number(expensesByDay[date].toFixed(2)),
  }));

  let running = 0;
  const cumulative_profit = dayKeys.map((date) => {
    running += salesByDay[date] - expensesByDay[date];
    return { date, cumulative: Number(running.toFixed(2)) };
  });

  const categoryTotals = new Map();
  for (const expense of expenses) {
    const key = expense.category_id;
    const name = expense.expense_categories?.name || 'Uncategorized';
    const entry = categoryTotals.get(key) || { category_id: key, name, amount: 0 };
    entry.amount += toNumber(expense.amount);
    categoryTotals.set(key, entry);
  }
  const top_expense_categories = [...categoryTotals.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, categoriesLimit)
    .map((c) => ({ ...c, amount: Number(c.amount.toFixed(2)) }));

  const statusTotals = new Map();
  for (const sale of sales) {
    const key = sale.payment_status;
    const entry = statusTotals.get(key) || { status: key, count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += toNumber(sale.total_amount);
    statusTotals.set(key, entry);
  }
  const sales_by_status = [...statusTotals.values()].map((s) => ({ ...s, amount: Number(s.amount.toFixed(2)) }));

  const methodTotals = new Map();
  for (const sale of sales) {
    const key = sale.payment_type || 'Unspecified';
    const entry = methodTotals.get(key) || { payment_type: key, amount: 0 };
    entry.amount += toNumber(sale.total_amount);
    methodTotals.set(key, entry);
  }
  const sales_by_payment_method = [...methodTotals.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((m) => ({ ...m, amount: Number(m.amount.toFixed(2)) }));

  const customerTotals = new Map();
  for (const sale of sales) {
    if (!sale.customer_id) continue;
    const key = sale.customer_id;
    const name = sale.customers?.name || 'Unknown';
    const entry = customerTotals.get(key) || { customer_id: key, name, amount: 0 };
    entry.amount += toNumber(sale.total_amount);
    customerTotals.set(key, entry);
  }
  const top_customers = [...customerTotals.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, customersLimit)
    .map((c) => ({ ...c, amount: Number(c.amount.toFixed(2)) }));

  return {
    period: { type: period, from: dateKey(from), to: dateKey(to) },
    sales_total: Number(sales_total.toFixed(2)),
    sales_count: sales.length,
    expenses_total: Number(expenses_total.toFixed(2)),
    expenses_count: expenses.length,
    net_profit: Number(net_profit.toFixed(2)),
    profit_margin_pct,
    sales_vs_expenses,
    cumulative_profit,
    top_expense_categories,
    sales_by_status,
    sales_by_payment_method,
    top_customers,
  };
}

module.exports = { ReportError, getReportSummary };
