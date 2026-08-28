const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const moduleController = require('../../controllers/moduleController');

const router = Router();

router.get('/', asyncHandler(moduleController.getModules));

module.exports = router;
