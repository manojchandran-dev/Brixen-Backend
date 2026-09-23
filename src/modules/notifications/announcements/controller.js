const announcementService = require('./service');
const { success, error } = require('../../../core/responses/apiResponse');
const { HttpError } = require('../../../core/errors/httpError');
const caller = require('../../../utils/caller');
const { parseCompanyId } = require('../../../utils/companyScope');

async function run(res, fn, status = 200) {
  try {
    const data = await fn();
    return status === 204 ? res.status(204).send() : success(res, data, status);
  } catch (err) {
    if (err instanceof HttpError) return error(res, err.message, err.status);
    throw err;
  }
}

async function recordView(req, res) {
  return run(res, () => {
    const company_id = parseCompanyId(req.query.company_id);
    if (!company_id) throw new HttpError('company_id is required and must be a positive integer');
    return announcementService.recordView(req.params.id, company_id);
  });
}

async function list(req, res) {
  return run(res, () => announcementService.list(req.query));
}

async function create(req, res) {
  return run(res, () => announcementService.create(req.body, caller(req)), 201);
}

async function get(req, res) {
  return run(res, () => announcementService.get(req.params.id));
}

async function update(req, res) {
  return run(res, () => announcementService.update(req.params.id, req.body));
}

async function remove(req, res) {
  return run(res, () => announcementService.remove(req.params.id), 204);
}

async function duplicate(req, res) {
  return run(res, () => announcementService.duplicate(req.params.id, caller(req)), 201);
}

async function unpublish(req, res) {
  return run(res, () => announcementService.unpublish(req.params.id));
}

module.exports = { recordView, list, create, get, update, remove, duplicate, unpublish };
