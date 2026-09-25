import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// `KEY=` in a .env file arrives as "". Treat that the same as not set.
const emptyToUndefined = (value) => (value === '' ? undefined : value);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

// Every setting the app reads lives here, validated once at boot.
// If something is missing or malformed we exit immediately with a readable
// message, instead of failing later in the middle of a request.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGIN: z.url().default('http://localhost:3000'),

    // SMTP. Leave SMTP_HOST empty in development to use a throwaway Ethereal inbox.
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.preprocess(emptyToUndefined, z.stringbool().optional()), // defaults to true only for port 465
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString, // defaults to SMTP_USER

    // Attachments. Keep the total well under 25 MB: base64 encoding makes
    // attachments ~37% bigger, and most providers (Gmail included) cap at 25 MB.
    MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
    MAX_FILES: z.coerce.number().int().positive().default(5),
    MAX_TOTAL_SIZE_MB: z.coerce.number().positive().default(15),

    // Emails one IP can send per window
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.SMTP_HOST) {
      for (const key of ['SMTP_USER', 'SMTP_PASS']) {
        if (!cfg[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when SMTP_HOST is set` });
        }
      }
    } else if (cfg.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required in production' });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

const cfg = parsed.data;

export const env = Object.freeze({
  ...cfg,
  isProduction: cfg.NODE_ENV === 'production',
  useEthereal: !cfg.SMTP_HOST,
  SMTP_SECURE: cfg.SMTP_SECURE ?? cfg.SMTP_PORT === 465,
  MAIL_FROM: cfg.MAIL_FROM ?? cfg.SMTP_USER,
});
