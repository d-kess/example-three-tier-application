const { ValidationError } = require('../errors');

const LOCATIONS = ['params', 'query', 'body'];

/**
 * Express middleware factory. `schemas` may contain `params`, `query` and
 * `body` object schemas (see schema.js). All locations are checked and every
 * problem is reported at once; on success the sanitized values are placed on
 * `req.validated.{params,query,body}` for the controller to use.
 */
function validate(schemas) {
  return function validationMiddleware(req, _res, next) {
    const validated = { params: {}, query: {}, body: {} };
    const details = [];

    for (const location of LOCATIONS) {
      const schema = schemas[location];
      if (!schema) continue;
      const { value, errors } = schema(req[location]);
      validated[location] = value;
      for (const { field, message } of errors) {
        details.push({ location, field, message });
      }
    }

    if (details.length > 0) return next(new ValidationError(details));
    req.validated = validated;
    next();
  };
}

module.exports = validate;
