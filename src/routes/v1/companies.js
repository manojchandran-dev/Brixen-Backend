const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const companyController = require('../../controllers/companyController');
const {
  validateCreateCompany,
  validateUpdateCompany,
  validateStep2,
  validateStep3,
} = require('../../validators/companyValidator');

const router = Router();

router.post('/', validateCreateCompany, asyncHandler(companyController.createCompany));
router.get('/', asyncHandler(companyController.getCompanies));
router.get('/:id', asyncHandler(companyController.getCompanyById));
router.put('/:id', validateUpdateCompany, asyncHandler(companyController.updateCompany));
router.put('/:id/step2', validateStep2, asyncHandler(companyController.updateCompanyStep2));
router.put('/:id/step3', validateStep3, asyncHandler(companyController.updateCompanyStep3));
router.delete('/:id', asyncHandler(companyController.deleteCompany));

module.exports = router;
