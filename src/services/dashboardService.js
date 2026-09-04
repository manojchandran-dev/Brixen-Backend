const prisma = require('../prisma/client');

const WEEKLY_SIGNUP_WEEKS = 11;
const RECENT_SALES_LIMIT = 5;

function startOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

async function getWeeklySignups() {
  const now = new Date();
  const firstWeekStart = startOfWeek(now);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - (WEEKLY_SIGNUP_WEEKS - 1) * 7);

  const companies = await prisma.companies.findMany({
    where: { created_at: { gte: firstWeekStart } },
    select: { created_at: true },
  });

  const buckets = [];
  for (let i = 0; i < WEEKLY_SIGNUP_WEEKS; i += 1) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + i * 7);
    buckets.push({ week_start: weekStart.toISOString().slice(0, 10), count: 0 });
  }

  for (const company of companies) {
    if (!company.created_at) continue;
    const weekStart = startOfWeek(company.created_at).toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.week_start === weekStart);
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

async function getSubscriptionPlanBreakdown() {
  const rows = await prisma.companies.groupBy({
    by: ['subscription_plan'],
    _count: { _all: true },
  });

  return rows.map((row) => ({
    plan: row.subscription_plan || 'UNSET',
    count: row._count._all,
  }));
}

async function getRecentSales() {
  const sales = await prisma.sales.findMany({
    take: RECENT_SALES_LIMIT,
    orderBy: { created_at: 'desc' },
    include: { customers: { select: { name: true } } },
  });

  return sales.map((sale) => ({
    id: sale.id,
    customer_name: sale.customers?.name || null,
    date: sale.bill_date,
    amount: sale.total_amount,
    status: sale.payment_status,
  }));
}

async function getDashboardSummary() {
  const [companiesTotal, companiesActive, employeesTotal, weeklySignups, subscriptionPlans, recentSales] =
    await Promise.all([
      prisma.companies.count(),
      prisma.companies.count({ where: { status: 'ACTIVE' } }),
      prisma.employees.count(),
      getWeeklySignups(),
      getSubscriptionPlanBreakdown(),
      getRecentSales(),
    ]);

  return {
    companies: { total: companiesTotal, active: companiesActive },
    employees: { total: employeesTotal },
    weekly_signups: weeklySignups,
    subscription_plans: subscriptionPlans,
    recent_sales: recentSales,
  };
}

const RECENT_LIMIT = 3;

async function getCompanyRecentSales(company_id) {
  const sales = await prisma.sales.findMany({
    where: { company_id },
    take: RECENT_LIMIT,
    orderBy: { created_at: 'desc' },
    include: { customers: { select: { name: true } } },
  });

  return sales.map((sale) => ({
    id: sale.id,
    customer_name: sale.customers?.name || null,
    date: sale.bill_date,
    amount: sale.total_amount,
    status: sale.payment_status,
  }));
}

async function getCompanyRecentExpenses(company_id) {
  const expenses = await prisma.expenses.findMany({
    where: { company_id },
    take: RECENT_LIMIT,
    orderBy: { created_at: 'desc' },
    include: { expense_categories: { select: { name: true } } },
  });

  return expenses.map((expense) => ({
    id: expense.id,
    title: expense.title,
    category_name: expense.expense_categories?.name || null,
    date: expense.expense_date,
    amount: expense.amount,
    payment_method: expense.payment_method,
  }));
}

async function getCompanyDashboardSummary(company_id) {
  const [employeesTotal, customersTotal, productsTotal, recentSales, recentExpenses] = await Promise.all([
    prisma.employees.count({ where: { company_id } }),
    prisma.customers.count({ where: { company_id } }),
    prisma.products.count({ where: { company_id } }),
    getCompanyRecentSales(company_id),
    getCompanyRecentExpenses(company_id),
  ]);

  return {
    employees: { total: employeesTotal },
    customers: { total: customersTotal },
    products: { total: productsTotal },
    recent_sales: recentSales,
    recent_expenses: recentExpenses,
  };
}

module.exports = { getDashboardSummary, getCompanyDashboardSummary };
