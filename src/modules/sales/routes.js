const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { filterOptionsHandler, categoriesOf } = require('../../utils/listFilters');
const saleController = require('./controller');
const { validateCreateSale, validateUpdateSale, validateSaleStep2 } = require('./validator');

const router = Router();

router.post('/', validateCreateSale, asyncHandler(saleController.createSale));
router.get('/', asyncHandler(saleController.getSales));
// Distinct values for the app's filter choices (before '/:id').
router.get('/filters', asyncHandler(filterOptionsHandler('sales', ['payment_status', 'payment_type', 'invoice_type'])));
router.get('/:id', asyncHandler(saleController.getSaleById));
router.get('/:id/items', asyncHandler(saleController.getSaleItems));
router.put('/:id', validateUpdateSale, asyncHandler(saleController.updateSale));
router.put('/:id/step2', validateSaleStep2, asyncHandler(saleController.updateSaleStep2));
router.delete('/:id', asyncHandler(saleController.deleteSale));

module.exports = router;
