import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * CORS only stops a browser from reading the response. A form or fetch POST
 * from another site is still delivered, and the email would still go out.
 * So a request from a browser page (which always carries an Origin header on
 * a POST) is refused unless that page is the frontend. Requests without an
 * Origin (curl, server-to-server) don't come from a web page and pass through.
 */
export function requireAllowedOrigin(req, res, next) {
  const origin = req.get('Origin');
  if (origin && origin !== env.CORS_ORIGIN) {
    throw new AppError(403, 'Requests from this origin are not allowed');
  }
  next();
}
