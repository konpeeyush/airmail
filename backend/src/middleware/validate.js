import { AppError } from '../utils/AppError.js';

/**
 * Validates req.body against a zod schema. On success req.body is replaced
 * with the parsed (trimmed, normalised, de-duplicated) value, so everything
 * after this middleware can trust its input. On failure → 400 with one entry
 * per problem: [{ field, message }].
 */
export function validate(schema) {
  return (req, res, next) => {
    // No body at all (e.g. missing Content-Type) validates as an empty object,
    // which produces the usual "X is required" messages instead of a crash.
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? 'body'),
        message: issue.message,
      }));
      throw new AppError(400, 'Validation failed', errors);
    }

    req.body = result.data;
    next();
  };
}
