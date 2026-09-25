import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';

/**
 * Builds the Express app without starting it, so tests can import the app
 * and call it directly without opening a port. `server.js` does the listening.
 *
 * Express 5 forwards rejected promises from async handlers to the error
 * handler automatically, so no asyncHandler wrapper is needed.
 */
export function createApp() {
  const app = express();

  // Behind a reverse proxy, req.ip (and so the rate limits) must come from
  // X-Forwarded-For, not the proxy's own address.
  if (env.TRUST_PROXY !== undefined) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // One line per request: method, path, status, time. Compact while developing,
  // Apache "combined" format in production, silent in tests. Health checks are
  // skipped: the keep-alive pinger hits them every few minutes.
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan(env.isProduction ? 'combined' : 'dev', {
        skip: (req) => req.originalUrl === '/api/health',
      }),
    );
  }

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  // A 100,000-character body can be ~300 KB of UTF-8, plus JSON escaping.
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', routes);

  // Order matters: 404 after all routes, error handler last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
