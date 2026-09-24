const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const restoreHandler = require('../../../utils/restore');
const productCategoryController = require('./controller');
const { validateCreateProductCategory, validateUpdateProductCategory } = require('./validator');

const router = Router();

router.post('/', validateCreateProductCategory, asyncHandler(productCategoryController.createProductCategory));
router.get('/', asyncHandler(productCategoryController.getProductCategories));
router.get('/:id', asyncHandler(productCategoryController.getProductCategoryById));
router.put('/:id', validateUpdateProductCategory, asyncHandler(productCategoryController.updateProductCategory));
router.delete('/:id', asyncHandler(productCategoryController.deleteProductCategory));
router.post('/:id/restore', asyncHandler(restoreHandler('product_categories', { label: 'product category' })));

module.exports = router;
