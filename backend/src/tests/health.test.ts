import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import * as database from '../config/db.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTTP application baseline', () => {
  it.each([
    {
      label: 'Zod validation',
      error: z.object({ amount: z.number() }).safeParse({ amount: 'invalid' }).error,
      status: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      label: 'Mongoose CastError',
      error: Object.assign(new Error('private cast value'), { name: 'CastError' }),
      status: 400,
      code: 'INVALID_IDENTIFIER',
    },
    {
      label: 'duplicate key',
      error: Object.assign(new Error('private duplicate value'), { code: 11000 }),
      status: 409,
      code: 'RESOURCE_CONFLICT',
    },
    {
      label: 'MongoDB disconnection',
      error: Object.assign(new Error('private database address'), {
        name: 'MongoNetworkError',
      }),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    },
    {
      label: 'Mongoose disconnected buffering timeout',
      error: Object.assign(new Error('Operation secret collection buffering timed out'), {
        name: 'MongooseError',
      }),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    },
  ])('maps $label into the public error contract', async ({ error, status, code }) => {
    const errorApp = express();
    errorApp.post('/error', (_req, _res, next) => next(error));
    errorApp.use(errorHandler);

    const response = await request(errorApp).post('/error').send({});

    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({
      success: false,
      error: { code, message: expect.any(String) },
    });
    expect(JSON.stringify(response.body)).not.toContain('private');
  });

  it('maps malformed JSON into the public error contract', async () => {
    const parserApp = express();
    parserApp.use(express.json({ limit: '1mb' }));
    parserApp.post('/error', (_req, res) => res.json({ success: true }));
    parserApp.use(errorHandler);

    const response = await request(parserApp)
      .post('/error')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });

  it('forwards rejected async handler promises into the error middleware', async () => {
    const errorApp = express();
    errorApp.post(
      '/error',
      asyncHandler(async () => {
        throw new Error('private async failure');
      }),
    );
    errorApp.use(errorHandler);

    const response = await request(errorApp).post('/error');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private async failure');
  });

  it('returns the current health response shape', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'asoudeh-backend',
      },
    });
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
  });

  it('reports the service as not ready while MongoDB is disconnected', async () => {
    vi.spyOn(database, 'isDatabaseReady').mockReturnValue(false);
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'SERVICE_NOT_READY',
        message: 'سرویس هنوز آماده نیست.',
      },
    });
  });

  it('reports the service as ready after MongoDB connects', async () => {
    vi.spyOn(database, 'isDatabaseReady').mockReturnValue(true);
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ready',
        service: 'asoudeh-backend',
      },
    });
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
  });

  it('returns the current root response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'خدمات آسوده فعال است.',
    });
  });

  it('sets API security headers and trusts the configured proxy hop count', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(app.get('trust proxy')).toBe(env.trustProxyHops);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('caps JSON bodies and responds with 413', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(1024 * 1024 + 1) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('does not log request query values', async () => {
    const requestLog = vi.spyOn(logger, 'info');

    await request(app).get('/api/v1/health?phone=log-sentinel');

    const loggedFields = JSON.stringify(requestLog.mock.calls);
    expect(loggedFields).not.toContain('log-sentinel');
    expect(requestLog.mock.calls[0]?.[0]).toMatchObject({
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      method: 'GET',
      path: '/api/v1/health',
    });
  });

  it('logs a structured request ID without sensitive query or body values', async () => {
    const requestLog = vi.spyOn(logger, 'info');
    const response = await request(app)
      .post('/api/v1/auth/otp/request?phone=query-sentinel')
      .send({ phone: 'body-sentinel', code: 'otp-sentinel', token: 'token-sentinel' });
    const loggedFields = JSON.stringify(requestLog.mock.calls);

    expect(response.headers['x-request-id']).toBeTruthy();
    expect(loggedFields).toContain(response.headers['x-request-id']);
    expect(loggedFields).not.toContain('query-sentinel');
    expect(loggedFields).not.toContain('body-sentinel');
    expect(loggedFields).not.toContain('otp-sentinel');
    expect(loggedFields).not.toContain('token-sentinel');
  });

  it('returns the standard not-found response for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'مسیر درخواستی پیدا نشد.' },
    });
  });

  it('returns a generic server error without exposing internal details', async () => {
    const errorApp = express();
    errorApp.use(requestLogger);
    errorApp.post('/error', (_req, _res, next) => {
      next(new Error('internal database details'));
    });
    errorApp.use(errorHandler);
    const errorLog = vi.spyOn(logger, 'error');

    const response = await request(errorApp)
      .post('/error')
      .send({ phone: '09121234567', code: '123456', token: 'secret-token' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'خطایی در سرور رخ داد.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('internal database details');
    expect(errorLog).toHaveBeenCalledOnce();
    const logs = JSON.stringify(errorLog.mock.calls);
    expect(logs).not.toContain('internal database details');
    expect(logs).not.toContain('09121234567');
    expect(logs).not.toContain('123456');
    expect(logs).not.toContain('secret-token');
    expect(errorLog.mock.calls[0]?.[0]).toMatchObject({
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      event: 'http_error',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      errorType: 'Error',
    });
  });
});
