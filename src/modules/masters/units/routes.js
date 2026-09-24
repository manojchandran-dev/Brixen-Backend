const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const restoreHandler = require('../../../utils/restore');
const unitController = require('./controller');
const { validateCreateUnit, validateUpdateUnit } = require('./validator');

const router = Router();

router.post('/', validateCreateUnit, asyncHandler(unitController.createUnit));
router.get('/', asyncHandler(unitController.getUnits));
router.get('/:id', asyncHandler(unitController.getUnitById));
router.put('/:id', validateUpdateUnit, asyncHandler(unitController.updateUnit));
router.delete('/:id', asyncHandler(unitController.deleteUnit));
router.post('/:id/restore', asyncHandler(restoreHandler('units', { label: 'unit' })));

module.exports = router;
