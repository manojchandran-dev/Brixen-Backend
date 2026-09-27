const multer = require('multer');

function errorHandler(err, req, res, next) {
  const status = err instanceof multer.MulterError ? 400 : err.status || 500;
  // Only real server errors get a stack trace; 4xx are expected (bad input).
  if (status >= 500) console.error(err.stack);
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
}

module.exports = errorHandler;
