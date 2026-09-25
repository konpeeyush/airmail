import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Without these, nodemailer waits up to 2 minutes on a dead SMTP server,
// and the HTTP request hangs for that long.
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
};

async function createTransporter() {
  if (env.useEthereal) {
    // Ethereal is a fake SMTP service: it accepts mail but never delivers it,
    // and gives a web preview of each message. Zero-config local development.
    const account = await nodemailer.createTestAccount();
    console.log(`[email] SMTP_HOST not set, using Ethereal test inbox ${account.user}`);
    return nodemailer.createTransport(
      {
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
        ...TIMEOUTS,
      },
      { from: account.user },
    );
  }

  return nodemailer.createTransport(
    {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      ...TIMEOUTS,
    },
    { from: env.MAIL_FROM },
  );
}

// One transporter for the whole process, created on first use and reused.
// If creating it fails (e.g. Ethereal unreachable), forget the failure so the
// next request tries again instead of failing forever.
let transporterPromise;

function getTransporter() {
  transporterPromise ??= createTransporter().catch((err) => {
    transporterPromise = undefined;
    throw err;
  });
  return transporterPromise;
}

/**
 * Checks the SMTP connection and credentials at startup. Only logs: a mail
 * provider outage should not stop the API from booting.
 */
export async function verifyConnection() {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    console.log('[email] SMTP connection verified');
  } catch (err) {
    console.warn(`[email] SMTP verification failed, sending will fail until fixed: ${err.message}`);
  }
}

/**
 * Sends one message. Provider failures become a 502 with a safe message;
 * the real cause is only logged, never sent to the client.
 *
 * @param {import('nodemailer').SendMailOptions} message
 */
export async function sendEmail(message) {
  let info;
  try {
    const transporter = await getTransporter();
    info = await transporter.sendMail(message);
  } catch (err) {
    console.error(`[email] Send failed (${err.code ?? 'unknown'}): ${err.message}`);
    throw new AppError(502, 'The email provider could not send this message. Please try again later.');
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    // Link to view the message on ethereal.email. Only exists for Ethereal.
    previewUrl: env.useEthereal ? nodemailer.getTestMessageUrl(info) || undefined : undefined,
  };
}
