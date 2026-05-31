import * as palm from '../services/palmService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';

export const getSavedPalm = asyncHandler(async (req, res) => {
  const result = await palm.getSavedPalm(req.query);
  if (!result) throw AppError.notFound('No saved palm reading found');
  res.json(result);
});

export const getPalmHistory = asyncHandler(async (req, res) => {
  const readings = await palm.getPalmHistory(req.query);
  res.json({ readings });
});

export const getPalmById = asyncHandler(async (req, res) => {
  const result = await palm.getPalmById(req.params.id, req.query);
  if (!result) throw AppError.notFound('Reading not found');
  res.json(result);
});

export const analyzePalm = asyncHandler(async (req, res) => {
  const content = await palm.analyzePalm(req.body);
  res.json({ content });
});

export const comparePalms = asyncHandler(async (req, res) => {
  const content = await palm.comparePalms(req.body);
  res.json({ content });
});
