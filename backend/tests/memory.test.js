import { describe, it, expect, beforeAll } from 'vitest';
import sequelize from '../src/config/dbConfig.js';
import { AuthAccount, ChartMemory } from '../src/models/index.js';
import * as memory from '../src/services/memoryService.js';

// Chart memory is per-account user data, so the two things that must hold are
// (1) one account never sees another's, and (2) a long key round-trips exactly
// — the whole reason the UNIQUE index is on a hash rather than the key itself.
describe('memoryService', () => {
  beforeAll(async () => {
    await sequelize.sync();
    await AuthAccount.bulkCreate([
      { id: 'acct_a_000000000000001', phone: '+911111111111', firebaseUid: 'uid-a' },
      { id: 'acct_b_000000000000002', phone: '+922222222222', firebaseUid: 'uid-b' },
    ], { ignoreDuplicates: true });
  });

  it('scopes memory to the account that wrote it', async () => {
    await memory.set('acct_a_000000000000001', 'timelineCheck:did X happen?', 'yes');
    await memory.set('acct_b_000000000000002', 'timelineCheck:did X happen?', 'no');

    expect(await memory.getAll('acct_a_000000000000001'))
      .toEqual({ 'timelineCheck:did X happen?': 'yes' });
    expect(await memory.getAll('acct_b_000000000000002'))
      .toEqual({ 'timelineCheck:did X happen?': 'no' });
  });

  it('upserts instead of duplicating, so re-answering just overwrites', async () => {
    await memory.set('acct_a_000000000000001', 'asked_alignments:1', { 'Saturn-Moon': true });
    await memory.set('acct_a_000000000000001', 'asked_alignments:1', { 'Saturn-Moon': true, 'Mars-Sun': true });

    const rows = await ChartMemory.findAll({
      where: { accountId: 'acct_a_000000000000001', key: 'asked_alignments:1' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toEqual({ 'Saturn-Moon': true, 'Mars-Sun': true });
  });

  it('keeps two long keys distinct where a VARCHAR(191) would have truncated them', async () => {
    const prefix = 'timelineCheck:' + 'q'.repeat(400);
    await memory.set('acct_a_000000000000001', `${prefix}A`, 'yes');
    await memory.set('acct_a_000000000000001', `${prefix}B`, 'no');

    const all = await memory.getAll('acct_a_000000000000001');
    expect(all[`${prefix}A`]).toBe('yes');
    expect(all[`${prefix}B`]).toBe('no');
  });
});
