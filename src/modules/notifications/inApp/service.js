const notificationRepository = require('./repository');
const { generateNotificationId } = require('../../../utils/notificationId');

class NotificationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function createNotification({ company_id, type, title, message }) {
  return notificationRepository.create({
    id: generateNotificationId(),
    company_id: company_id ?? null,
    type: type || 'system',
    title,
    message,
  });
}

async function getNotifications({ page = 1, limit = 20, is_read, type, company_id }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(is_read !== undefined ? { is_read } : {}),
    ...(type ? { type } : {}),
    ...(company_id ? { company_id } : {}),
  };

  const [data, total, unread] = await Promise.all([
    notificationRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    notificationRepository.count(where),
    notificationRepository.count({ ...where, is_read: false }),
  ]);

  return {
    items: data,
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
      unread_count: unread,
    },
  };
}

async function markAsRead(id) {
  const existing = await notificationRepository.findById(id);
  if (!existing) {
    throw new NotificationError('Notification not found', 404);
  }
  return notificationRepository.update(id, { is_read: true });
}

async function markAllAsRead() {
  const result = await notificationRepository.updateMany({ is_read: false }, { is_read: true });
  return { updated: result.count };
}

async function deleteNotification(id) {
  return notificationRepository.delete(id);
}

module.exports = {
  NotificationError,
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
