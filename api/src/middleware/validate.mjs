import { AppError } from '../errors/AppError.mjs';

export const validate = (schema, source) => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed',
      result.error.issues.map((issue) => ({ field: issue.path.join('.') || source, message: issue.message })));
  }
  req.validated = { ...req.validated, [source]: result.data };
  next();
};
