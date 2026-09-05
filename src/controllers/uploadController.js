const uploadService = require('../services/uploadService');
const { success, error } = require('../utils/apiResponse');

async function uploadImage(req, res) {
  if (!req.file) {
    return error(res, 'file is required (multipart/form-data field "file")', 400);
  }

  const result = await uploadService.uploadImageBuffer(req.file.buffer, req.body.folder);

  return success(
    res,
    {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    },
    201
  );
}

module.exports = { uploadImage };
