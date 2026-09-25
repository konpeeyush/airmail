import { sendEmail } from '../services/email.service.js';

/**
 * POST /api/emails
 * The controller only translates HTTP into a mail payload and back.
 * Sending (and SMTP error handling) lives in the service.
 */
export async function sendEmailHandler(req, res) {
  // Temporary until Phase 3 adds validation: express.json() leaves req.body
  // undefined when the request has no JSON body.
  const { to, cc, bcc, subject, body } = req.body ?? {};

  const result = await sendEmail({ to, cc, bcc, subject, text: body });

  res.status(200).json({
    success: true,
    message: 'Email sent successfully',
    data: result,
  });
}
