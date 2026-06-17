import * as palm from '../services/palmService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withAuthPhone } from '../utils/authForm.js';
import { AppError } from '../errors/AppError.js';

export const getSavedPalm = asyncHandler(async (req, res) => {
  const result = await palm.getSavedPalm(withAuthPhone(req, req.query));
  if (!result) throw AppError.notFound('No saved palm reading found');
  res.json(result);
});

export const getPalmHistory = asyncHandler(async (req, res) => {
  const readings = await palm.getPalmHistory(withAuthPhone(req, req.query));
  res.json({ readings });
});

export const getPalmById = asyncHandler(async (req, res) => {
  // The reading is scoped to the caller's own user row (id + userId), so one
  // user can never fetch another's reading by id.
  const result = await palm.getPalmById(req.params.id, withAuthPhone(req, req.query));
  if (!result) throw AppError.notFound('Reading not found');
  res.json(result);
});

export const analyzePalm = asyncHandler(async (req, res) => {
  // Service returns { content, balance }. Identity forced from the token.
  res.json(await palm.analyzePalm({ ...req.body, form: withAuthPhone(req, req.body.form) }));
});

export const comparePalms = asyncHandler(async (req, res) => {
  // Service returns { content, balance }. Identity forced from the token.
  res.json(await palm.comparePalms({ ...req.body, form: withAuthPhone(req, req.body.form) }));
});
