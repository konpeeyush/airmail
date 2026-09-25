import { z } from 'zod';

export const LIMITS = Object.freeze({
  MAX_RECIPIENTS: 50, // to + cc + bcc combined, after de-duplication
  MAX_SUBJECT_LENGTH: 255,
  MAX_BODY_LENGTH: 100_000,
});

/**
 * Normalises a recipient field into a clean array of addresses.
 * Accepts a comma/semicolon-separated string ("a@x.com, b@x.com"), an array
 * (FormData sends repeated fields as one), or nothing at all.
 * Each address is trimmed and lowercased, and blanks are dropped.
 */
function splitAddresses(value) {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) => (typeof item === 'string' ? item.split(/[,;]/) : [item]))
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : item))
    .filter((item) => item !== '');
}

const address = z.email({
  error: (issue) =>
    typeof issue.input === 'string'
      ? `"${issue.input}" is not a valid email address`
      : 'Each recipient must be an email address',
});

// split → validate each → de-duplicate
const addressList = z
  .preprocess(splitAddresses, z.array(address))
  .transform((list) => [...new Set(list)]);

/** Required, trimmed text with a friendly message for each way it can be wrong. */
function requiredText(label, maxLength) {
  return z
    .string({
      error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`),
    })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`);
}

export const sendEmailSchema = z
  .object({
    to: addressList.refine((list) => list.length > 0, 'At least one recipient is required'),
    cc: addressList,
    bcc: addressList,

    // Line breaks in a subject can be used to inject extra mail headers.
    subject: requiredText('Subject', LIMITS.MAX_SUBJECT_LENGTH).refine(
      (subject) => !/[\r\n]/.test(subject),
      'Subject cannot contain line breaks',
    ),

    body: requiredText('Body', LIMITS.MAX_BODY_LENGTH),

    // FormData can only send strings, so accept "true"/"false" as well as booleans.
    isHtml: z
      .union([z.boolean(), z.stringbool()], { error: 'isHtml must be true or false' })
      .default(false),
  })
  // An address listed in more than one field is kept only in the most visible one
  // (to > cc > bcc), so nobody receives the same email twice.
  .transform(({ to, cc, bcc, ...rest }) => {
    const seen = new Set(to);
    const keepNew = (address) => !seen.has(address) && seen.add(address);
    return { ...rest, to, cc: cc.filter(keepNew), bcc: bcc.filter(keepNew) };
  })
  .refine(
    ({ to, cc, bcc }) => to.length + cc.length + bcc.length <= LIMITS.MAX_RECIPIENTS,
    { path: ['recipients'], message: `No more than ${LIMITS.MAX_RECIPIENTS} recipients in total (to + cc + bcc)` },
  );
