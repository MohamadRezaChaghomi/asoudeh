import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

export const notFound: RequestHandler = (_req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'مسیر درخواستی پیدا نشد.' },
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

  const isKnownError = error instanceof HttpError;
  const statusCode = isKnownError ? error.statusCode : 500;
  const code = isKnownError ? error.code : 'INTERNAL_ERROR';
  const stack =
    env.nodeEnv === 'development' && error instanceof Error
      ? error.stack?.split('\n').slice(1).join('\n')
      : undefined;

  console.error(
    JSON.stringify({
      level: 'error',
      event: 'http_error',
      statusCode,
      code,
      errorType: error instanceof Error ? error.name : 'UnknownError',
      ...(stack ? { stack } : {}),
    }),
  );

  if (isKnownError && error.retryAfter) {
    res.setHeader('Retry-After', String(error.retryAfter));
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: isKnownError ? error.publicMessage : 'خطایی در سرور رخ داد.',
    },
  });
};
