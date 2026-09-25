import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // Set before any app code loads. dotenv never overrides existing variables,
    // so these win over whatever is in a developer's .env.
    env: {
      NODE_ENV: 'test',
      SMTP_HOST: '', // → Ethereal path, which the tests mock
      MAX_FILE_SIZE_MB: '0.01', // 10 KB, so tests don't need big buffers
      MAX_FILES: '2',
      MAX_TOTAL_SIZE_MB: '0.015', // 15 KB
      RATE_LIMIT_MAX: '1000', // rate limiting has its own test file
    },
  },
});
