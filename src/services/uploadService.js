const cloudinary = require('../config/cloudinary');

const ALLOWED_FOLDERS = ['products', 'companies', 'employees', 'customers', 'sales', 'expenses', 'misc'];

function resolveFolder(raw) {
  const folder = ALLOWED_FOLDERS.includes(raw) ? raw : 'misc';
  return `brixen/${folder}`;
}

function uploadImageBuffer(buffer, rawFolder) {
  const folder = resolveFolder(rawFolder);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadImageBuffer, ALLOWED_FOLDERS };
