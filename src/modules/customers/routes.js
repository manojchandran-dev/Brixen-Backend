const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const restoreHandler = require('../../utils/restore');
const customerController = require('./controller');
const { validateCreateCustomer, validateUpdateCustomer } = require('./validator');

const router = Router();

router.post('/', validateCreateCustomer, asyncHandler(customerController.createCustomer));
router.get('/', asyncHandler(customerController.getCustomers));
router.get('/:id', asyncHandler(customerController.getCustomerById));
router.put('/:id', validateUpdateCustomer, asyncHandler(customerController.updateCustomer));
router.delete('/:id', asyncHandler(customerController.deleteCustomer));
router.post('/:id/restore', asyncHandler(restoreHandler('customers', { label: 'customer' })));

module.exports = router;
