import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

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
  const isPayloadTooLarge =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large';
  const statusCode = isKnownError ? error.statusCode : isPayloadTooLarge ? 413 : 500;
  const code = isKnownError ? error.code : isPayloadTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
  logger.error(
    {
      requestId: res.locals.requestId,
      event: 'http_error',
      statusCode,
      code,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    },
    'http_error',
  );

  if (isKnownError && error.retryAfter) {
    res.setHeader('Retry-After', String(error.retryAfter));
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: isKnownError
        ? error.publicMessage
        : isPayloadTooLarge
          ? 'اندازهٔ درخواست بیش از حد مجاز است.'
          : 'خطایی در سرور رخ داد.',
    },
  });
};
