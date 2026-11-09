import axios from 'axios';
import { fa } from '@/lib/messages/fa';

interface ApiErrorResponse {
  error?: {
    code?: string;
  };
}

const errorMessages: Record<string, string> = {
  ACCOUNT_DELETION_PENDING: 'این حساب در صف حذف قرار دارد.',
  AUTHENTICATION_REQUIRED: 'برای ادامه دوباره وارد حساب خود شوید.',
  INVALID_PHONE: 'شماره همراه معتبر ایرانی وارد کنید.',
  OTP_INVALID: 'کد تأیید معتبر نیست یا منقضی شده است.',
  SESSION_EXPIRED: 'نشست شما منقضی شده است؛ دوباره وارد شوید.',
  SESSION_INVALID: 'نشست معتبر نیست؛ دوباره وارد شوید.',
  TRANSACTION_UNDO_EXPIRED: 'مهلت بازگردانی تراکنش به پایان رسیده است.',
  VALIDATION_ERROR: fa.errors.validation,
};

function retryDelay(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(1, Math.ceil((date - Date.now()) / 1000));
}

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fa.errors.generic;
  }

  const response = error.response;
  if (!response) {
    return fa.errors.network;
  }
  const status = response.status;
  if (status === 429) {
    const header = response.headers['retry-after'];
    const delay = retryDelay(header == null ? undefined : String(header));
    return delay
      ? `تعداد درخواست‌ها زیاد است؛ ${new Intl.NumberFormat('fa-IR').format(delay)} ثانیهٔ دیگر دوباره تلاش کنید.`
      : fa.errors.tooManyRequests;
  }
  if (status >= 500) {
    return fa.errors.serverUnavailable;
  }

  const code = response.data?.error?.code;
  return (code && errorMessages[code]) || fa.errors.requestFailed;
}
