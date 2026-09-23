const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const companyCategoryController = require('./controller');
const { validateCreateCompanyCategory, validateUpdateCompanyCategory } = require('./validator');

const router = Router();

router.post('/', validateCreateCompanyCategory, asyncHandler(companyCategoryController.createCompanyCategory));
router.get('/', asyncHandler(companyCategoryController.getCompanyCategories));
router.get('/:id', asyncHandler(companyCategoryController.getCompanyCategoryById));
router.put('/:id', validateUpdateCompanyCategory, asyncHandler(companyCategoryController.updateCompanyCategory));
router.delete('/:id', asyncHandler(companyCategoryController.deleteCompanyCategory));

module.exports = router;
