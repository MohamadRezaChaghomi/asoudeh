import { describe, expect, it } from 'vitest';
import { isDuplicateKeyError } from '../utils/isDuplicateKeyError.js';

describe('isDuplicateKeyError', () => {
  it('recognizes Mongo duplicate-key errors only', () => {
    expect(isDuplicateKeyError(Object.assign(new Error('duplicate'), { code: 11000 }))).toBe(true);

    for (const error of [
      Object.assign(new Error('other'), { code: 11001 }),
      { code: '11000' },
      null,
      undefined,
      'duplicate',
    ]) {
      expect(isDuplicateKeyError(error)).toBe(false);
    }
  });
});
