import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

import { nodemailerMock, resetMailer, sendMail } from './helpers/mockNodemailer.js';

vi.mock('nodemailer', () => ({ default: nodemailerMock }));

// Each test file gets a fresh module graph, so these limits only apply here.
// TRUST_PROXY lets each test be its own client via X-Forwarded-For.
process.env.RATE_LIMIT_MAX = '2';
process.env.RATE_LIMIT_MAX_RECIPIENTS = '3';
process.env.TRUST_PROXY = '1';
const { createApp } = await import('../src/app.js');
const app = createApp();

const valid = { to: 'alice@example.com', subject: 'Hello', body: 'Hi there' };

/** A POST that reaches the API through a proxy, from client `ip`. */
const from = (ip) => request(app).post('/api/emails').set('X-Forwarded-For', ip);

beforeEach(() => resetMailer());

it('returns 429 after RATE_LIMIT_MAX emails, in the usual error shape', async () => {
  expect((await from('203.0.113.1').send(valid)).status).toBe(200);
  expect((await from('203.0.113.1').send(valid)).status).toBe(200);

  const res = await from('203.0.113.1').send(valid);
  expect(res.status).toBe(429);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/^Too many emails sent/);
  expect(res.headers).toHaveProperty('ratelimit-policy');

  // Behind the proxy, other clients keep their own limit.
  expect((await from('203.0.113.2').send(valid)).status).toBe(200);
  // Other routes are not limited.
  expect((await request(app).get('/api/health')).status).toBe(200);
});

it('returns 429 once an IP has emailed RATE_LIMIT_MAX_RECIPIENTS people', async () => {
  expect((await from('203.0.113.3').send({ ...valid, to: 'a@example.com, b@example.com' })).status).toBe(200);

  const res = await from('203.0.113.3').send({ ...valid, to: 'c@example.com, d@example.com' });
  expect(res.status).toBe(429);
  expect(res.body.message).toMatch(/^Too many recipients/);
  expect(sendMail).toHaveBeenCalledTimes(1);
});
