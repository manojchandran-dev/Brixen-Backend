const { Router } = require('express');
const wrap = require('../../utils/wrap');
const caller = require('../../utils/caller');
const { HttpError } = require('../../utils/httpError');
const { parseCompanyId } = require('../../utils/companyScope');
const requireSuperadmin = require('../../middleware/requireSuperadmin');
const announcements = require('../../services/announcementService');

const router = Router();

// The one route companies call (registered before the superadmin gate).
router.post(
  '/:id/view',
  wrap((req) => {
    const company_id = parseCompanyId(req.query.company_id);
    if (!company_id) throw new HttpError('company_id is required and must be a positive integer');
    return announcements.recordView(req.params.id, company_id);
  })
);

router.use(requireSuperadmin);

router.get('/', wrap((req) => announcements.list(req.query)));
router.post('/', wrap((req) => announcements.create(req.body, caller(req)), 201));
router.get('/:id', wrap((req) => announcements.get(req.params.id)));
router.put('/:id', wrap((req) => announcements.update(req.params.id, req.body)));
router.delete('/:id', wrap((req) => announcements.remove(req.params.id), 204));
router.post('/:id/duplicate', wrap((req) => announcements.duplicate(req.params.id, caller(req)), 201));
router.post('/:id/unpublish', wrap((req) => announcements.unpublish(req.params.id)));

module.exports = router;
