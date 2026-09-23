const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const productController = require('../../controllers/productController');
const {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductStep2,
  validateProductStep3,
  validateProductStep4,
} = require('../../validators/productValidator');

const router = Router();

router.post('/', validateCreateProduct, asyncHandler(productController.createProduct));
router.get('/', asyncHandler(productController.getProducts));
router.get('/:id', asyncHandler(productController.getProductById));
router.put('/:id', validateUpdateProduct, asyncHandler(productController.updateProduct));
router.put('/:id/step2', validateProductStep2, asyncHandler(productController.updateProductStep2));
router.put('/:id/step3', validateProductStep3, asyncHandler(productController.updateProductStep3));
router.put('/:id/step4', validateProductStep4, asyncHandler(productController.updateProductStep4));
router.delete('/:id', asyncHandler(productController.deleteProduct));

module.exports = router;
