const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const saleController = require('../../controllers/saleController');
const { validateCreateSale, validateUpdateSale, validateSaleStep2 } = require('../../validators/saleValidator');

const router = Router();

router.post('/', validateCreateSale, asyncHandler(saleController.createSale));
router.get('/', asyncHandler(saleController.getSales));
router.get('/:id', asyncHandler(saleController.getSaleById));
router.put('/:id', validateUpdateSale, asyncHandler(saleController.updateSale));
router.put('/:id/step2', validateSaleStep2, asyncHandler(saleController.updateSaleStep2));
router.delete('/:id', asyncHandler(saleController.deleteSale));

module.exports = router;
