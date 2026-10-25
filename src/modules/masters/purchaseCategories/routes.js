const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const restoreHandler = require('../../../utils/restore');
const purchaseCategoryController = require('./controller');
const { validateCreatePurchaseCategory, validateUpdatePurchaseCategory } = require('./validator');

const router = Router();

router.post('/', validateCreatePurchaseCategory, asyncHandler(purchaseCategoryController.createPurchaseCategory));
router.get('/', asyncHandler(purchaseCategoryController.getPurchaseCategories));
router.get('/:id', asyncHandler(purchaseCategoryController.getPurchaseCategoryById));
router.put('/:id', validateUpdatePurchaseCategory, asyncHandler(purchaseCategoryController.updatePurchaseCategory));
router.delete('/:id', asyncHandler(purchaseCategoryController.deletePurchaseCategory));
router.post('/:id/restore', asyncHandler(restoreHandler('purchase_categories', { label: 'purchase category' })));

module.exports = router;
