import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

// Proves the app.js/server.js split works: the app is importable and routable
// without binding a port or touching the DB.
describe('health + root', () => {
  it('GET /health → 200 { status: ok }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET / → 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
