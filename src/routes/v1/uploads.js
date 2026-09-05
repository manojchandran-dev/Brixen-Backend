const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const upload = require('../../middleware/upload');
const uploadController = require('../../controllers/uploadController');

const router = Router();

router.post('/', upload.single('file'), asyncHandler(uploadController.uploadImage));

module.exports = router;
