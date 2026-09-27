const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { filterOptionsHandler, categoriesOf } = require('../../utils/listFilters');
const restoreHandler = require('../../utils/restore');
const employeeController = require('./controller');
const {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeStep2,
  validateEmployeeStep3,
} = require('./validator');

const router = Router();

router.post('/', validateCreateEmployee, asyncHandler(employeeController.createEmployee));
router.get('/', asyncHandler(employeeController.getEmployees));
// Distinct values for the app's filter choices (before '/:id').
router.get('/filters', asyncHandler(filterOptionsHandler('employees', ['status', 'department', 'employment_type'])));
router.get('/:id', asyncHandler(employeeController.getEmployeeById));
router.put('/:id', validateUpdateEmployee, asyncHandler(employeeController.updateEmployee));
router.put('/:id/step2', validateEmployeeStep2, asyncHandler(employeeController.updateEmployeeStep2));
router.put('/:id/step3', validateEmployeeStep3, asyncHandler(employeeController.updateEmployeeStep3));
router.delete('/:id', asyncHandler(employeeController.deleteEmployee));
router.post('/:id/restore', asyncHandler(restoreHandler('employees', { label: 'employee', intId: true })));

module.exports = router;
