import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { sendSmsIrOtp } from '../services/smsIrProvider.js';

const explicitlyEnabled = process.env.SMSIR_SANDBOX_TEST_ENABLED === 'true';

describe.skipIf(!explicitlyEnabled)('SMS.ir Sandbox connection test', () => {
  it('sends one Verify request to the configured test mobile', async () => {
    if (env.smsIrMode !== 'sandbox') {
      throw new Error('SMSIR_MODE must be sandbox for this opt-in test.');
    }

    const mobile = process.env.SMSIR_SANDBOX_TEST_MOBILE?.trim();
    if (!mobile) {
      throw new Error('SMSIR_SANDBOX_TEST_MOBILE must be set to run this opt-in test.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const result = await sendSmsIrOtp(mobile, code);

    expect(result.messageId).toBeGreaterThan(0);
  });
});
