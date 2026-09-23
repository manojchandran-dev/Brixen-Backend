const multer = require('multer');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/x-m4a',
  'audio/m4a',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function fileFilter(req, file, cb) {
  // .m4a is matched by extension too: clients often send it as octet-stream.
  // Browsers send e.g. "audio/webm;codecs=opus"; compare the bare type only.
  const mimetype = file.mimetype.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimetype) &&!/\.m4a$/i.test(file.originalname)) {
    const err = new Error('Only JPEG, PNG, WEBP, GIF images and WEBM, MP4, MPEG, OGG, M4A audio are allowed');
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

module.exports = upload;
