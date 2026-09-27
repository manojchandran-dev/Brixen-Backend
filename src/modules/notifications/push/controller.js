const pushNotificationService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');
const { HttpError } = require('../../../core/errors/httpError');
const caller = require('../../../utils/caller');
const { users: userRepository } = require('../../auth/repository');

async function run(res, fn, status = 200) {
  try {
    const data = await fn();
    return status === 204 ? res.status(204).send() : success(res, data, status);
  } catch (err) {
    if (err instanceof HttpError) return error(res, err.message, err.status);
    throw err;
  }
}

async function list(req, res) {
  return run(res, () => pushNotificationService.list(req.query));
}

async function create(req, res) {
  return run(res, () => pushNotificationService.create(req.body, caller(req)), 201);
}

async function get(req, res) {
  return run(res, () => pushNotificationService.get(req.params.id));
}

async function update(req, res) {
  return run(res, () => pushNotificationService.update(req.params.id, req.body));
}

async function remove(req, res) {
  return run(res, () => pushNotificationService.remove(req.params.id), 204);
}

async function duplicate(req, res) {
  return run(res, () => pushNotificationService.duplicate(req.params.id, caller(req)), 201);
}

async function cancel(req, res) {
  return run(res, () => pushNotificationService.cancel(req.params.id));
}

// Any logged-in company account may register/unregister its own device -- not
// superadmin-gated like the rest of this controller.
async function registerDevice(req, res) {
  return run(
    res,
    async () => {
      const user = await userRepository.findById(req.user.sub);
      if (!user || !user.company_id) {
        // Pushes go to companies only. A device now signed in as a non-company
        // account (e.g. switched to superadmin) must stop getting the pushes of
        // whichever company last registered it.
        await pushNotificationService.unregisterDevice(req.body.token);
        return null;
      }
      return pushNotificationService.registerDevice(user.company_id, req.body.token, req.body.platform);
    },
    201
  );
}

async function markOpened(req, res) {
  return run(
    res,
    async () => {
      const user = await userRepository.findById(req.user.sub);
      if (user?.company_id) await pushNotificationService.markOpened(req.params.id, user.company_id);
      return null;
    },
    204
  );
}

// Company inbox (company accounts only; the company comes from the token).
function companyOnly(req, res) {
  if (req.auth?.companyId) return req.auth.companyId;
  error(res, 'Only company accounts have a notification inbox', 403);
  return null;
}

async function inbox(req, res) {
  const company_id = companyOnly(req, res);
  if (!company_id) return;
  const { page, limit } = req.query;
  return run(res, () => pushNotificationService.inbox(company_id, { page, limit, unread_only: req.query.unread === 'true' }));
}

async function markAllRead(req, res) {
  const company_id = companyOnly(req, res);
  if (!company_id) return;
  return run(res, () => pushNotificationService.markAllRead(company_id));
}

async function unregisterDevice(req, res) {
  return run(res, () => pushNotificationService.unregisterDevice(req.body.token), 204);
}

module.exports = { list, create, get, update, remove, duplicate, cancel, markOpened, registerDevice, unregisterDevice, inbox, markAllRead };
