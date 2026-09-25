import { describe, expect, it } from 'vitest';

import { sendEmailSchema } from '../src/validators/email.schema.js';

const base = { to: 'a@x.com', subject: 's', body: 'b' };
const parse = (input) => sendEmailSchema.safeParse({ ...base, ...input });

describe('recipient parsing', () => {
  it.each([
    ['comma-separated string', 'a@x.com, b@x.com', ['a@x.com', 'b@x.com']],
    ['semicolons', 'a@x.com;b@x.com', ['a@x.com', 'b@x.com']],
    ['array', ['a@x.com', 'b@x.com'], ['a@x.com', 'b@x.com']],
    ['array of lists', ['a@x.com, b@x.com', 'c@x.com'], ['a@x.com', 'b@x.com', 'c@x.com']],
    ['whitespace and blanks', '  a@x.com ,, ; b@x.com  ', ['a@x.com', 'b@x.com']],
    ['case-insensitive duplicates', 'A@X.com, a@x.com', ['a@x.com']],
  ])('%s', (_name, to, expected) => {
    expect(parse({ to }).data.to).toEqual(expected);
  });

  it('treats missing cc/bcc as empty lists', () => {
    const { data } = parse({});
    expect(data.cc).toEqual([]);
    expect(data.bcc).toEqual([]);
  });

  it('keeps an address only in its most visible field (to > cc > bcc)', () => {
    const { data } = parse({ to: 'a@x.com', cc: 'a@x.com, b@x.com', bcc: 'b@x.com, c@x.com' });
    expect(data).toMatchObject({ to: ['a@x.com'], cc: ['b@x.com'], bcc: ['c@x.com'] });
  });
});

describe('other fields', () => {
  it('trims subject and body', () => {
    const { data } = parse({ subject: '  Hi  ', body: '\n text \n' });
    expect(data.subject).toBe('Hi');
    expect(data.body).toBe('text');
  });

  it.each([
    [undefined, false],
    [true, true],
    ['true', true],
    ['false', false],
  ])('isHtml %j → %j', (isHtml, expected) => {
    expect(parse({ isHtml }).data.isHtml).toBe(expected);
  });

  it('rejects over-long subject', () => {
    expect(parse({ subject: 'x'.repeat(256) }).success).toBe(false);
  });

  it('strips unknown fields', () => {
    expect(parse({ from: 'spoof@evil.com' }).data).not.toHaveProperty('from');
  });
});
