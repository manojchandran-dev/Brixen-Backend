const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const employeeController = require('../../controllers/employeeController');
const {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeStep2,
  validateEmployeeStep3,
} = require('../../validators/employeeValidator');

const router = Router();

router.post('/', validateCreateEmployee, asyncHandler(employeeController.createEmployee));
router.get('/', asyncHandler(employeeController.getEmployees));
router.get('/:id', asyncHandler(employeeController.getEmployeeById));
router.put('/:id', validateUpdateEmployee, asyncHandler(employeeController.updateEmployee));
router.put('/:id/step2', validateEmployeeStep2, asyncHandler(employeeController.updateEmployeeStep2));
router.put('/:id/step3', validateEmployeeStep3, asyncHandler(employeeController.updateEmployeeStep3));
router.delete('/:id', asyncHandler(employeeController.deleteEmployee));

module.exports = router;
