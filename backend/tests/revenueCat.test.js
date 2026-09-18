// RevenueCat webhook → ledger. The money contract: one event = one grant,
// redelivery = zero, sandbox never grants in prod, wrong secret never reaches
// the service. Runs on sqlite with no network — RC is just JSON here.

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import sequelize from '../src/config/dbConfig.js';
import { User, CreditPlan, Purchase } from '../src/models/index.js';
import { handleEvent } from '../src/services/revenueCatService.js';
import { getBalance } from '../src/services/creditService.js';
import { env } from '../src/config/envConfig.js';

const USER_FORM = { name: 'RC Tester', birthDate: '2000-01-01', birthTime: '12:00', birthCity: 'Mumbai' };
const PACK_SKU = 'com.astro.credits.100';

const event = (over = {}) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  type: 'NON_RENEWING_PURCHASE',
  app_user_id: '', product_id: PACK_SKU,
  transaction_id: 't1',
  store: 'APP_STORE', environment: 'PRODUCTION',
  ...over,
});

describe('revenueCatService.handleEvent', () => {
  let user, pack;

  beforeAll(async () => {
    await sequelize.query('PRAGMA journal_mode=WAL;');
    await sequelize.sync();
    pack = await CreditPlan.create({ name: 'Pack', productId: PACK_SKU, credits: 100, priceInr: 4900 });
    user = await User.create({ ...USER_FORM, phone: '+919000000101', credits: 0 });
  });

  it('grants a one-off pack once, then ignores the redelivery', async () => {
    const ev = event({ app_user_id: user.id, transaction_id: 'pack-1' });
    expect((await handleEvent(ev)).granted).toBe(100);
    expect((await handleEvent(ev))).toMatchObject({ granted: 0, duplicate: true });
    expect(await getBalance(user.id)).toBe(100);
    expect(await Purchase.count({ where: { userId: user.id } })).toBe(1);
    expect((await Purchase.findOne({ where: { userId: user.id } })).providerTxnId).toBe('rc:pack-1');
  });

  it('ignores anonymous users, unknown users, unknown products, and other event types', async () => {
    expect((await handleEvent(event({ app_user_id: '$RCAnonymousID:abc' }))).reason).toBe('anonymous');
    expect((await handleEvent(event({ app_user_id: 'nope' }))).reason).toBe('unknown_user');
    expect((await handleEvent(event({ app_user_id: user.id, product_id: 'nope' }))).reason).toBe('unknown_product');
    expect((await handleEvent(event({ app_user_id: user.id, type: 'RENEWAL' }))).reason).toBe('ignored_type');
  });

  it('never grants a SANDBOX event in production', async () => {
    const saved = env.NODE_ENV; env.NODE_ENV = 'production';
    try {
      const r = await handleEvent(event({ app_user_id: user.id, transaction_id: 'sb-1', environment: 'SANDBOX' }));
      expect(r.reason).toBe('sandbox');
    } finally { env.NODE_ENV = saved; }
  });
});

describe('POST /api/credits/rc-webhook auth', () => {
  let app;
  beforeAll(async () => { app = (await import('../src/server.js')).default; });

  it('503 when the secret is not configured', async () => {
    const saved = env.REVENUECAT_WEBHOOK_SECRET; env.REVENUECAT_WEBHOOK_SECRET = undefined;
    try {
      const res = await request(app).post('/api/credits/rc-webhook').send({ event: event({ app_user_id: 'x' }) });
      expect(res.status).toBe(503);
    } finally { env.REVENUECAT_WEBHOOK_SECRET = saved; }
  });

  it('401 on a wrong secret, 200 on the right one (bare or Bearer)', async () => {
    env.REVENUECAT_WEBHOOK_SECRET = 'rc-test-secret';
    const body = { event: event({ app_user_id: '$RCAnonymousID:x' }) };
    expect((await request(app).post('/api/credits/rc-webhook').set('Authorization', 'wrong').send(body)).status).toBe(401);
    expect((await request(app).post('/api/credits/rc-webhook').set('Authorization', 'rc-test-secret').send(body)).status).toBe(200);
    expect((await request(app).post('/api/credits/rc-webhook').set('Authorization', 'Bearer rc-test-secret').send(body)).status).toBe(200);
  });
});
