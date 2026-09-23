const chatService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');
const { parseCompanyId } = require('../../../utils/companyScope');

const isSuperadmin = (req) => req.query.user_type === 'superadmin';

async function listConversations(req, res) {
  if (!isSuperadmin(req)) return error(res, 'Only superadmin can list conversations', 403);
  return success(res, await chatService.listConversations());
}

// A company may only touch its own conversation; superadmin may touch any.
function resolveConversationCompany(req, res) {
  const companyId = parseCompanyId(req.params.companyId);
  if (!companyId) {
    error(res, 'companyId must be a positive integer', 400);
    return null;
  }
  if (isSuperadmin(req)) return companyId;

  const caller = parseCompanyId(req.query.company_id);
  if (!caller) {
    error(res, 'company_id is required and must be a positive integer', 400);
    return null;
  }
  if (caller !== companyId) {
    error(res, 'Forbidden', 403);
    return null;
  }
  return companyId;
}

async function getMessages(req, res) {
  const company_id = resolveConversationCompany(req, res);
  if (!company_id) return;

  const before = parseInt(req.query.before, 10) || undefined;
  const limit = parseInt(req.query.limit, 10) || 30;
  return success(res, await chatService.getMessages(company_id, { before, limit }));
}

async function sendMessage(req, res) {
  const company_id = resolveConversationCompany(req, res);
  if (!company_id) return;

  try {
    const message = await chatService.sendMessage(company_id, { ...req.body, isSupport: isSuperadmin(req) });
    return success(res, message, 201);
  } catch (err) {
    if (err instanceof chatService.ChatError) return error(res, err.message, err.status);
    throw err;
  }
}

module.exports = { listConversations, getMessages, sendMessage };
