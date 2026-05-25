import * as daily from '../services/dailyService.js';
import { httpError } from '../middleware/errorHandler.js';

export async function getSavedDaily(req, res, next) {
  try {
    const content = await daily.getSavedDaily(req.query, req.query.targetDate);
    if (!content) throw httpError(404, 'No saved guidance found', 'NOT_FOUND');
    res.json({ content });
  } catch (err) { next(err); }
}

export async function getDailyDates(req, res, next) {
  try {
    const dates = await daily.getDailyDates(req.query);
    res.json({ dates });
  } catch (err) { next(err); }
}

export async function getDailyGuidance(req, res, next) {
  try {
    const content = await daily.generateDailyGuidance(req.body);
    res.json({ content });
  } catch (err) { next(err); }
}
