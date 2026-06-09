import { describe, it, expect } from 'vitest';
import { AppError } from '../src/errors/AppError.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function mockRes() {
  return {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

// Locks in the single-error-type standardization (AppError) and the envelope
// the global handler produces.
describe('AppError', () => {
  it('http(status, message, code) maps to the right fields', () => {
    const e = AppError.http(404, 'Order not found', 'ORDER_NOT_FOUND');
    expect(e).toBeInstanceOf(AppError);
    expect(e.status).toBe(404);
    expect(e.code).toBe('ORDER_NOT_FOUND');
    expect(e.message).toBe('Order not found');
  });

  it('named helpers carry the expected status + default code', () => {
    expect(AppError.badRequest().status).toBe(400);
    expect(AppError.badRequest().code).toBe('BAD_REQUEST');
    expect(AppError.unauthorized().status).toBe(401);
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.conflict().status).toBe(409);
  });
});

describe('errorHandler', () => {
  it('translates an AppError into status + { success:false, error, code }', () => {
    const res = mockRes();
    errorHandler(AppError.http(402, 'Not enough credits', 'INSUFFICIENT_CREDITS'), {}, res, () => {});
    expect(res.statusCode).toBe(402);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Not enough credits',
      code: 'INSUFFICIENT_CREDITS',
    });
  });

  it('derives status from a known code when status is absent', () => {
    const res = mockRes();
    errorHandler({ code: 'RATE_LIMITED', message: 'slow down' }, {}, res, () => {});
    expect(res.statusCode).toBe(429);
  });

  it('falls back to 500 for an unknown error', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.statusCode).toBe(500);
  });
});
