const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const expenseController = require('../../controllers/expenseController');
const { validateCreateExpense, validateUpdateExpense } = require('../../validators/expenseValidator');

const router = Router();

router.post('/', validateCreateExpense, asyncHandler(expenseController.createExpense));
router.get('/', asyncHandler(expenseController.getExpenses));
router.get('/:id', asyncHandler(expenseController.getExpenseById));
router.put('/:id', validateUpdateExpense, asyncHandler(expenseController.updateExpense));
router.delete('/:id', asyncHandler(expenseController.deleteExpense));

module.exports = router;
