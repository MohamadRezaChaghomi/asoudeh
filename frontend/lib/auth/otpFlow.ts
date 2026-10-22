const OTP_FLOW_KEY = 'asoudeh.pendingOtp';

export interface PendingOtpFlow {
  phone: string;
  developmentOtp?: string;
  resendAvailableAt: number;
  step: 'code' | 'register';
}

function isPendingOtpFlow(value: unknown): value is PendingOtpFlow {
  if (typeof value !== 'object' || value === null) return false;

  const flow = value as Record<string, unknown>;
  return (
    typeof flow.phone === 'string' &&
    /^09\d{9}$/.test(flow.phone) &&
    (flow.developmentOtp === undefined ||
      (typeof flow.developmentOtp === 'string' && /^\d{6}$/.test(flow.developmentOtp))) &&
    typeof flow.resendAvailableAt === 'number' &&
    Number.isFinite(flow.resendAvailableAt) &&
    (flow.step === 'code' || flow.step === 'register')
  );
}

export function savePendingOtpFlow(flow: PendingOtpFlow): void {
  if (!isPendingOtpFlow(flow)) {
    throw new Error('اطلاعات درخواست کد تأیید معتبر نیست.');
  }

  sessionStorage.setItem(OTP_FLOW_KEY, JSON.stringify(flow));
}

export function readPendingOtpFlow(): PendingOtpFlow | null {
  const rawFlow = sessionStorage.getItem(OTP_FLOW_KEY);
  if (!rawFlow) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawFlow);
  } catch {
    sessionStorage.removeItem(OTP_FLOW_KEY);
    return null;
  }

  if (!isPendingOtpFlow(parsed)) {
    sessionStorage.removeItem(OTP_FLOW_KEY);
    return null;
  }

  return parsed;
}

export function clearPendingOtpFlow(): void {
  sessionStorage.removeItem(OTP_FLOW_KEY);
}
