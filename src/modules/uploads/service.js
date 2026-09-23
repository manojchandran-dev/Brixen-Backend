const cloudinary = require('../../config/cloudinary');

const ALLOWED_FOLDERS = ['products', 'companies', 'employees', 'customers', 'sales', 'expenses', 'support', 'misc'];

function resolveFolder(raw) {
  const folder = ALLOWED_FOLDERS.includes(raw) ? raw : 'misc';
  return `brixen/${folder}`;
}

// Cloudinary stores audio under the "video" resource type.
function uploadBuffer(buffer, rawFolder, resourceType) {
  const folder = resolveFolder(rawFolder);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadBuffer, ALLOWED_FOLDERS };
