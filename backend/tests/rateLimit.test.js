import request from 'supertest';
import { expect, it, vi } from 'vitest';

import { nodemailerMock, resetMailer } from './helpers/mockNodemailer.js';

vi.mock('nodemailer', () => ({ default: nodemailerMock }));

// Each test file gets a fresh module graph, so this limit only applies here.
process.env.RATE_LIMIT_MAX = '2';
const { createApp } = await import('../src/app.js');
const app = createApp();

const valid = { to: 'alice@example.com', subject: 'Hello', body: 'Hi there' };

it('returns 429 after RATE_LIMIT_MAX emails, in the usual error shape', async () => {
  resetMailer();

  expect((await request(app).post('/api/emails').send(valid)).status).toBe(200);
  expect((await request(app).post('/api/emails').send(valid)).status).toBe(200);

  const res = await request(app).post('/api/emails').send(valid);
  expect(res.status).toBe(429);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/^Too many emails sent/);
  expect(res.headers).toHaveProperty('ratelimit-policy');

  // Other routes are not limited.
  expect((await request(app).get('/api/health')).status).toBe(200);
});
