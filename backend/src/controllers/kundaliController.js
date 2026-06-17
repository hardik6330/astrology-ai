import * as kundali from '../services/kundaliService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withAuthPhone } from '../utils/authForm.js';
import { AppError } from '../errors/AppError.js';

export const getSavedInterpretation = asyncHandler(async (req, res) => {
  const content = await kundali.getSavedInterpretation(withAuthPhone(req, req.query));
  if (!content) throw AppError.notFound('No saved reading found');
  res.json({ content });
});

export const interpretChart = asyncHandler(async (req, res) => {
  // Service returns { content, balance } — balance lets the client refresh the
  // credit badge after the charge. Identity is forced from the token, not the
  // client form, so credits are only ever spent on the caller's own account.
  res.json(await kundali.generateInterpretation({ ...req.body, form: withAuthPhone(req, req.body.form) }));
});
