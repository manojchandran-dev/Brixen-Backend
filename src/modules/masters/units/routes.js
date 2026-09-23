const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const unitController = require('../../controllers/unitController');
const { validateCreateUnit, validateUpdateUnit } = require('../../validators/unitValidator');

const router = Router();

router.post('/', validateCreateUnit, asyncHandler(unitController.createUnit));
router.get('/', asyncHandler(unitController.getUnits));
router.get('/:id', asyncHandler(unitController.getUnitById));
router.put('/:id', validateUpdateUnit, asyncHandler(unitController.updateUnit));
router.delete('/:id', asyncHandler(unitController.deleteUnit));

module.exports = router;
