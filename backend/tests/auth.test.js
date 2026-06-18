import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
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

  it('versioned alias /api/v1 is mounted and uses the uniform error shape', async () => {
    const res = await request(app).get('/api/v1/credits');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
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

  it('rejects a tampered token → next(AppError 401 UNAUTHORIZED)', () => {
    const req = { headers: { authorization: 'Bearer x.y.z' } };
    // Failures now delegate to the central errorHandler via next(err) for one
    // uniform { success, error, code } response shape — they don't write res.
    let nextErr;
    requireAuth(req, mockRes(), (e) => { nextErr = e; });
    expect(nextErr?.status).toBe(401);
    expect(nextErr?.code).toBe('UNAUTHORIZED');
  });
});

describe('requireAdmin', () => {
  // M2: a user token is signed without the admin audience (and, in prod, with a
  // different secret), so it fails admin VERIFICATION outright (401) rather than
  // merely the role check — it can't even be parsed as an admin token.
  it('rejects an ordinary user token → next(AppError 401) (wrong audience)', () => {
    const token = signAppToken({ accountId: 'a1', firebaseUid: 'f1', phone: '+100' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nextErr;
    requireAdmin(req, mockRes(), (e) => { nextErr = e; });
    expect(nextErr?.status).toBe(401);
    expect(nextErr?.code).toBe('UNAUTHORIZED');
  });

  it('accepts an admin token', () => {
    const token = signAdminToken({ adminId: 'x', username: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nexted = false;
    requireAdmin(req, mockRes(), () => { nexted = true; });
    expect(nexted).toBe(true);
  });
});
