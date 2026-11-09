import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';
import { fa, formatZodIssueMessage } from '../messages/fa.js';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  retryAfter?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.publicMessage,
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: fa.errors.invalidBody,
      details: error.issues.map(({ path, code, message }) => ({
        field: path.join('.'),
        message: formatZodIssueMessage({ code, message }),
      })),
    };
  }

  if (isRecord(error) && error.type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'اندازهٔ درخواست بیش از حد مجاز است.',
    };
  }

  if (
    isRecord(error) &&
    (error.type === 'entity.parse.failed' ||
      (error instanceof SyntaxError && 'body' in error))
  ) {
    return {
      statusCode: 400,
      code: 'MALFORMED_JSON',
      message: 'ساختار JSON درخواست معتبر نیست.',
    };
  }

  if (isRecord(error) && error.name === 'CastError') {
    return {
      statusCode: 400,
      code: 'INVALID_IDENTIFIER',
      message: 'شناسهٔ واردشده معتبر نیست.',
    };
  }

  if (isRecord(error) && error.code === 11000) {
    return {
      statusCode: 409,
      code: 'RESOURCE_CONFLICT',
      message: 'این مورد از قبل ثبت شده است.',
    };
  }

  if (
    isRecord(error) &&
    ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError',
      'MongoNetworkTimeoutError', 'MongoServerClosedError', 'MongoTopologyClosedError',
      'MongoServerSelectionError'].includes(String(error.name))
  ) {
    return {
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'سرویس موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.',
    };
  }

  if (
    isRecord(error) &&
    error.name === 'MongooseError' &&
    typeof error.message === 'string' &&
    /buffering timed out|not connected to any servers|connection .*closed/i.test(error.message)
  ) {
    return {
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'سرویس موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.',
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'خطایی در سرور رخ داد.',
  };
}

export const notFound: RequestHandler = (_req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: 'مسیر درخواستی پیدا نشد.' },
});

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  const normalized = normalizeError(error);
  if (normalized.statusCode >= 500) {
    logger.error(
      {
        requestId: res.locals.requestId,
        event: 'http_error',
        statusCode: normalized.statusCode,
        code: normalized.code,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'http_error',
    );
  }

  if (normalized.retryAfter) {
    res.setHeader('Retry-After', String(normalized.retryAfter));
  }

  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
  });
};
