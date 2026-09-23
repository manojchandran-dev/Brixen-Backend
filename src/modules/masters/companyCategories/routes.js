const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const companyCategoryController = require('../../controllers/companyCategoryController');
const {
  validateCreateCompanyCategory,
  validateUpdateCompanyCategory,
} = require('../../validators/companyCategoryValidator');

const router = Router();

router.post('/', validateCreateCompanyCategory, asyncHandler(companyCategoryController.createCompanyCategory));
router.get('/', asyncHandler(companyCategoryController.getCompanyCategories));
router.get('/:id', asyncHandler(companyCategoryController.getCompanyCategoryById));
router.put('/:id', validateUpdateCompanyCategory, asyncHandler(companyCategoryController.updateCompanyCategory));
router.delete('/:id', asyncHandler(companyCategoryController.deleteCompanyCategory));

module.exports = router;
