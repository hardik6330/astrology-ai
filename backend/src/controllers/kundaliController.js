import * as kundali from '../services/kundaliService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

export const getSavedInterpretation = asyncHandler(async (req, res) => {
  const content = await kundali.getSavedInterpretation(req.query);
  if (!content) throw AppError.notFound('No saved reading found');
  res.json({ content });
});

export const interpretChart = asyncHandler(async (req, res) => {
  const content = await kundali.generateInterpretation(req.body);
  res.json({ content });
});
