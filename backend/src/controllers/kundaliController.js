import * as kundali from '../services/kundaliService.js';
import { httpError } from '../middleware/errorHandler.js';

export async function getSavedInterpretation(req, res, next) {
  try {
    const content = await kundali.getSavedInterpretation(req.query);
    if (!content) throw httpError(404, 'No saved reading found', 'NOT_FOUND');
    res.json({ content });
  } catch (err) { next(err); }
}

export async function interpretChart(req, res, next) {
  try {
    const content = await kundali.generateInterpretation(req.body);
    res.json({ content });
  } catch (err) { next(err); }
}
