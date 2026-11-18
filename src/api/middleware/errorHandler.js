const { ApiError, NotFoundError } = require('../errors');

/** Fallback for unmatched routes. */
function notFoundHandler(_req, _res, next) {
  next(new NotFoundError());
}

/** Turns thrown errors into consistent JSON: `{ error, details? }`. */
function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  // Malformed JSON body (from express.json())
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
