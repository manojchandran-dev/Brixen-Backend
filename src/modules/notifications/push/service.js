const prisma = require('../../../prisma/client');
const { HttpError } = require('../../../core/errors/httpError');
const prefixedId = require('../../../utils/prefixedId');
const { normalizeAudience, resolveCompanyIds } = require('../../../utils/audience');
const deviceRepository = require('./deviceRepository');
const fcm = require('./fcm');
const { logActivity } = require('../../../utils/activityLog');

const PRIORITIES = ['normal', 'high', 'important', 'urgent'];
const OPEN_ON_TAP = [
  'none', 'dashboard', 'subscription', 'billing', 'attendance', 'payroll',
  'inventory', 'production', 'support', 'announcement', 'specificPage',
];
const STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];
const INPUT_STATUSES = ['draft', 'scheduled', 'sent']; // "sent" means send now
const EDITABLE = ['draft', 'scheduled'];
const INPUT_FIELDS = ['title', 'message', 'audience', 'priority', 'open_on_tap', 'specific_page_route', 'status', 'scheduled_at'];

const assertOneOf = (field, value, allowed) => {
  if (!allowed.includes(value)) throw new HttpError(`${field} must be one of: ${allowed.join(', ')}`);
};

function validate(b) {
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!title || title.length > 60) throw new HttpError('title is required (max 60 characters)');
  if (!message || message.length > 250) throw new HttpError('message is required (max 250 characters)');

  const priority = b.priority ?? 'normal';
  const open_on_tap = b.open_on_tap ?? 'none';
  const status = b.status ?? 'draft';
  assertOneOf('priority', priority, PRIORITIES);
  assertOneOf('open_on_tap', open_on_tap, OPEN_ON_TAP);
  assertOneOf('status', status, INPUT_STATUSES);

  let specific_page_route = null;
  if (open_on_tap === 'specificPage') {
    if (typeof b.specific_page_route !== 'string' || !b.specific_page_route.trim()) {
      throw new HttpError('specific_page_route is required when open_on_tap is specificPage');
    }
    specific_page_route = b.specific_page_route.trim();
  }

  let scheduled_at = null;
  if (status === 'scheduled') {
    const at = new Date(b.scheduled_at);
    if (!b.scheduled_at || Number.isNaN(at.getTime()) || at <= new Date()) {
      throw new HttpError('scheduled_at must be a future ISO time when status is scheduled');
    }
    scheduled_at = at;
  }

  return { title, message, audience: normalizeAudience(b.audience), priority, open_on_tap, specific_page_route, status, scheduled_at };
}

async function deliveryCounts(ids) {
  const [rows, opened] = await Promise.all([
    prisma.push_notification_recipients.groupBy({
      by: ['notification_id', 'status'],
      where: { notification_id: { in: ids } },
      _count: { _all: true },
    }),
    prisma.push_notification_recipients.groupBy({
      by: ['notification_id'],
      where: { notification_id: { in: ids }, opened_at: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const out = {};
  for (const r of rows) (out[r.notification_id] ??= {})[r.status] = r._count._all;
  for (const r of opened) (out[r.notification_id] ??= {}).opened = r._count._all;
  return out;
}

async function present(rows) {
  const counts = await deliveryCounts(rows.map((r) => r.id));
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    audience: n.audience,
    priority: n.priority,
    open_on_tap: n.open_on_tap,
    specific_page_route: n.specific_page_route,
    status: n.status,
    scheduled_at: n.scheduled_at,
    sent_at: n.sent_at,
    recipients: n.recipients,
    delivered: counts[n.id]?.delivered ?? 0,
    failed: counts[n.id]?.failed ?? 0,
    opened: counts[n.id]?.opened ?? 0,
    created_at: n.created_at,
    created_by: n.created_by,
  }));
}

async function find(id) {
  const row = await prisma.push_notifications.findFirst({ where: { id, deleted_at: null } });
  if (!row) throw new HttpError('Notification not found', 404);
  return row;
}

// Detail view: the list's fields plus how it went for each company.
async function get(id) {
  const [notification] = await present([await find(id)]);
  const rows = await prisma.push_notification_recipients.findMany({
    where: { notification_id: id },
    select: {
      company_id: true,
      status: true,
      error: true,
      delivered_at: true,
      opened_at: true,
      companies: { select: { company_name: true } },
    },
    orderBy: { company_id: 'asc' },
  });
  notification.recipient_details = rows.map(({ companies, ...r }) => ({
    ...r,
    company_name: companies?.company_name ?? null,
  }));

  // selectedCompanies stores only ids; expand them for display. A deleted
  // company simply drops out of the list.
  const ids = notification.audience?.company_ids ?? [];
  if (ids.length) {
    notification.audience = {
      ...notification.audience,
      companies: await prisma.companies.findMany({
        where: { id: { in: ids } },
        select: { id: true, company_code: true, company_name: true, owner_name: true, email: true, phone: true, status: true },
        orderBy: { company_name: 'asc' },
      }),
    };
  }
  return notification;
}

// Sends the notification to every registered device of each company and
// updates each recipient row to its final delivered/failed state. A company
// with no registered devices is "failed" immediately -- there's nowhere to send.
async function sendToRecipients(id, companyIds) {
  const notification = await prisma.push_notifications.findUnique({ where: { id } });
  const deviceTokens = await deviceRepository.findManyByCompanyIds(companyIds);

  const tokensByCompany = new Map();
  for (const row of deviceTokens) {
    if (!tokensByCompany.has(row.company_id)) tokensByCompany.set(row.company_id, []);
    tokensByCompany.get(row.company_id).push(row.token);
  }

  // A thrown error here (misconfigured Firebase, provider outage) must not leave the
  // notification stuck in "sending" with no way to retry -- treat it as every token
  // having failed, so recipients settle to "failed" and the notification still closes out.
  const allTokens = deviceTokens.map((row) => row.token);
  let results = [];
  if (allTokens.length) {
    try {
      results = await fcm.sendToTokens(allTokens, {
        title: notification.title,
        body: notification.message,
        priority: notification.priority,
        // What the app needs on tap: where to go, and which push to mark opened.
        data: {
          notification_id: id,
          open_on_tap: notification.open_on_tap,
          specific_page_route: notification.specific_page_route || '',
        },
      });
    } catch (err) {
      results = allTokens.map((token) => ({ token, success: false, error: err.message }));
    }
  }
  const resultByToken = new Map(results.map((r) => [r.token, r]));

  const staleTokens = results.filter((r) => r.error === 'messaging/registration-token-not-registered').map((r) => r.token);
  if (staleTokens.length) {
    await prisma.device_tokens.deleteMany({ where: { token: { in: staleTokens } } });
  }

  await Promise.all(
    companyIds.map((company_id) => {
      const companyResults = (tokensByCompany.get(company_id) || []).map((t) => resultByToken.get(t));
      if (!companyResults.length) {
        return prisma.push_notification_recipients.updateMany({
          where: { notification_id: id, company_id },
          data: { status: 'failed', error: 'No registered devices' },
        });
      }

      const delivered = companyResults.some((r) => r?.success);
      return prisma.push_notification_recipients.updateMany({
        where: { notification_id: id, company_id },
        data: delivered
          ? { status: 'delivered', delivered_at: new Date(), error: null }
          : { status: 'failed', error: companyResults.find((r) => r && !r.success)?.error || 'Delivery failed' },
      });
    })
  );

  await prisma.push_notifications.updateMany({ where: { id, status: 'sending' }, data: { status: 'sent' } });
}

// Moves a draft/scheduled notification to "sending", queues one pending delivery per
// company, then actually sends via FCM and settles each recipient's final status.
// The status guard is what keeps cancelled or deleted notifications from ever going out.
// ponytail: writes without a transaction; a crash mid-way can leave "sending" with
// some recipients still pending -- rerunning dispatch for the same id is safe (createMany
// skips duplicates, and sendToRecipients just overwrites recipient status again).
async function dispatch(id, companyIds) {
  const { count } = await prisma.push_notifications.updateMany({
    where: { id, status: { in: EDITABLE }, deleted_at: null },
    data: { status: 'sending', sent_at: new Date(), recipients: companyIds.length },
  });
  if (!count) return false;

  await prisma.push_notification_recipients.createMany({
    data: companyIds.map((company_id) => ({ notification_id: id, company_id })),
    skipDuplicates: true,
  });

  await sendToRecipients(id, companyIds);

  const { title } = await prisma.push_notifications.findUnique({ where: { id }, select: { title: true } });
  logActivity({ type: 'notification_sent', title: 'Notification sent', detail: `${title} · ${companyIds.length} ${companyIds.length === 1 ? 'company' : 'companies'}`, ref_id: id });
  return true;
}

async function recipientsFor(data) {
  if (data.status === 'draft') return [];
  const ids = await resolveCompanyIds(data.audience);
  if (data.status === 'sent' && !ids.length) throw new HttpError('Audience matches no companies');
  return ids;
}

async function list({ status, search, page, limit }) {
  if (status) assertOneOf('status', status, STATUSES);
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const pageNo = Math.max(parseInt(page, 10) || 1, 1);

  const where = {
    deleted_at: null,
    ...(status ? { status } : {}),
    ...(search
      ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { message: { contains: search, mode: 'insensitive' } }] }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.push_notifications.findMany({ where, skip: (pageNo - 1) * take, take, orderBy: { created_at: 'desc' } }),
    prisma.push_notifications.count({ where }),
  ]);

  return { items: await present(rows), meta: { page: pageNo, limit: take, total, pages: Math.ceil(total / take) } };
}

async function create(body, createdBy) {
  const data = validate(body);
  const ids = await recipientsFor(data);

  const row = await prisma.push_notifications.create({
    data: {
      id: prefixedId('PUSH'),
      ...data,
      status: data.status === 'sent' ? 'draft' : data.status,
      recipients: ids.length,
      created_by: createdBy,
    },
  });
  if (data.status === 'sent') await dispatch(row.id, ids);
  return get(row.id);
}

async function update(id, body) {
  const row = await find(id);
  if (!EDITABLE.includes(row.status)) throw new HttpError('Only draft or scheduled notifications can be edited', 409);

  const current = Object.fromEntries(INPUT_FIELDS.map((f) => [f, row[f]]));
  const data = validate({ ...current, ...body });
  const ids = await recipientsFor(data);

  const { count } = await prisma.push_notifications.updateMany({
    where: { id, status: { in: EDITABLE }, deleted_at: null },
    data: { ...data, status: data.status === 'sent' ? row.status : data.status, recipients: ids.length },
  });
  if (!count) throw new HttpError('Notification is no longer editable', 409);

  if (data.status === 'sent') await dispatch(id, ids);
  return get(id);
}

// Soft delete: the row stays as the audit record of what was sent and by whom.
async function remove(id) {
  await find(id);
  await prisma.push_notifications.updateMany({ where: { id }, data: { deleted_at: new Date() } });
  return null;
}

async function duplicate(id, createdBy) {
  const row = await find(id);
  const copy = await prisma.push_notifications.create({
    data: {
      id: prefixedId('PUSH'),
      title: `${row.title.slice(0, 53)} (Copy)`,
      message: row.message,
      audience: row.audience,
      priority: row.priority,
      open_on_tap: row.open_on_tap,
      specific_page_route: row.specific_page_route,
      status: 'draft',
      created_by: createdBy,
    },
  });
  return get(copy.id);
}

async function cancel(id) {
  await find(id);
  const { count } = await prisma.push_notifications.updateMany({
    where: { id, status: 'scheduled' },
    data: { status: 'cancelled' },
  });
  if (!count) throw new HttpError('Only scheduled notifications can be cancelled', 409);
  return get(id);
}

// Called on a timer: queues scheduled notifications whose time has come.
async function dispatchDue() {
  const due = await prisma.push_notifications.findMany({
    where: { status: 'scheduled', scheduled_at: { lte: new Date() }, deleted_at: null },
    select: { id: true, audience: true },
  });

  for (const n of due) {
    const ids = await resolveCompanyIds(n.audience);
    if (ids.length) {
      await dispatch(n.id, ids);
    } else {
      await prisma.push_notifications.updateMany({ where: { id: n.id, status: 'scheduled' }, data: { status: 'failed', recipients: 0 } });
    }
  }
}

// A company tapped the push. Opened counts once per company (first tap wins);
// repeat taps or a push this company never received are silently ignored.
async function markOpened(id, company_id) {
  await prisma.push_notification_recipients.updateMany({
    where: { notification_id: id, company_id, opened_at: null },
    data: { opened_at: new Date() },
  });
}

const PLATFORMS = ['ios', 'android', 'web'];

async function registerDevice(company_id, token, platform) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new HttpError('token is required and must be a non-empty string');
  }
  assertOneOf('platform', platform, PLATFORMS);

  return deviceRepository.upsert(company_id, token, platform);
}

async function unregisterDevice(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new HttpError('token is required and must be a non-empty string');
  }
  await deviceRepository.removeByToken(token);
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  duplicate,
  cancel,
  dispatchDue,
  markOpened,
  registerDevice,
  unregisterDevice,
};
