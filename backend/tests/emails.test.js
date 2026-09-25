import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { nodemailerMock, resetMailer, sendMail } from './helpers/mockNodemailer.js';

vi.mock('nodemailer', () => ({ default: nodemailerMock }));

const { createApp } = await import('../src/app.js');
const app = createApp();

const valid = { to: 'alice@example.com', subject: 'Hello', body: 'Hi there' };

// Limits from vitest.config.js: 10 KB per file, 2 files, 15 KB total.
const KB = 1024;
const file = (size, fill = 'a') => Buffer.alloc(size, fill);
// Starts like a real PDF, so it passes the content check.
const pdf = (size) => Buffer.concat([Buffer.from('%PDF-1.7\n'), file(size - 9)]);
// A Windows program: "MZ" followed by binary, NUL bytes included.
const program = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);

/** Multipart request with the valid text fields already filled in. */
function multipart(fields = valid) {
  const req = request(app).post('/api/emails');
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  return req;
}

beforeEach(() => {
  resetMailer();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/health and unknown routes', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'ok' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route not found: GET /api/nope' });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/emails')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Request body is not valid JSON');
  });
});

describe('POST /api/emails — success', () => {
  it('sends a plain-text email', async () => {
    const res = await request(app).post('/api/emails').send(valid);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Email sent to 1 recipient(s)',
      data: { messageId: '<test@ethereal.email>', previewUrl: 'https://ethereal.email/message/test' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['alice@example.com'], subject: 'Hello', text: 'Hi there' }),
    );
    expect(sendMail.mock.calls[0][0].html).toBeUndefined();
  });

  it('sends HTML with a generated plain-text part', async () => {
    const res = await request(app)
      .post('/api/emails')
      .send({ ...valid, body: '<h1>Title</h1><p>Hello</p>', isHtml: true });

    expect(res.status).toBe(200);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.html).toBe('<h1>Title</h1><p>Hello</p>');
    expect(sent.text).toBe('TITLE\n\nHello');
  });

  it('normalises recipients: split, trim, lowercase, dedupe within and across fields', async () => {
    await request(app)
      .post('/api/emails')
      .send({
        ...valid,
        to: ['Alice@Example.com; alice@example.com', ' bob@example.com '],
        cc: 'BOB@example.com, carol@example.com',
        bcc: 'carol@example.com, dave@example.com',
      });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['alice@example.com', 'bob@example.com'],
        cc: ['carol@example.com'],
        bcc: ['dave@example.com'],
      }),
    );
  });

  it('accepts multipart with attachments and repeated recipient fields', async () => {
    const res = await multipart({ ...valid, isHtml: 'false' })
      .field('to', 'bob@example.com')
      .attach('attachments', pdf(2 * KB), { filename: 'report.pdf', contentType: 'application/pdf' })
      .attach('attachments', Buffer.from('hello'), { filename: 'résumé.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.data.attachments).toBe(2);

    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toEqual(['alice@example.com', 'bob@example.com']);
    expect(sent.attachments).toEqual([
      { filename: 'report.pdf', content: expect.any(Buffer), contentType: 'application/pdf' },
      { filename: 'résumé.txt', content: Buffer.from('hello'), contentType: 'text/plain' },
    ]);
  });

  it('accepts a JSON body near the character limit, even when multi-byte', async () => {
    const res = await request(app).post('/api/emails').send({ ...valid, body: 'é'.repeat(99_000) });
    expect(res.status).toBe(200);
  });

  it('reports recipients the provider rejected', async () => {
    sendMail.mockResolvedValueOnce({ messageId: '<x>', accepted: ['alice@example.com'], rejected: ['bob@example.com'] });

    const res = await request(app).post('/api/emails').send({ ...valid, to: 'alice@example.com, bob@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Email sent, but 1 recipient(s) were rejected by the provider');
  });
});

describe('POST /api/emails — origin', () => {
  it('403 for a request from another site; nothing is sent', async () => {
    const res = await multipart().set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Requests from this origin are not allowed' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('accepts the frontend origin', async () => {
    const res = await request(app).post('/api/emails').set('Origin', 'http://localhost:3000').send(valid);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

describe('POST /api/emails — validation (400)', () => {
  it.each([
    ['empty body', {}, ['to', 'subject', 'body']],
    ['whitespace subject', { ...valid, subject: '   ' }, ['subject']],
    ['invalid address', { ...valid, to: 'alice@example.com, bob@' }, ['to']],
    ['separators only', { ...valid, to: ' , ; ' }, ['to']],
    ['header injection', { ...valid, subject: 'Hi\r\nBcc: victim@example.com' }, ['subject']],
    ['wrong types', { to: 1, subject: 2, body: true, isHtml: 'maybe' }, ['to', 'subject', 'body', 'isHtml']],
  ])('%s', async (_name, payload, fields) => {
    const res = await request(app).post('/api/emails').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.map((e) => e.field)).toEqual(fields);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('names the invalid address in the message', async () => {
    const res = await request(app).post('/api/emails').send({ ...valid, cc: 'not-an-email' });
    expect(res.body.errors).toEqual([{ field: 'cc', message: '"not-an-email" is not a valid email address' }]);
  });

  it('caps total recipients at 50', async () => {
    const to = Array.from({ length: 51 }, (_, i) => `user${i}@example.com`).join(',');
    const res = await request(app).post('/api/emails').send({ ...valid, to });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('recipients');
  });

  it('validates multipart text fields too', async () => {
    const res = await multipart({ to: 'bad@', subject: '', body: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(['to', 'subject']);
  });
});

describe('POST /api/emails — attachments', () => {
  it('413 when one file is over the size limit', async () => {
    const res = await multipart().attach('attachments', file(11 * KB), {
      filename: 'big.pdf',
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe('"big.pdf" is larger than the 0.01 MB limit');
  });

  it('413 when files together are over the total limit', async () => {
    const res = await multipart()
      .attach('attachments', pdf(8 * KB), { filename: 'a.pdf', contentType: 'application/pdf' })
      .attach('attachments', pdf(8 * KB), { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/add up to more than/);
  });

  it('415 for a disallowed extension', async () => {
    const res = await multipart().attach('attachments', file(10), {
      filename: 'virus.exe',
      contentType: 'application/x-msdownload',
    });
    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/^"virus.exe" is not an allowed file type/);
  });

  it('415 when an allowed extension has the wrong MIME type', async () => {
    const res = await multipart().attach('attachments', file(10), {
      filename: 'sneaky.pdf',
      contentType: 'application/x-msdownload',
    });
    expect(res.status).toBe(415);
  });

  it('415 when the content does not match the extension (renamed program)', async () => {
    const res = await multipart().attach('attachments', program(), {
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    });
    expect(res.status).toBe(415);
    expect(res.body.message).toBe('"invoice.pdf" isn\'t a real .pdf file');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('415 for binary content in a text file', async () => {
    const res = await multipart().attach('attachments', program(), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
  });

  it('400 when too many files are attached', async () => {
    let req = multipart();
    for (const name of ['1.txt', '2.txt', '3.txt']) {
      req = req.attach('attachments', Buffer.from('x'), { filename: name, contentType: 'text/plain' });
    }
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('You can attach at most 2 files');
  });

  it('400 for an empty file', async () => {
    const res = await multipart().attach('attachments', Buffer.alloc(0), {
      filename: 'empty.txt',
      contentType: 'text/plain',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('"empty.txt" is empty');
  });

  it('400 for files sent in the wrong field', async () => {
    const res = await multipart().attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Files must be sent in the "attachments" field');
  });
});

describe('POST /api/emails — provider failure', () => {
  it('502 with a safe message; the provider error is not leaked', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('Invalid login: 535 Authentication failed'), { code: 'EAUTH' }));

    const res = await request(app).post('/api/emails').send(valid);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      success: false,
      message: 'The email provider could not send this message. Please try again later.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/535|EAUTH/);
  });

  it('keeps serving after a provider failure', async () => {
    sendMail.mockRejectedValueOnce(new Error('Connection timeout'));
    await request(app).post('/api/emails').send(valid);

    const res = await request(app).post('/api/emails').send(valid);
    expect(res.status).toBe(200);
  });
});
