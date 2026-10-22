import { env } from '../config/env.js';
import { normalizeIranianMobile } from '../utils/authCrypto.js';

const SMSIR_TIMEOUT_MS = 8_000;
const SMSIR_SUCCESS_STATUS = 1;

export type SmsIrFailureCategory =
  | 'missing_api_key'
  | 'invalid_template_id'
  | 'missing_parameter_name'
  | 'invalid_base_url'
  | 'sandbox_not_supported'
  | 'invalid_mobile'
  | 'invalid_code'
  | 'invalid_api_key'
  | 'insufficient_credit'
  | 'rate_limited'
  | 'provider_rejected'
  | 'provider_timeout'
  | 'network_error'
  | 'malformed_response';

export class SmsIrProviderError extends Error {
  constructor(
    public readonly category: SmsIrFailureCategory,
    public readonly httpStatus?: number,
  ) {
    super(`SMS.ir OTP request failed: ${category}`);
    this.name = 'SmsIrProviderError';
  }
}

interface SmsIrResponse {
  status?: unknown;
  data?: {
    messageId?: unknown;
    cost?: unknown;
  } | null;
}

function getConfiguration(): {
  apiKey: string;
  templateId: number;
  parameterName: string;
  endpoint: string;
} {
  if (!env.smsIrApiKey) throw new SmsIrProviderError('missing_api_key');

  const templateIdValue = env.smsIrTemplateId ?? '';
  if (!/^[1-9]\d*$/.test(templateIdValue)) {
    throw new SmsIrProviderError('invalid_template_id');
  }
  const templateId = Number(templateIdValue);
  if (!Number.isSafeInteger(templateId) || templateId > 2_147_483_647) {
    throw new SmsIrProviderError('invalid_template_id');
  }

  const parameterName = env.smsIrOtpParameterName?.trim();
  if (!parameterName || parameterName.length > 100) {
    throw new SmsIrProviderError('missing_parameter_name');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(env.smsIrBaseUrl);
  } catch {
    throw new SmsIrProviderError('invalid_base_url');
  }
  if (
    baseUrl.protocol !== 'https:' ||
    baseUrl.hostname !== 'api.sms.ir' ||
    baseUrl.pathname.replace(/\/+$/, '') !== '/v1' ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new SmsIrProviderError('invalid_base_url');
  }

  return {
    apiKey: env.smsIrApiKey,
    templateId,
    parameterName,
    endpoint: `${baseUrl.origin}/v1/send/verify`,
  };
}

function responseFailureCategory(status: number): SmsIrFailureCategory {
  if (status === 401 || status === 403) return 'invalid_api_key';
  if (status === 402) return 'insufficient_credit';
  if (status === 429) return 'rate_limited';
  return 'provider_rejected';
}

export async function sendSmsIrOtp(
  mobileInput: string,
  code: string,
): Promise<{ messageId: number; cost?: number }> {
  if (env.smsIrMode !== 'production') {
    throw new SmsIrProviderError('sandbox_not_supported');
  }

  const mobile = normalizeIranianMobile(mobileInput);
  if (!mobile) throw new SmsIrProviderError('invalid_mobile');
  if (!/^\d{6}$/.test(code)) throw new SmsIrProviderError('invalid_code');

  const configuration = getConfiguration();
  let response: Response;
  try {
    response = await fetch(configuration.endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': configuration.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile,
        templateId: configuration.templateId,
        parameters: [{ name: configuration.parameterName, value: code }],
      }),
      signal: AbortSignal.timeout(SMSIR_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new SmsIrProviderError('provider_timeout');
    }
    throw new SmsIrProviderError('network_error');
  }

  if (!response.ok) {
    throw new SmsIrProviderError(responseFailureCategory(response.status), response.status);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await response.json();
  } catch {
    throw new SmsIrProviderError('malformed_response', response.status);
  }

  if (typeof parsedBody !== 'object' || parsedBody === null) {
    throw new SmsIrProviderError('malformed_response', response.status);
  }
  const body = parsedBody as SmsIrResponse;
  if (body.status !== SMSIR_SUCCESS_STATUS) {
    throw new SmsIrProviderError('provider_rejected', response.status);
  }

  const messageId = body.data?.messageId;
  if (typeof messageId !== 'number' || !Number.isSafeInteger(messageId) || messageId < 1) {
    throw new SmsIrProviderError('malformed_response', response.status);
  }

  const cost = body.data?.cost;
  return {
    messageId,
    ...(typeof cost === 'number' && Number.isFinite(cost) ? { cost } : {}),
  };
}
