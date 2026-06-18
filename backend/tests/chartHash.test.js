// chartHash: the normalized birth-identity key behind the sibling-copy. Covers
// the pure hash AND the end-to-end copy path (kundali) — callGemini is mocked to
// THROW, so the integration tests only pass if the sibling-copy short-circuits
// before any AI call.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Sibling-copy must never reach Gemini — throw if it does.
vi.mock('../src/ai/gemini.js', () => ({
  callGemini: vi.fn(() => { throw new Error('callGemini must NOT run on a sibling-copy'); }),
}));
// The welcome + insight-ready pushes fan out via FCM — stub them so tests don't
// touch Firebase (findOrCreateUser fires notifyWelcome; generate fires notifyInsightReady).
vi.mock('../src/services/pushService.js', () => ({
  notifyWelcome: vi.fn(async () => {}),
  notifyInsightReady: vi.fn(async () => {}),
}));

import sequelize from '../src/config/dbConfig.js';
import { User, Kundali, Setting } from '../src/models/index.js';
import { chartHashFor } from '../src/utils/chartHash.js';
import { findOrCreateUser } from '../src/services/userService.js';
import { generateInterpretation } from '../src/services/kundaliService.js';

describe('chartHashFor (pure)', () => {
  const base = { name: 'Palak', date: '2003-01-22', time: '21:15', city: 'Devada, Gujarat', gender: 'Male' };

  it('is stable for the same identity', () => {
    expect(chartHashFor(base)).toBe(chartHashFor({ ...base }));
  });
  it('ignores whitespace drift (trailing / double spaces)', () => {
    expect(chartHashFor({ ...base, name: ' Palak ', city: 'Devada,  Gujarat' }))
      .toBe(chartHashFor(base));
  });
  it('preserves case sensitivity (pal ≠ Palak)', () => {
    expect(chartHashFor({ ...base, name: 'palak' })).not.toBe(chartHashFor(base));
  });
  it('distinguishes gender', () => {
    expect(chartHashFor({ ...base, gender: 'Female' })).not.toBe(chartHashFor(base));
  });
  it('returns null when a core birth field is missing', () => {
    expect(chartHashFor({ ...base, city: '' })).toBeNull();
    expect(chartHashFor({})).toBeNull();
  });
});

describe('sibling-copy via chartHash', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await Setting.upsert({ key: 'insights_cost', value: '10' });
    await Setting.upsert({ key: 'initial_credits', value: '200' });
  });
  beforeEach(() => vi.clearAllMocks());

  const birth = { name: 'Aman', date: '1995-05-05', time: '08:30', city: 'Pune, India', gender: 'Male' };
  const formA = { ...birth, phone: '+919000000001' };

  async function seedSourceWithKundali(form) {
    const u = await findOrCreateUser(form);
    await Kundali.create({ userId: u.id, chartData: { factSheet: 'x' }, interpretation: { summary: 'SHARED' } });
    return u;
  }

  it('copies an existing sibling reading for a different phone — no Gemini call', async () => {
    await seedSourceWithKundali(formA);
    const formB = { ...birth, phone: '+919000000002' }; // same birth, different phone

    const res = await generateInterpretation({ form: formB, factSheet: 'facts' });

    expect(res.content).toMatchObject({ summary: 'SHARED' });
    const b = await User.findOne({ where: { phone: '+919000000002' } });
    const bKundali = await Kundali.findOne({ where: { userId: b.id } });
    expect(bKundali.interpretation).toMatchObject({ summary: 'SHARED' });
    expect(b.credits).toBe(190); // 200 signup − 10 insights
  });

  it('matches across whitespace drift (trailing space in name)', async () => {
    const formC = { ...birth, name: 'Aman ', phone: '+919000000003' }; // trailing space
    const res = await generateInterpretation({ form: formC, factSheet: 'facts' });
    expect(res.content).toMatchObject({ summary: 'SHARED' });
  });
});
