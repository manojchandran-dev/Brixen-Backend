const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const expenseCategoryController = require('../../controllers/expenseCategoryController');
const {
  validateCreateExpenseCategory,
  validateUpdateExpenseCategory,
} = require('../../validators/expenseCategoryValidator');

const router = Router();

router.post('/', validateCreateExpenseCategory, asyncHandler(expenseCategoryController.createExpenseCategory));
router.get('/', asyncHandler(expenseCategoryController.getExpenseCategories));
router.get('/:id', asyncHandler(expenseCategoryController.getExpenseCategoryById));
router.put('/:id', validateUpdateExpenseCategory, asyncHandler(expenseCategoryController.updateExpenseCategory));
router.delete('/:id', asyncHandler(expenseCategoryController.deleteExpenseCategory));

module.exports = router;
