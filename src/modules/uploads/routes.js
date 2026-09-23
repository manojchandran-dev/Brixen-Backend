const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const upload = require('../../middleware/upload.middleware');
const uploadController = require('./controller');

const router = Router();

router.post('/', upload.single('file'), asyncHandler(uploadController.uploadFile));

module.exports = router;
