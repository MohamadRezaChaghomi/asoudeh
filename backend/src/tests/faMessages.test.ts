import { describe, expect, it } from 'vitest';
import { fa, formatZodIssueMessage } from '../messages/fa.js';

describe('Persian validation messages', () => {
  it('uses friendly Persian text for default Zod errors', () => {
    expect(
      formatZodIssueMessage({ code: 'invalid_type', message: 'Expected string, received number' }),
    ).toBe(fa.errors.invalidValue);
    expect(
      formatZodIssueMessage({
        code: 'too_small',
        message: 'String must contain at least 1 character(s)',
      }),
    ).toBe(fa.errors.valueTooSmall);
    expect(
      formatZodIssueMessage({ code: 'invalid_enum_value', message: 'Invalid enum value' }),
    ).toBe(fa.errors.invalidChoice);
  });

  it('preserves already localized Zod messages', () => {
    expect(formatZodIssueMessage({ code: 'custom', message: 'تاریخ معتبر نیست.' })).toBe(
      'تاریخ معتبر نیست.',
    );
    expect(
      formatZodIssueMessage({
        code: 'custom',
        message: 'در محیط عملیاتی باید از HTTPS استفاده کند.',
      }),
    ).toBe('در محیط عملیاتی باید از HTTPS استفاده کند.');
  });
});
