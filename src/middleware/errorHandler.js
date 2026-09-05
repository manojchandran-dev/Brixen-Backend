const multer = require('multer');

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err instanceof multer.MulterError ? 400 : err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
  });
}

module.exports = errorHandler;
