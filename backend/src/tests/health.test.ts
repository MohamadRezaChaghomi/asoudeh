import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import * as database from '../config/db.js';
import { errorHandler } from '../middleware/errorHandler.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTTP application baseline', () => {
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
        message: 'Service is not ready.',
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
      message: 'Asoudeh API is running',
    });
  });

  it('returns the standard not-found response for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  it('returns a generic server error without exposing internal details', async () => {
    const errorApp = express();
    errorApp.get('/error', (_req, _res, next) => {
      next(new Error('internal database details'));
    });
    errorApp.use(errorHandler);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(errorApp).get('/error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'خطایی در سرور رخ داد.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('internal database details');
  });
});
