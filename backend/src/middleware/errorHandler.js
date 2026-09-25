import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** Unknown route → 404 in the same JSON shape as every other error. */
export function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Turns known low-level errors (body parser etc.) into AppErrors so the
 * handler below only has two cases: expected (AppError) and unexpected.
 */
function normalize(err) {
  if (err instanceof AppError) return err;

  // Thrown by express.json() when the body isn't valid JSON / is too big.
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'Request body is too large');
  }

  return null;
}

/**
 * The single place where errors become HTTP responses.
 * Response shape: { success: false, message, errors? }
 */
// Express recognises error middleware by its four parameters, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = normalize(err);

  if (known) {
    return res.status(known.statusCode).json({
      success: false,
      message: known.message,
      ...(known.errors && { errors: known.errors }),
    });
  }

  // Unexpected: log everything, tell the client nothing internal.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  res.status(500).json({
    success: false,
    message: env.isProduction ? 'Something went wrong. Please try again later.' : err.message,
  });
}
