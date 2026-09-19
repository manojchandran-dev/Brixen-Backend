const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('./apiResponse');
const { HttpError } = require('./httpError');

// Route helper: sends fn(req)'s result as { success, data } and maps HttpError to its status.
module.exports = (fn, status = 200) =>
  asyncHandler(async (req, res) => {
    try {
      const data = await fn(req);
      return status === 204 ? res.status(204).send() : success(res, data, status);
    } catch (err) {
      if (err instanceof HttpError) return error(res, err.message, err.status);
      throw err;
    }
  });
