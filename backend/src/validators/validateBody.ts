import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/httpError.js';

function containsUnsafeKey(value: unknown): boolean {
  const pending = [value];

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== 'object' || current === null) continue;

    for (const [key, nestedValue] of Object.entries(current)) {
      if (key.includes('$') || key.includes('.')) return true;
      pending.push(nestedValue);
    }
  }

  return false;
}

export function validateBody<Output, Input = Output>(
  schema: ZodType<Output, Input>,
): RequestHandler {
  return (req, _res, next) => {
    if (containsUnsafeKey(req.body)) {
      next(new HttpError(400, 'INVALID_BODY_KEY', 'اطلاعات واردشده معتبر نیست.'));
      return;
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(result.error);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateParams<T extends Record<string, string>, Input = T>(
  schema: ZodType<T, Input>,
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(result.error);
      return;
    }

    Object.assign(req.params, result.data);
    next();
  };
}

export function validateQuery<Output, Input = Output>(
  schema: ZodType<Output, Input>,
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(result.error);
      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}
