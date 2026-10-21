import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

interface AppError {
  statusCode?: number;
  code?: string | number;
  publicMessage?: string;
}

function isAppError(error: unknown): error is AppError {
  return typeof error === 'object' && error !== null;
}

export const notFound: RequestHandler = (_req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'Route not found' },
});

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'اطلاعات واردشده معتبر نیست.',
        details: error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
      },
    });
    return;
  }

  console.error(error);

  if (error instanceof HttpError && error.retryAfter) {
    res.setHeader('Retry-After', String(error.retryAfter));
  }

  const appError = isAppError(error) ? error : {};
  res.status(appError.statusCode || 500).json({
    success: false,
    error: {
      code: appError.code || 'INTERNAL_ERROR',
      message: appError.publicMessage || 'خطایی در سرور رخ داد.',
    },
  });
};
