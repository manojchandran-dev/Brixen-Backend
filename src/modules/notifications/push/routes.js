const { Router } = require('express');
const wrap = require('../../utils/wrap');
const caller = require('../../utils/caller');
const requireSuperadmin = require('../../middleware/requireSuperadmin');
const push = require('../../services/pushNotificationService');

const router = Router();
router.use(requireSuperadmin);

router.get('/', wrap((req) => push.list(req.query)));
router.post('/', wrap((req) => push.create(req.body, caller(req)), 201));
router.get('/:id', wrap((req) => push.get(req.params.id)));
router.put('/:id', wrap((req) => push.update(req.params.id, req.body)));
router.delete('/:id', wrap((req) => push.remove(req.params.id), 204));
router.post('/:id/duplicate', wrap((req) => push.duplicate(req.params.id, caller(req)), 201));
router.post('/:id/cancel', wrap((req) => push.cancel(req.params.id)));

module.exports = router;
