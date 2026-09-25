import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Limits how many emails one IP can send, so the API can't be scripted into
 * a spam cannon (and our SMTP account doesn't get suspended).
 * Runs before the upload parser, so blocked clients never get their files read.
 */
export const emailRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8', // tells clients their quota via RateLimit-* headers
  legacyHeaders: false,
  // Hand off to the central error handler so a 429 has the usual JSON shape.
  handler: (req, res, next) => {
    next(
      new AppError(
        429,
        `Too many emails sent. You can send ${env.RATE_LIMIT_MAX} every ${env.RATE_LIMIT_WINDOW_MINUTES} minutes. Please try again later.`,
      ),
    );
  },
});
