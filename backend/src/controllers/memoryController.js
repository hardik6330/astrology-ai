import * as memory from '../services/memoryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Identity is always req.auth.accountId (set by requireAuth) — never a
// client-supplied id — so one account can't read or write another's memory.
export const getMemory = asyncHandler(async (req, res) => {
  res.locals.message = 'Memory fetched';
  res.json({ memory: await memory.getAll(req.auth.accountId) });
});

export const setMemory = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  res.json(await memory.set(req.auth.accountId, key, value));
});
