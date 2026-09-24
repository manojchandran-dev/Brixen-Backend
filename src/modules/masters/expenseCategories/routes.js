const { Router } = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const restoreHandler = require('../../../utils/restore');
const expenseCategoryController = require('./controller');
const { validateCreateExpenseCategory, validateUpdateExpenseCategory } = require('./validator');

const router = Router();

router.post('/', validateCreateExpenseCategory, asyncHandler(expenseCategoryController.createExpenseCategory));
router.get('/', asyncHandler(expenseCategoryController.getExpenseCategories));
router.get('/:id', asyncHandler(expenseCategoryController.getExpenseCategoryById));
router.put('/:id', validateUpdateExpenseCategory, asyncHandler(expenseCategoryController.updateExpenseCategory));
router.delete('/:id', asyncHandler(expenseCategoryController.deleteExpenseCategory));
router.post('/:id/restore', asyncHandler(restoreHandler('expense_categories', { label: 'expense category' })));

module.exports = router;
