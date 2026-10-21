import type { RequestHandler } from 'express';

export const healthCheck: RequestHandler = (_req, res) => res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'asoudeh-backend',
      timestamp: new Date().toISOString(),
    },
  });
