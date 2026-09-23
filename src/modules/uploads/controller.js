const uploadService = require('./service');
const { success, error } = require('../../core/responses/apiResponse');

const isAudio = (file) => file.mimetype.startsWith('audio/') || /\.m4a$/i.test(file.originalname);

async function uploadFile(req, res) {
  if (!req.file) {
    return error(res, 'file is required (multipart/form-data field "file")', 400);
  }

  const result = await uploadService.uploadBuffer(
    req.file.buffer,
    req.body.folder,
    isAudio(req.file) ? 'video' : 'image'
  );

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

module.exports = { uploadFile };
