import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const path = req.path;
  const startedAt = process.hrtime.bigint();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        responseTimeMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      },
      'http_request',
    );
  });
  next();
};
