const supportTicketRepository = require('./repository');
const { logActivity } = require('../../../utils/activityLog');
const companyRepository = require('../../companies/repository');
const notificationService = require('../../notifications/inApp/service');
const { generateTicketId, generateTicketMessageId } = require('../../../utils/ticketId');

const CATEGORIES = ['technical', 'billing', 'featureRequest', 'bug', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'pending', 'inProgress', 'resolved', 'closed'];

class SupportTicketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertOneOf(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new SupportTicketError(`${field} must be one of: ${allowed.join(', ')}`);
  }
}

function assertText(field, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SupportTicketError(`${field} is required and must be a non-empty string`);
  }
}

function toTicket({ companies, messages, ...ticket }) {
  return {
    ...ticket,
    company_name: companies?.company_name ?? null,
    messages: messages.map(({ id, sender_name, is_support_reply, text, sent_at }) => ({
      id,
      sender_name,
      is_support_reply,
      text,
      sent_at,
    })),
  };
}

async function createTicket(company_id, data) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new SupportTicketError('company_id does not reference an existing company');
  }

  assertText('subject', data.subject);
  assertText('description', data.description);
  const category = data.category ?? 'other';
  const priority = data.priority ?? 'medium';
  assertOneOf('category', category, CATEGORIES);
  assertOneOf('priority', priority, PRIORITIES);

  const raised_by = company.owner_name || company.company_name;

  const ticket = await supportTicketRepository.create({
    id: generateTicketId(),
    company_id,
    subject: data.subject.trim(),
    description: data.description,
    category,
    priority,
    status: 'open',
    raised_by,
    messages: {
      create: [
        { id: generateTicketMessageId(), company_id, sender_name: raised_by, is_support_reply: false, text: data.description },
      ],
    },
  });

  try {
    await notificationService.createNotification({
      company_id,
      type: 'support_ticket',
      title: `New support ticket from ${company.company_name}`,
      message: ticket.subject,
    });
  } catch (err) {
    console.error(`Failed to create notification for ticket ${ticket.id}:`, err.message);
  }

  logActivity({ type: 'ticket_created', title: 'Ticket raised', detail: `${ticket.subject} · ${company.company_name}`, ref_id: ticket.id, company_id });
  return toTicket(ticket);
}

// Counts per value of a column, e.g. { open: 2, resolved: 1 }, for the filter chips.
async function countBy(field, where) {
  const rows = await supportTicketRepository.groupBy({ by: [field], where, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r[field], r._count._all]));
}

// `status`, `priority` and `category` filter exactly; `search` matches the
// subject, description, company name and who raised it. `filters` gives the
// chip counts for the current search, before the chip filters.
async function getTickets(company_id, { page = 1, deleted = false, limit = 20, status, priority, category, search = '' }) {
  if (status !== undefined) assertOneOf('status', status, STATUSES);
  if (priority !== undefined) assertOneOf('priority', priority, PRIORITIES);
  if (category !== undefined) assertOneOf('category', category, CATEGORIES);

  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const base = {
    ...(company_id ? { company_id } : {}),
    // deleted=true lists the soft-deleted rows instead (to restore them).
    ...(deleted ? { deleted_at: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { raised_by: { contains: search, mode: 'insensitive' } },
            { companies: { company_name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const where = {
    ...base,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(category ? { category } : {}),
  };

  const [data, total, statusCounts, priorityCounts, categoryCounts] = await Promise.all([
    supportTicketRepository.findMany({ where, skip, take, orderBy: { updated_at: 'desc' } }),
    supportTicketRepository.count(where),
    countBy('status', base),
    countBy('priority', base),
    countBy('category', base),
  ]);

  return {
    items: data.map(toTicket),
    meta: { page, limit: take, total, pages: Math.ceil(total / take) },
    filters: { status: statusCounts, priority: priorityCounts, category: categoryCounts },
  };
}

async function getTicketById(id) {
  const ticket = await supportTicketRepository.findById(id);
  return ticket ? toTicket(ticket) : null;
}

async function updateStatus(id, status) {
  assertOneOf('status', status, STATUSES);
  return toTicket(await supportTicketRepository.update(id, { status }));
}

async function assign(id, assigned_to) {
  if (assigned_to !== null) assertText('assigned_to', assigned_to);
  return toTicket(await supportTicketRepository.update(id, { assigned_to }));
}

async function addNote(id, text) {
  assertText('text', text);
  const { company_id } = await supportTicketRepository.findById(id);
  return toTicket(
    await supportTicketRepository.update(id, {
      messages: {
        create: { id: generateTicketMessageId(), company_id, sender_name: 'Support', is_support_reply: true, text },
      },
    })
  );
}

async function deleteTicket(id) {
  await supportTicketRepository.remove(id);
  return null;
}

module.exports = { SupportTicketError, createTicket, getTickets, getTicketById, updateStatus, assign, addNote, deleteTicket };
