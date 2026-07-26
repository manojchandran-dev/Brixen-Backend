const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const companyController = require('../../controllers/companyController');
const { validateCreateCompany, validateUpdateCompany } = require('../../validators/companyValidator');

const router = Router();

router.post('/', validateCreateCompany, asyncHandler(companyController.createCompany));
router.get('/', asyncHandler(companyController.getCompanies));
router.get('/:id', asyncHandler(companyController.getCompanyById));
router.put('/:id', validateUpdateCompany, asyncHandler(companyController.updateCompany));
router.delete('/:id', asyncHandler(companyController.deleteCompany));

module.exports = router;
