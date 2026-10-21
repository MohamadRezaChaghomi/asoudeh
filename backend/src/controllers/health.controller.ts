import type { RequestHandler } from 'express';
import { isDatabaseReady } from '../config/db.js';

const serviceName = 'asoudeh-backend';

export const healthCheck: RequestHandler = (_req, res) => res.json({
  success: true,
  data: {
    status: 'ok',
    service: serviceName,
    timestamp: new Date().toISOString(),
  },
});

export const readinessCheck: RequestHandler = (_req, res) => {
  if (!isDatabaseReady()) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_READY',
        message: 'Service is not ready.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      status: 'ready',
      service: serviceName,
      timestamp: new Date().toISOString(),
    },
  });
};
