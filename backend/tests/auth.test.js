import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { signAppToken, signAdminToken, requireAuth, requireAdmin } from '../src/middleware/auth.js';

// A minimal Express res double for unit-testing the middleware directly.
function mockRes() {
  return {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

// Route-level rejection paths — these return before any DB call, so they run
// without a database.
describe('auth — protected routes reject bad/missing tokens', () => {
  it('no token → 401', async () => {
    const res = await request(app).get('/api/credits');
    expect(res.status).toBe(401);
  });

  it('malformed token → 401', async () => {
    const res = await request(app).get('/api/credits').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });
});

describe('requireAuth', () => {
  it('accepts a valid app token and populates req.auth', () => {
    const token = signAppToken({ accountId: 'a1', firebaseUid: 'f1', phone: '+100', userId: 'u1' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nexted = false;
    requireAuth(req, mockRes(), () => { nexted = true; });
    expect(nexted).toBe(true);
    expect(req.auth).toMatchObject({ accountId: 'a1', userId: 'u1' });
  });

  it('rejects a tampered token → 401, never calls next', () => {
    const req = { headers: { authorization: 'Bearer x.y.z' } };
    const res = mockRes();
    let nexted = false;
    requireAuth(req, res, () => { nexted = true; });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAdmin', () => {
  it('rejects an ordinary user token → 403 (valid JWT, wrong role)', () => {
    const token = signAppToken({ accountId: 'a1', firebaseUid: 'f1', phone: '+100' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    requireAdmin(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });

  it('accepts an admin token', () => {
    const token = signAdminToken({ adminId: 'x', username: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nexted = false;
    requireAdmin(req, mockRes(), () => { nexted = true; });
    expect(nexted).toBe(true);
  });
});
