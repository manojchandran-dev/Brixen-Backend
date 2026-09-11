const notificationService = require('../services/notificationService');
const { success, error } = require('../utils/apiResponse');
const { parseCompanyId } = require('../utils/companyScope');

function isValidId(raw) {
  return /^NOTIF\d{11}$/.test(raw);
}

function requireSuperadmin(req, res) {
  if (req.query.user_type !== 'superadmin') {
    error(res, 'Only superadmin can access notifications', 403);
    return false;
  }
  return true;
}

async function getNotifications(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const type = req.query.type || undefined;
  const company_id = req.query.company_id ? parseCompanyId(req.query.company_id) : undefined;
  let is_read;
  if (req.query.is_read === 'true') is_read = true;
  if (req.query.is_read === 'false') is_read = false;

  const result = await notificationService.getNotifications({ page, limit, is_read, type, company_id });
  return success(res, result);
}

async function markAsRead(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid notification id', 400);
  }

  try {
    const notification = await notificationService.markAsRead(id);
    return success(res, notification);
  } catch (err) {
    if (err instanceof notificationService.NotificationError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function markAllAsRead(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const result = await notificationService.markAllAsRead();
  return success(res, result);
}

async function deleteNotification(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const { id } = req.params;
  if (!isValidId(id)) {
    return error(res, 'Invalid notification id', 400);
  }

  await notificationService.deleteNotification(id);
  return res.status(204).send();
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
