import { vi } from 'vitest';

/**
 * A fake nodemailer. Tests mock at the provider boundary rather than mocking
 * our own email service, so the service's real logic (transporter reuse,
 * error → 502 mapping, previewUrl) is exercised too.
 */
export const sendMail = vi.fn();

export function resetMailer() {
  sendMail.mockReset();
  sendMail.mockImplementation(async (message) => ({
    messageId: '<test@ethereal.email>',
    accepted: [message.to, message.cc, message.bcc].flat().filter(Boolean),
    rejected: [],
  }));
}

export const nodemailerMock = {
  createTestAccount: vi.fn(async () => ({
    user: 'test@ethereal.email',
    pass: 'secret',
    smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
  })),
  createTransport: vi.fn(() => ({ sendMail, verify: vi.fn(async () => true) })),
  getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
};
