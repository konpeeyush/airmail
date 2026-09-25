import { env } from '../config/env.js';

const MINUTE = 60 * 1000;

/**
 * Pings the API's own public /api/health every KEEP_ALIVE_INTERVAL_MINUTES
 * (14 by default). Render's free tier sleeps a service after 15 minutes
 * without inbound traffic; the ping goes out through the public URL, so
 * Render counts it as a request and never puts the service to sleep.
 *
 * Does nothing when no public URL is known (e.g. local development).
 * Returns a function that stops the pinger.
 */
export function startKeepAlive() {
    if (!env.KEEP_ALIVE_URL) return () => { };

    const url = `${env.KEEP_ALIVE_URL}/api/health`;
    const intervalMs = env.KEEP_ALIVE_INTERVAL_MINUTES * MINUTE;

    const ping = async () => {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) console.warn(`[keep-alive] ${url} responded ${res.status}`);
        } catch (err) {
            console.warn(`[keep-alive] Ping to ${url} failed: ${err.message}`);
        }
    };

    // unref: a pending ping never keeps the process alive during shutdown.
    const timer = setInterval(ping, intervalMs).unref();
    console.log(`[keep-alive] Pinging ${url} every ${env.KEEP_ALIVE_INTERVAL_MINUTES} min`);

    return () => clearInterval(timer);
}