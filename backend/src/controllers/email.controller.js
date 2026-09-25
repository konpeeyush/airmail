import { sendEmail } from '../services/email.service.js';

/**
 * POST /api/emails
 * req.body has already been validated and normalised by the validate middleware.
 * The controller only translates HTTP into a mail payload and back.
 * Sending (and SMTP error handling) lives in the service.
 */
export async function sendEmailHandler(req, res) {
  const { to, cc, bcc, subject, body, isHtml } = req.body;

  const result = await sendEmail({
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  });

  // The provider can accept the message but refuse some addresses.
  const partial = result.rejected.length > 0;

  res.status(200).json({
    success: true,
    message: partial
      ? `Email sent, but ${result.rejected.length} recipient(s) were rejected by the provider`
      : `Email sent to ${result.accepted.length} recipient(s)`,
    data: result,
  });
}
