const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const employeeController = require('../../controllers/employeeController');
const { validateCreateEmployee, validateUpdateEmployee } = require('../../validators/employeeValidator');

const router = Router();

router.post('/', validateCreateEmployee, asyncHandler(employeeController.createEmployee));
router.get('/', asyncHandler(employeeController.getEmployees));
router.get('/:id', asyncHandler(employeeController.getEmployeeById));
router.put('/:id', validateUpdateEmployee, asyncHandler(employeeController.updateEmployee));
router.delete('/:id', asyncHandler(employeeController.deleteEmployee));

module.exports = router;
