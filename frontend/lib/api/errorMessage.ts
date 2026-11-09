import axios from 'axios';

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
  VALIDATION_ERROR: 'اطلاعات واردشده معتبر نیست.',
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
    return 'خطایی رخ داد. دوباره تلاش کنید.';
  }

  const response = error.response;
  if (!response) {
    return 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
  }
  const status = response.status;
  if (status === 429) {
    const header = response.headers['retry-after'];
    const delay = retryDelay(header == null ? undefined : String(header));
    return delay
      ? `تعداد درخواست‌ها زیاد است؛ ${new Intl.NumberFormat('fa-IR').format(delay)} ثانیهٔ دیگر دوباره تلاش کنید.`
      : 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.';
  }
  if (status >= 500) {
    return 'سرویس موقتاً با مشکل روبه‌رو شده است؛ کمی بعد دوباره تلاش کنید.';
  }

  const code = response.data?.error?.code;
  return (code && errorMessages[code]) || 'درخواست انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.';
}
