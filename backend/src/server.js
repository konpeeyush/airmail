import { createApp } from './app.js';
import { env } from './config/env.js';
import { verifyConnection } from './services/email.service.js';

const app = createApp();

// Express 5 also calls this on a listen error; server.on('error') below handles that.
const server = app.listen(env.PORT, (err) => {
  if (err) return;
  console.log(`[server] API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Runs in the background: the API is up even if SMTP is not.
  verifyConnection();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${env.PORT} is already in use. Set a different PORT in .env.`);
  } else {
    console.error('[server] Failed to start:', err);
  }
  process.exit(1);
});

function shutdown(signal, exitCode = 0) {
  console.log(`[server] ${signal} received, closing server...`);
  // Stop taking new connections and let in-flight requests finish.
  server.close(() => process.exit(exitCode));
  // If something hangs, don't wait forever.
  setTimeout(() => process.exit(exitCode), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Errors inside requests never reach here: Express sends them to errorHandler.
// These catch bugs outside the request cycle, so they are logged, never silent.

// A stray rejected promise doesn't corrupt process state, so log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

// After an uncaught exception the process state is unknown. Shut down
// cleanly and let the process manager (Docker, PM2, the platform) restart it.
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException', 1);
});
