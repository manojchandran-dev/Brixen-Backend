const supportTicketRepository = require('../repositories/supportTicketRepository');
const companyRepository = require('../repositories/companyRepository');
const notificationService = require('./notificationService');
const { generateTicketId } = require('../utils/ticketId');

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

class SupportTicketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new SupportTicketError('company_id does not reference an existing company');
  }
  return company;
}

async function createTicket(company_id, data) {
  const company = await assertValidCompany(company_id);

  const priority = PRIORITIES.includes(data.priority) ? data.priority : 'Medium';

  const ticket = await supportTicketRepository.create({
    id: generateTicketId(),
    company_id,
    subject: data.subject,
    message: data.message,
    priority,
    status: 'Open',
  });

  try {
    await notificationService.createNotification({
      company_id,
      type: 'support_ticket',
      title: `New support ticket from ${company.company_name}`,
      message: data.subject,
    });
  } catch (err) {
    console.error(`Failed to create notification for ticket ${ticket.id}:`, err.message);
  }

  return ticket;
}

async function getTickets(company_id, { page = 1, limit = 20, status, priority, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    supportTicketRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    supportTicketRepository.count(where),
  ]);

  return {
    items: data,
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
  };
}

async function getTicketById(id, company_id) {
  if (!company_id) {
    return supportTicketRepository.findById(id);
  }
  return supportTicketRepository.findByIdAndCompany(id, company_id);
}

async function updateTicketStatus(id, { status, resolution_notes }) {
  if (status !== undefined && !STATUSES.includes(status)) {
    throw new SupportTicketError(`status must be one of: ${STATUSES.join(', ')}`);
  }

  const payload = {};
  if (status !== undefined) payload.status = status;
  if (resolution_notes !== undefined) payload.resolution_notes = resolution_notes;

  return supportTicketRepository.update(id, payload);
}

async function deleteTicket(id) {
  return supportTicketRepository.delete(id);
}

module.exports = {
  SupportTicketError,
  PRIORITIES,
  STATUSES,
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  deleteTicket,
};
