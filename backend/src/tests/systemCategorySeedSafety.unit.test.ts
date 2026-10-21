import { describe, expect, it } from 'vitest';
import { validateSystemCategorySeedTarget } from '../utils/systemCategorySeedSafety.js';

const confirmation = 'seed-default-categories';

describe('system category seed target validation', () => {
  it('accepts only the explicit local development database target', () => {
    expect(
      validateSystemCategorySeedTarget({
        nodeEnv: 'development',
        confirmation,
        uri: 'mongodb://127.0.0.1:27017/asoudeh_dev',
      }),
    ).toBe('mongodb://127.0.0.1:27017/asoudeh_dev');
  });

  it.each([
    {
      label: 'test database',
      nodeEnv: 'development',
      confirmation,
      uri: 'mongodb://127.0.0.1:27017/asoudeh_test',
    },
    {
      label: 'production environment',
      nodeEnv: 'production',
      confirmation,
      uri: 'mongodb://127.0.0.1:27017/asoudeh_dev',
    },
    {
      label: 'missing confirmation',
      nodeEnv: 'development',
      uri: 'mongodb://127.0.0.1:27017/asoudeh_dev',
      confirmation: undefined,
    },
    {
      label: 'remote host',
      nodeEnv: 'development',
      confirmation,
      uri: 'mongodb://example.invalid:27017/asoudeh_dev',
    },
    {
      label: 'credentialed URI',
      nodeEnv: 'development',
      confirmation,
      uri: 'mongodb://user:password@127.0.0.1:27017/asoudeh_dev',
    },
    {
      label: 'URI options',
      nodeEnv: 'development',
      confirmation,
      uri: 'mongodb://127.0.0.1:27017/asoudeh_dev?retryWrites=true',
    },
  ])('rejects $label without connecting to a database', ({ nodeEnv, uri, confirmation: confirm }) => {
    expect(() =>
      validateSystemCategorySeedTarget({
        nodeEnv,
        confirmation: confirm,
        uri,
      }),
    ).toThrow();
  });
});
