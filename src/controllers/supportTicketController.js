const supportTicketService = require('../services/supportTicketService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId, resolveListScope } = require('../utils/companyScope');

function isValidId(raw) {
  return /^TICK\d{12}$/.test(raw);
}

async function createTicket(req, res) {
  const company_id = parseCompanyId(req.body.company_id);
  if (!company_id) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  if (!req.body.subject || typeof req.body.subject !== 'string' || !req.body.subject.trim()) {
    return error(res, 'subject is required and must be a non-empty string', 400);
  }
  if (!req.body.message || typeof req.body.message !== 'string' || !req.body.message.trim()) {
    return error(res, 'message is required and must be a non-empty string', 400);
  }

  try {
    const ticket = await supportTicketService.createTicket(company_id, req.body);
    return success(res, ticket, 201);
  } catch (err) {
    if (err instanceof supportTicketService.SupportTicketError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getTickets(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';
  const status = req.query.status || undefined;
  const priority = req.query.priority || undefined;

  const result = await supportTicketService.getTickets(company_id, { page, limit, search, status, priority });
  return success(res, result);
}

async function getTicketById(req, res) {
  const { id } = req.params;
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) {
    return error(res, 'company_id is required and must be a positive integer', 400);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid ticket id', 400);
  }

  const ticket = await supportTicketService.getTicketById(id, company_id);
  if (!ticket) {
    return error(res, 'Ticket not found', 404);
  }

  return success(res, ticket);
}

async function updateTicketStatus(req, res) {
  const { id } = req.params;
  if (req.query.user_type !== 'superadmin') {
    return error(res, 'Only superadmin can update a ticket status', 403);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid ticket id', 400);
  }

  const existing = await supportTicketService.getTicketById(id, null);
  if (!existing) {
    return error(res, 'Ticket not found', 404);
  }

  try {
    const ticket = await supportTicketService.updateTicketStatus(id, req.body);
    return success(res, ticket);
  } catch (err) {
    if (err instanceof supportTicketService.SupportTicketError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteTicket(req, res) {
  const { id } = req.params;
  if (req.query.user_type !== 'superadmin') {
    return error(res, 'Only superadmin can delete a ticket', 403);
  }
  if (!isValidId(id)) {
    return error(res, 'Invalid ticket id', 400);
  }

  const existing = await supportTicketService.getTicketById(id, null);
  if (!existing) {
    return error(res, 'Ticket not found', 404);
  }

  await supportTicketService.deleteTicket(id);
  return res.status(204).send();
}

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  deleteTicket,
};
