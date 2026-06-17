import * as daily from '../services/dailyService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withAuthPhone } from '../utils/authForm.js';
import { AppError } from '../errors/AppError.js';

export const getSavedDaily = asyncHandler(async (req, res) => {
  const content = await daily.getSavedDaily(withAuthPhone(req, req.query), req.query.targetDate);
  if (!content) throw AppError.notFound('No saved guidance found');
  res.json({ content });
});

export const getDailyDates = asyncHandler(async (req, res) => {
  const dates = await daily.getDailyDates(withAuthPhone(req, req.query));
  res.json({ dates });
});

export const getDailyGuidance = asyncHandler(async (req, res) => {
  // Service returns { content, balance }. Identity forced from the token.
  res.json(await daily.generateDailyGuidance({ ...req.body, form: withAuthPhone(req, req.body.form) }));
});
