import { AppError } from '../errors/AppError.mjs';

const methodsWithBody = new Set(['POST', 'PUT', 'PATCH']);
const isJson = (contentType = '') => /^application\/json\b/i.test(contentType);

// express.json() silently skips bodies that are not labelled as JSON. The request then fails
// validation with a confusing "body: expected object". Say what is actually wrong instead.
export function requireJson(req, _res, next) {
  if (methodsWithBody.has(req.method) && !isJson(req.get('Content-Type'))) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as JSON with the header Content-Type: application/json');
  }
  next();
}
