const { Prisma } = require('@prisma/client');
const prisma = require('../../../prisma/client');
const { buildBars, fillBars } = require('./range');

// Raw SQL throughout: it skips the soft-delete extension, so every query
// states `deleted_at IS NULL` itself. Column/table names passed to these
// helpers are constants from this file, never user input.
const col = (name) => Prisma.raw(name);

// A stored UTC timestamp as a calendar day in the caller's time zone.
const localDate = (column, r) => Prisma.sql`(${col(column)} AT TIME ZONE 'UTC' AT TIME ZONE ${r.tz})::date`;

// Is `column` inside the selected range? range=all has no limit.
const inRange = (column, r) =>
  r.start ? Prisma.sql`${localDate(column, r)} BETWEEN ${r.start}::date AND ${r.end}::date` : Prisma.sql`TRUE`;

// Chart bars for `column` of `from` (a table or subquery), filtered by `where`.
async function trend(r, from, column, where = Prisma.sql`TRUE`) {
  let firstDay;
  if (r.range === 'all') {
    const [row] = await prisma.$queryRaw`
      SELECT to_char(min(${localDate(column, r)}), 'YYYY-MM-DD') AS first
      FROM ${from} WHERE ${col(column)} IS NOT NULL AND ${where}`;
    firstDay = row.first ?? undefined;
  }
  const bars = buildBars(r, firstDay);
  const rows = await prisma.$queryRaw`
    SELECT to_char(${localDate(column, r)}, 'YYYY-MM-DD') AS day, count(*)::int AS n
    FROM ${from}
    WHERE ${col(column)} IS NOT NULL AND ${where}
      AND ${localDate(column, r)} BETWEEN ${bars[0].start}::date AND ${bars.at(-1).end}::date
    GROUP BY 1`;
  return fillBars(bars, new Map(rows.map((row) => [row.day, row.n])));
}

const live = Prisma.sql`deleted_at IS NULL`;

// 1. Company
async function company(r) {
  const [[c], recent, bars] = await Promise.all([
    prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
             count(*) FILTER (WHERE onboarding_status IS DISTINCT FROM 'completed')::int AS setup_pending,
             count(*) FILTER (WHERE ${inRange('created_at', r)})::int AS new
      FROM companies WHERE deleted_at IS NULL`,
    prisma.$queryRaw`
      SELECT id, company_name AS name, owner_name, (status = 'ACTIVE') AS is_active, created_at
      FROM companies WHERE deleted_at IS NULL AND ${inRange('created_at', r)}
      ORDER BY created_at DESC LIMIT 8`,
    trend(r, col('companies'), 'created_at', live),
  ]);
  const inactive = c.total - c.active;
  return {
    summary: { total: c.total, new: c.new, active: c.active, inactive },
    trend: bars,
    status: { active: c.active, inactive, setup_pending: c.setup_pending },
    recent,
  };
}

// 2. Users (employees across all companies)
async function users(r) {
  const [[e], byCompany, [logins], bars] = await Promise.all([
    prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE ${inRange('created_at', r)})::int AS new,
             count(*) FILTER (WHERE lower(status) = 'active')::int AS active,
             count(*) FILTER (WHERE lower(status) IN ('inactive', 'on leave'))::int AS inactive
      FROM employees WHERE deleted_at IS NULL`,
    prisma.$queryRaw`
      SELECT e.company_id, c.company_name, count(*)::int AS count
      FROM employees e JOIN companies c ON c.id = e.company_id
      WHERE e.deleted_at IS NULL AND c.deleted_at IS NULL
      GROUP BY 1, 2 ORDER BY 3 DESC, 2 LIMIT 6`,
    // Logins are recorded in activity_logs (admin_login) since the dashboard release.
    prisma.$queryRaw`
      SELECT count(DISTINCT actor_user_id)::int AS n
      FROM activity_logs WHERE type = 'admin_login' AND ${inRange('created_at', r)}`,
    trend(r, col('employees'), 'created_at', live),
  ]);
  return { summary: e, trend: bars, by_company: byCompany, active_users: logins.n };
}

// 3. Notifications -- everything over pushes sent in the range.
async function notifications(r) {
  const sent = Prisma.sql`
    SELECT id, title, recipients, sent_at FROM push_notifications
    WHERE deleted_at IS NULL AND sent_at IS NOT NULL AND ${inRange('sent_at', r)}`;
  const [[n], recent, bars] = await Promise.all([
    prisma.$queryRaw`
      WITH sent AS (${sent})
      SELECT (SELECT count(*) FROM sent)::int AS sent,
             count(r.id) FILTER (WHERE r.status = 'delivered')::int AS delivered,
             count(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
             count(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS read,
             count(r.id) FILTER (WHERE r.status = 'delivered' AND r.opened_at IS NOT NULL)::int AS delivered_read
      FROM push_notification_recipients r JOIN sent ON sent.id = r.notification_id`,
    prisma.$queryRaw`
      WITH sent AS (${sent})
      SELECT s.id, s.title, s.recipients,
             count(r.id) FILTER (WHERE r.status = 'delivered')::int AS delivered,
             count(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS opened,
             count(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
             s.sent_at
      FROM sent s LEFT JOIN push_notification_recipients r ON r.notification_id = s.id
      GROUP BY s.id, s.title, s.recipients, s.sent_at
      ORDER BY s.sent_at DESC LIMIT 6`,
    trend(r, col('push_notifications'), 'sent_at', live),
  ]);
  return {
    summary: { sent: n.sent, delivered: n.delivered, failed: n.failed, read: n.read },
    trend: bars,
    read_vs_unread: { read: n.delivered_read, unread: n.delivered - n.delivered_read },
    recent,
  };
}

// 4. Support -- tickets raised in the range; the chart is resolutions.
async function support(r) {
  const [[t], bars] = await Promise.all([
    prisma.$queryRaw`
      SELECT count(*)::int AS raised,
             count(*) FILTER (WHERE status IN ('open', 'inProgress'))::int AS open,
             count(*) FILTER (WHERE status = 'pending')::int AS pending,
             count(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS resolved,
             count(*) FILTER (WHERE priority = 'urgent')::int AS p_critical,
             count(*) FILTER (WHERE priority = 'high')::int AS p_high,
             count(*) FILTER (WHERE priority = 'medium')::int AS p_medium,
             count(*) FILTER (WHERE priority = 'low')::int AS p_low,
             count(*) FILTER (WHERE status = 'open')::int AS s_open,
             count(*) FILTER (WHERE status = 'inProgress')::int AS s_in_progress,
             count(*) FILTER (WHERE status = 'resolved')::int AS s_resolved,
             count(*) FILTER (WHERE status = 'closed')::int AS s_closed
      FROM support_tickets WHERE deleted_at IS NULL AND ${inRange('created_at', r)}`,
    trend(r, col('support_tickets'), 'resolved_at', live),
  ]);
  return {
    summary: { raised: t.raised, open: t.open, pending: t.pending, resolved: t.resolved },
    trend: bars,
    by_priority: { critical: t.p_critical, high: t.p_high, medium: t.p_medium, low: t.p_low },
    by_status: { open: t.s_open, in_progress: t.s_in_progress, pending: t.pending, resolved: t.s_resolved, closed: t.s_closed },
  };
}

// 5. Chatbot (live support chat). Each conversation's state is its last message.
// ai_handled / escalated are omitted: there is no bot, every reply is a person.
const lastMessages = Prisma.sql`
  (SELECT DISTINCT ON (m.conversation_id)
          m.conversation_id, c.company_id, m.is_support, m.type, m.text, m.sent_at
   FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
   WHERE c.deleted_at IS NULL
   ORDER BY m.conversation_id, m.id DESC) AS last_msg`;

async function chatbot(r) {
  const [[s], awaiting, bars] = await Promise.all([
    prisma.$queryRaw`
      SELECT (SELECT count(*) FROM chat_conversations WHERE deleted_at IS NULL)::int AS total,
             count(*) FILTER (WHERE ${inRange('sent_at', r)})::int AS active,
             count(*) FILTER (WHERE ${inRange('sent_at', r)} AND is_support)::int AS replied,
             count(*) FILTER (WHERE ${inRange('sent_at', r)} AND NOT is_support)::int AS awaiting
      FROM ${lastMessages}`,
    prisma.$queryRaw`
      SELECT last_msg.conversation_id, co.company_name,
             coalesce(nullif(left(last_msg.text, 80), ''),
                      CASE last_msg.type WHEN 'image' THEN 'Photo' WHEN 'voice' THEN 'Voice message' ELSE '' END) AS preview,
             last_msg.sent_at
      FROM ${lastMessages} JOIN companies co ON co.id = last_msg.company_id
      WHERE NOT last_msg.is_support AND ${inRange('sent_at', r)}
      ORDER BY last_msg.sent_at DESC LIMIT 6`,
    trend(r, lastMessages, 'sent_at'),
  ]);
  return { summary: s, trend: bars, awaiting_list: awaiting };
}

// 6. Activity -- from activity_logs. Stored types keep the dashboard's names;
// this tab reports two of them under the names its spec uses.
const REPORT_TYPE = { employee_created: 'employee_added', ticket_created: 'ticket_raised' };

async function activity(r) {
  const [[a], recent, bars] = await Promise.all([
    prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE type = 'company_created')::int AS companies_created,
             count(*) FILTER (WHERE type = 'employee_created')::int AS employees_added,
             count(*) FILTER (WHERE type = 'ticket_created')::int AS tickets_raised
      FROM activity_logs WHERE ${inRange('created_at', r)}`,
    prisma.$queryRaw`
      SELECT a.type, a.title, a.detail, u.email AS actor, a.created_at AS at
      FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE ${inRange('a.created_at', r)}
      ORDER BY a.created_at DESC, a.id DESC LIMIT 10`,
    trend(r, col('activity_logs'), 'created_at'),
  ]);
  return {
    summary: a,
    trend: bars,
    recent: recent.map((e) => ({ ...e, type: REPORT_TYPE[e.type] ?? e.type })),
  };
}

const TABS = { company, users, notifications, support, chatbot, activity };

module.exports = { TABS };
