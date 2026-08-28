const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const productCategoryController = require('../../controllers/productCategoryController');
const {
  validateCreateProductCategory,
  validateUpdateProductCategory,
} = require('../../validators/productCategoryValidator');

const router = Router();

router.post('/', validateCreateProductCategory, asyncHandler(productCategoryController.createProductCategory));
router.get('/', asyncHandler(productCategoryController.getProductCategories));
router.get('/:id', asyncHandler(productCategoryController.getProductCategoryById));
router.put('/:id', validateUpdateProductCategory, asyncHandler(productCategoryController.updateProductCategory));
router.delete('/:id', asyncHandler(productCategoryController.deleteProductCategory));

module.exports = router;
