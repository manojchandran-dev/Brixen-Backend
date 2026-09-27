const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { filterOptionsHandler, categoriesOf } = require('../../utils/listFilters');
const expenseController = require('./controller');
const { validateCreateExpense, validateUpdateExpense } = require('./validator');

const router = Router();

router.post('/', validateCreateExpense, asyncHandler(expenseController.createExpense));
router.get('/', asyncHandler(expenseController.getExpenses));
// Distinct values for the app's filter choices (before '/:id').
router.get('/filters', asyncHandler(filterOptionsHandler('expenses', ['payment_method'], categoriesOf('expense_categories'))));
router.get('/:id', asyncHandler(expenseController.getExpenseById));
router.put('/:id', validateUpdateExpense, asyncHandler(expenseController.updateExpense));
router.delete('/:id', asyncHandler(expenseController.deleteExpense));

module.exports = router;
