const prisma = require('../../../prisma/client');
const { healthReport } = require('../../../utils/health');

// "Today", "this month" and signup weeks are in IST (UTC+5:30, no DST).
// Timestamps are stored in UTC, so boundaries are computed as UTC instants.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUP_WEEKS = 11;

function istBoundaries(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // IST wall clock, read via getUTC*
  const midnight = (y, m, d) => new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  const today = midnight(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const month = midnight(ist.getUTCFullYear(), ist.getUTCMonth(), 1);
  const mondayOffset = (ist.getUTCDay() + 6) % 7; // days since Monday
  const thisWeek = new Date(today.getTime() - mondayOffset * DAY_MS);
  const firstWeek = new Date(thisWeek.getTime() - (SIGNUP_WEEKS - 1) * 7 * DAY_MS);
  return { today, month, firstWeek };
}

const istDate = (instant) => new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Every count on the dashboard in ONE statement: each extra query is another
// database round trip, and parallel queries beyond the connection pool run
// in waves. Raw SQL skips the soft-delete filter, so deleted_at is explicit.
function countAll({ today, month }) {
  return prisma.$queryRaw`
    WITH today_recipients AS (
      SELECT r.status, r.opened_at
      FROM push_notification_recipients r
      JOIN push_notifications p ON p.id = r.notification_id
      WHERE p.deleted_at IS NULL AND p.sent_at >= ${today}
    )
    SELECT
      (SELECT count(*) FROM companies WHERE deleted_at IS NULL)::int                                        AS companies_total,
      (SELECT count(*) FROM companies WHERE deleted_at IS NULL AND status = 'ACTIVE')::int                  AS companies_active,
      (SELECT count(*) FROM companies WHERE deleted_at IS NULL AND created_at >= ${month})::int             AS companies_new_this_month,
      (SELECT count(*) FROM employees WHERE deleted_at IS NULL)::int                                        AS employees_total,
      (SELECT count(*) FROM support_tickets WHERE deleted_at IS NULL AND status IN ('open', 'inProgress'))::int AS tickets_open,
      (SELECT count(*) FROM support_tickets WHERE deleted_at IS NULL AND status = 'pending')::int           AS tickets_pending,
      (SELECT count(*) FROM support_tickets WHERE deleted_at IS NULL AND priority = 'urgent'
                                              AND status NOT IN ('resolved', 'closed'))::int                AS tickets_critical,
      (SELECT count(*) FROM notifications WHERE is_read = false)::int                                       AS notifications_unread,
      (SELECT count(*) FROM push_notifications WHERE deleted_at IS NULL AND sent_at >= ${today})::int       AS push_sent,
      (SELECT count(*) FROM today_recipients WHERE status = 'delivered')::int                               AS push_delivered,
      (SELECT count(*) FROM today_recipients WHERE status = 'failed')::int                                  AS push_failed,
      (SELECT count(*) FROM today_recipients WHERE opened_at IS NOT NULL)::int                              AS push_read`;
}

function weeklySignups({ firstWeek }) {
  return prisma.$queryRaw`
    SELECT to_char(date_trunc('week', created_at + interval '330 minutes'), 'YYYY-MM-DD') AS week_start,
           count(*)::int AS count
    FROM companies
    WHERE deleted_at IS NULL AND created_at >= ${firstWeek}
    GROUP BY 1`;
}

function recentTickets() {
  return prisma.support_tickets.findMany({
    orderBy: { created_at: 'desc' },
    take: 3,
    select: { id: true, subject: true, status: true, priority: true, created_at: true, companies: { select: { company_name: true } } },
  });
}

function recentActivity() {
  return prisma.activity_logs.findMany({ orderBy: { created_at: 'desc' }, take: 5 });
}

// Everything the superadmin dashboard shows, already counted: 4 queries in
// one parallel round, health served from its cache (utils/health.js).
async function getSuperadminDashboard(startedAt) {
  const bounds = istBoundaries();
  const [[c], weekly, tickets, activity, health] = await Promise.all([
    countAll(bounds),
    weeklySignups(bounds),
    recentTickets(),
    recentActivity(),
    healthReport(startedAt),
  ]);

  const perWeek = new Map(weekly.map((r) => [r.week_start, r.count]));
  const weekly_signups = Array.from({ length: SIGNUP_WEEKS }, (_, i) => {
    const week_start = istDate(new Date(bounds.firstWeek.getTime() + i * 7 * DAY_MS));
    return { week_start, count: perWeek.get(week_start) ?? 0 };
  });

  return {
    companies: {
      total: c.companies_total,
      active: c.companies_active,
      inactive: c.companies_total - c.companies_active,
      new_this_month: c.companies_new_this_month,
      weekly_signups,
    },
    employees: { total: c.employees_total },
    tickets: {
      open: c.tickets_open,
      pending: c.tickets_pending,
      critical: c.tickets_critical,
      recent: tickets.map(({ companies, ...t }) => ({ ...t, company_name: companies?.company_name ?? null })),
    },
    notifications: {
      unread: c.notifications_unread,
      today: { sent: c.push_sent, delivered: c.push_delivered, failed: c.push_failed, read: c.push_read },
    },
    recent_activity: activity.map((r) => ({ type: r.type, title: r.title, detail: r.detail, ref_id: r.ref_id, at: r.created_at })),
    health: { ...health, api: { status: 'ok', latency_ms: Date.now() - startedAt } },
  };
}

module.exports = { getSuperadminDashboard, istBoundaries };
