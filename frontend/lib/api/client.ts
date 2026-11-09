import axios, { AxiosRequestConfig } from 'axios';
import { getApiErrorMessage } from './errorMessage';

declare module 'axios' {
  interface AxiosRequestConfig {
    _sessionRetry?: boolean;
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let csrfToken: string | undefined;
let csrfPromise: Promise<string> | undefined;
let refreshPromise: Promise<void> | undefined;

api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (method && !['get', 'head', 'options'].includes(method)) {
    config.headers.set('X-CSRF-Token', await ensureCsrfToken());
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const token = response.data?.data?.csrfToken;
    if (typeof token === 'string') {
      csrfToken = token;
    }
    if (response.config.url?.startsWith('/auth/logout')) {
      csrfToken = undefined;
      csrfPromise = undefined;
    }
    return response;
  },
  (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const safeMessage = getApiErrorMessage(error);
    error.message = safeMessage;
    if (error.response) {
      const body: unknown = error.response.data;
      const apiBody =
        typeof body === 'object' && body !== null
          ? (body as { error?: unknown })
          : {};
      const apiError =
        typeof apiBody.error === 'object' && apiBody.error !== null
          ? (apiBody.error as Record<string, unknown>)
          : {};
      error.response.data = {
        success: false,
        error: { ...apiError, code: apiError.code ?? 'REQUEST_FAILED', message: safeMessage },
      };
    }
    const config = error.config as AxiosRequestConfig | undefined;
    const isRefreshableRequest =
      config?.url?.startsWith('/auth/activity') ||
      config?.url?.startsWith('/me') ||
      config?.url?.startsWith('/categories') ||
      config?.url?.startsWith('/budgets') ||
      config?.url?.startsWith('/reminders') ||
      config?.url?.startsWith('/transactions') ||
      config?.url?.startsWith('/reports') ||
      config?.url?.startsWith('/caregiver') ||
      config?.url?.startsWith('/dashboard');

    if (
      error.response?.status !== 401 ||
      !config ||
      !isRefreshableRequest ||
      config._sessionRetry
    ) {
      return Promise.reject(error);
    }

    config._sessionRetry = true;
    if (!refreshPromise) {
      refreshPromise = ensureCsrfToken()
        .then(() => api.post('/auth/refresh'))
        .then(() => undefined)
        .finally(() => {
          refreshPromise = undefined;
        });
    }

    return refreshPromise.then(
      () => api.request(config),
      () => Promise.reject(error),
    );
  },
);

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = api
      .get('/auth/csrf')
      .then((response) => {
        const token = response.data?.data?.csrfToken;
        if (typeof token !== 'string') {
          throw new Error('سرور اعتبار درخواست را تأیید نکرد.');
        }
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfPromise = undefined;
      });
  }
  return csrfPromise;
}
