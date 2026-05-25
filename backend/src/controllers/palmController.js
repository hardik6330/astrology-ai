import * as palm from '../services/palmService.js';
import { httpError } from '../middleware/errorHandler.js';

export async function getSavedPalm(req, res, next) {
  try {
    const result = await palm.getSavedPalm(req.query);
    if (!result) throw httpError(404, 'No saved palm reading found', 'NOT_FOUND');
    res.json(result);
  } catch (err) { next(err); }
}

export async function getPalmHistory(req, res, next) {
  try {
    const readings = await palm.getPalmHistory(req.query);
    res.json({ readings });
  } catch (err) { next(err); }
}

export async function getPalmById(req, res, next) {
  try {
    const result = await palm.getPalmById(req.params.id, req.query);
    if (!result) throw httpError(404, 'Reading not found', 'NOT_FOUND');
    res.json(result);
  } catch (err) { next(err); }
}

export async function analyzePalm(req, res, next) {
  try {
    const content = await palm.analyzePalm(req.body);
    res.json({ content });
  } catch (err) { next(err); }
}
