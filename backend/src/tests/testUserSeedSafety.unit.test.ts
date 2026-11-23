import { describe, expect, it } from 'vitest';
import { validateTestUserSeedTarget } from '../utils/testUserSeedSafety.js';

const confirmation = 'seed-test-users';
const otpSimulatorEnabled = 'true';
const uri = 'mongodb://127.0.0.1:27017/asoudeh_dev';

describe('test user seed target validation', () => {
  it('accepts only an explicitly confirmed development target with the OTP simulator enabled', () => {
    expect(
      validateTestUserSeedTarget({
        nodeEnv: 'development',
        confirmation,
        otpSimulatorEnabled,
        uri,
      }),
    ).toBe(uri);
  });

  it.each([
    {
      label: 'production environment',
      nodeEnv: 'production',
      confirmation,
      otpSimulatorEnabled,
      uri,
    },
    {
      label: 'missing confirmation',
      nodeEnv: 'development',
      confirmation: undefined,
      otpSimulatorEnabled,
      uri,
    },
    {
      label: 'disabled OTP simulator',
      nodeEnv: 'development',
      confirmation,
      otpSimulatorEnabled: 'false',
      uri,
    },
    {
      label: 'test database',
      nodeEnv: 'development',
      confirmation,
      otpSimulatorEnabled,
      uri: 'mongodb://127.0.0.1:27017/asoudeh_test',
    },
    {
      label: 'remote host',
      nodeEnv: 'development',
      confirmation,
      otpSimulatorEnabled,
      uri: 'mongodb://example.invalid:27017/asoudeh_dev',
    },
    {
      label: 'credentialed URI',
      nodeEnv: 'development',
      confirmation,
      otpSimulatorEnabled,
      uri: 'mongodb://user:password@127.0.0.1:27017/asoudeh_dev',
    },
    {
      label: 'URI options',
      nodeEnv: 'development',
      confirmation,
      otpSimulatorEnabled,
      uri: 'mongodb://127.0.0.1:27017/asoudeh_dev?retryWrites=true',
    },
  ])('rejects $label without connecting to a database', (environment) => {
    expect(() => validateTestUserSeedTarget(environment)).toThrow();
  });
});
