import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

/**
 * Limits how many emails one IP can send, so the API can't be scripted into
 * a spam cannon (and our SMTP account doesn't get suspended).
 * Runs before the upload parser, so blocked clients never get their files read.
 */
export const emailRateLimiter = rateLimit({
  windowMs,
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

// IP → { count, resetAt }. In memory, like the limiter above.
const recipientCounts = new Map();

// Forget finished windows so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of recipientCounts) {
    if (entry.resetAt <= now) recipientCounts.delete(key);
  }
}, windowMs).unref();

/**
 * The limiter above counts requests, but one request can go to 50 people.
 * This caps how many recipients one IP can reach per window. It runs after
 * validation, because only then are the recipients known (and de-duplicated).
 */
export function recipientRateLimiter(req, res, next) {
  const { to, cc, bcc } = req.body;
  const recipients = to.length + cc.length + bcc.length;
  const key = ipKeyGenerator(req.ip);
  const now = Date.now();

  let entry = recipientCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    recipientCounts.set(key, entry);
  }

  if (entry.count + recipients > env.RATE_LIMIT_MAX_RECIPIENTS) {
    throw new AppError(
      429,
      `Too many recipients. You can email ${env.RATE_LIMIT_MAX_RECIPIENTS} people every ${env.RATE_LIMIT_WINDOW_MINUTES} minutes. Please try again later.`,
    );
  }

  entry.count += recipients;
  next();
}
