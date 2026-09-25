const supportTicketService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');
const { parseCompanyId, resolveListScope } = require('../../../utils/companyScope');

const isSuperadmin = (req) => req.query.user_type === 'superadmin';

// Runs a service call, mapping SupportTicketError to its HTTP status.
async function run(res, fn, status = 200) {
  try {
    return success(res, await fn(), status);
  } catch (err) {
    if (err instanceof supportTicketService.SupportTicketError) return error(res, err.message, err.status);
    throw err;
  }
}

// Superadmin-only actions on an existing ticket (404 if it doesn't exist).
async function superadminAction(req, res, action) {
  if (!isSuperadmin(req)) return error(res, 'Only superadmin can perform this action', 403);
  const ticket = await supportTicketService.getTicketById(req.params.id);
  if (!ticket) return error(res, 'Ticket not found', 404);
  return run(res, () => action(req.params.id, req.body));
}

async function createTicket(req, res) {
  if (isSuperadmin(req)) return error(res, 'Only companies can raise tickets', 403);

  const company_id = parseCompanyId(req.query.company_id ?? req.body.company_id);
  if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);

  return run(res, () => supportTicketService.createTicket(company_id, req.body), 201);
}

async function getTickets(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { status, priority, category, search } = req.query;

  return run(res, () => supportTicketService.getTickets(company_id, { page, limit, deleted: req.query.deleted === 'true', status, priority, category, search }));
}

async function getTicketById(req, res) {
  const { company_id, ok } = resolveListScope(req.query);
  if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);

  const ticket = await supportTicketService.getTicketById(req.params.id);
  if (!ticket) return error(res, 'Ticket not found', 404);
  if (company_id && ticket.company_id !== company_id) return error(res, 'Forbidden', 403);

  return success(res, ticket);
}

const updateStatus = (req, res) => superadminAction(req, res, (id, b) => supportTicketService.updateStatus(id, b.status));
const assign = (req, res) =>
  superadminAction(req, res, (id, b) => supportTicketService.assign(id, b.assigned_to ?? null));
const addNote = (req, res) => superadminAction(req, res, (id, b) => supportTicketService.addNote(id, b.text));
const deleteTicket = (req, res) => superadminAction(req, res, (id) => supportTicketService.deleteTicket(id));

module.exports = { createTicket, getTickets, getTicketById, updateStatus, assign, addNote, deleteTicket };
