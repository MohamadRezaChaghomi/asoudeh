import type { RequestHandler } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

export function validateBody<Output, Input = Output>(
  schema: ZodType<Output, ZodTypeDef, Input>,
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(result.error);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateParams<T extends Record<string, string>>(
  schema: ZodType<T>,
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
  schema: ZodType<Output, ZodTypeDef, Input>,
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
