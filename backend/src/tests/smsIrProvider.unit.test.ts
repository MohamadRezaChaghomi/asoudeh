import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { sendSmsIrOtp } from '../services/smsIrProvider.js';

const originalMode = env.smsIrMode;
const originalApiKey = env.smsIrApiKey;
const originalTemplateId = env.smsIrVerifyTemplateId;

afterEach(() => {
  vi.unstubAllGlobals();
  env.smsIrMode = originalMode;
  env.smsIrApiKey = originalApiKey;
  env.smsIrVerifyTemplateId = originalTemplateId;
});

function configureProvider(): void {
  env.smsIrMode = 'sandbox';
  env.smsIrApiKey = 'test-api-key';
  env.smsIrVerifyTemplateId = '123456';
}

describe('SMS.ir Verify API adapter', () => {
  it('sends the documented Verify request shape and accepts an API-accepted message', async () => {
    configureProvider();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 1, message: 'OK', data: { messageId: 42, cost: 2 } }), {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSmsIrOtp('+989121234567', '001234')).resolves.toEqual({
      messageId: 42,
      cost: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.sms.ir/v1/send/verify');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({
      'x-api-key': 'test-api-key',
      Accept: 'text/plain',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      mobile: '09121234567',
      templateId: 123456,
      parameters: [{ name: 'Code', value: '001234' }],
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends the Verify request in sandbox mode', async () => {
    configureProvider();
    env.smsIrMode = 'sandbox';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: { messageId: 7, cost: 1 } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSmsIrOtp('09121234567', '123456')).resolves.toEqual({
      messageId: 7,
      cost: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['API key', (): void => { env.smsIrApiKey = undefined; }, 'missing_api_key'],
    ['template ID', (): void => { env.smsIrVerifyTemplateId = 'not-an-id'; }, 'invalid_template_id'],
  ] as const)(
    'rejects missing or invalid %s before making a request',
    async (_label, invalidate, category) => {
      configureProvider();
      invalidate();
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', fetchMock);

      await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({ category });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid mobile numbers and invalid codes before network access', async () => {
    configureProvider();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSmsIrOtp('08123456789', '123456')).rejects.toMatchObject({
      category: 'invalid_mobile',
    });
    await expect(sendSmsIrOtp('09121234567', '12345')).rejects.toMatchObject({
      category: 'invalid_code',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a provider failure even when HTTP status is successful', async () => {
    configureProvider();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: 0, message: 'Rejected', data: null }), {
          status: 200,
        }),
      ),
    );

    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category: 'provider_rejected',
      httpStatus: 200,
    });
  });

  it.each([
    [401, 'invalid_api_key'],
    [403, 'invalid_api_key'],
    [402, 'insufficient_credit'],
    [429, 'rate_limited'],
    [503, 'provider_rejected'],
  ] as const)('classifies HTTP %i without exposing response content', async (status, category) => {
    configureProvider();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('private provider response', { status }),
      ),
    );

    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category,
      httpStatus: status,
    });
  });

  it('rejects malformed success payloads and times out without retrying', async () => {
    configureProvider();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{not-json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 1, data: null }), { status: 200 }),
      )
      .mockRejectedValueOnce(new DOMException('Aborted', 'TimeoutError'))
      .mockRejectedValueOnce(new TypeError('network details must not escape'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category: 'malformed_response',
    });
    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category: 'malformed_response',
    });
    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category: 'provider_timeout',
    });
    await expect(sendSmsIrOtp('09121234567', '123456')).rejects.toMatchObject({
      category: 'network_error',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
