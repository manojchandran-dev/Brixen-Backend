const prisma = require('../../../prisma/client');
const { HttpError } = require('../../../core/errors/httpError');
const prefixedId = require('../../../utils/prefixedId');
const { normalizeAudience, resolveCompanyIds } = require('../../../utils/audience');

const STATUSES = ['draft', 'scheduled', 'published', 'cancelled'];
const INPUT_STATUSES = ['draft', 'scheduled', 'published'];
const INPUT_FIELDS = [
  'title', 'short_description', 'content', 'banner_url', 'audience',
  'cta_label', 'cta_target', 'specific_page_route', 'status', 'scheduled_at',
];
const INCLUDE = { _count: { select: { announcement_views: true } } };

const assertOneOf = (field, value, allowed) => {
  if (!allowed.includes(value)) throw new HttpError(`${field} must be one of: ${allowed.join(', ')}`);
};

const optionalString = (field, value) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(`${field} must be a string`);
  return value;
};

function validate(b) {
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 200) throw new HttpError('title is required (max 200 characters)');

  const status = b.status ?? 'draft';
  assertOneOf('status', status, INPUT_STATUSES);

  // content is a Quill Delta JSON string, stored and returned unchanged.
  const content = optionalString('content', b.content) ?? '';
  if (status !== 'draft' && !content.trim()) throw new HttpError('content is required unless the status is draft');

  const cta_target = optionalString('cta_target', b.cta_target);
  let specific_page_route = null;
  if (cta_target === 'specificPage') {
    specific_page_route = optionalString('specific_page_route', b.specific_page_route);
    if (!specific_page_route) throw new HttpError('specific_page_route is required when cta_target is specificPage');
  }

  let scheduled_at = null;
  if (status === 'scheduled') {
    const at = new Date(b.scheduled_at);
    if (!b.scheduled_at || Number.isNaN(at.getTime()) || at <= new Date()) {
      throw new HttpError('scheduled_at must be a future ISO time when status is scheduled');
    }
    scheduled_at = at;
  }

  return {
    title,
    short_description: optionalString('short_description', b.short_description),
    content,
    banner_url: optionalString('banner_url', b.banner_url),
    audience: normalizeAudience(b.audience),
    cta_label: optionalString('cta_label', b.cta_label),
    cta_target,
    specific_page_route,
    status,
    scheduled_at,
  };
}

const present = ({ _count, created_by, ...a }) => ({ ...a, views: _count.announcement_views, created_by });

async function find(id) {
  const row = await prisma.announcements.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw new HttpError('Announcement not found', 404);
  return row;
}

async function get(id) {
  return present(await find(id));
}

async function list({ status, search, page, limit }) {
  if (status) assertOneOf('status', status, STATUSES);
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const pageNo = Math.max(parseInt(page, 10) || 1, 1);

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { short_description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.announcements.findMany({ where, include: INCLUDE, skip: (pageNo - 1) * take, take, orderBy: { created_at: 'desc' } }),
    prisma.announcements.count({ where }),
  ]);

  return { items: rows.map(present), meta: { page: pageNo, limit: take, total, pages: Math.ceil(total / take) } };
}

async function create(body, createdBy) {
  const data = validate(body);
  const row = await prisma.announcements.create({
    data: {
      id: prefixedId('ANN'),
      ...data,
      published_at: data.status === 'published' ? new Date() : null,
      created_by: createdBy,
    },
    include: INCLUDE,
  });
  return present(row);
}

async function update(id, body) {
  const row = await find(id);
  const current = Object.fromEntries(INPUT_FIELDS.map((f) => [f, row[f]]));
  const data = validate({ ...current, ...body });

  const updated = await prisma.announcements.update({
    where: { id },
    data: { ...data, published_at: data.status === 'published' ? (row.published_at ?? new Date()) : row.published_at },
    include: INCLUDE,
  });
  return present(updated);
}

async function remove(id) {
  await find(id);
  await prisma.announcements.delete({ where: { id } });
  return null;
}

async function duplicate(id, createdBy) {
  const row = await find(id);
  const copy = await prisma.announcements.create({
    data: {
      id: prefixedId('ANN'),
      title: `${row.title.slice(0, 193)} (Copy)`,
      short_description: row.short_description,
      content: row.content,
      banner_url: row.banner_url,
      audience: row.audience,
      cta_label: row.cta_label,
      cta_target: row.cta_target,
      specific_page_route: row.specific_page_route,
      status: 'draft',
      created_by: createdBy,
    },
    include: INCLUDE,
  });
  return present(copy);
}

async function unpublish(id) {
  await find(id);
  const { count } = await prisma.announcements.updateMany({
    where: { id, status: { in: ['published', 'scheduled'] } },
    data: { status: 'cancelled' },
  });
  if (!count) throw new HttpError('Only published or scheduled announcements can be unpublished', 409);
  return get(id);
}

// A company opened the announcement. Counts once per company, and only if it is in the audience.
async function recordView(id, company_id) {
  const row = await find(id);
  if (row.status !== 'published') throw new HttpError('Announcement not found', 404);

  const audience = await resolveCompanyIds(normalizeAudience(row.audience));
  if (!audience.includes(company_id)) throw new HttpError('Forbidden', 403);

  await prisma.announcement_views.upsert({
    where: { announcement_id_company_id: { announcement_id: id, company_id } },
    update: {},
    create: { announcement_id: id, company_id },
  });
  return { views: await prisma.announcement_views.count({ where: { announcement_id: id } }) };
}

// Called on a timer: publishes scheduled announcements whose time has come.
async function publishDue() {
  await prisma.announcements.updateMany({
    where: { status: 'scheduled', scheduled_at: { lte: new Date() } },
    data: { status: 'published', published_at: new Date() },
  });
}

module.exports = { list, get, create, update, remove, duplicate, unpublish, recordView, publishDue };
