import * as loc from '../services/locationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const search = asyncHandler(async (req, res) => {
  const { q, token } = req.query;
  const results = await loc.searchCities(q, token);
  res.json({ results });
});

export const details = asyncHandler(async (req, res) => {
  const { placeId, token, ts } = req.query;
  const timestamp = ts ? Number(ts) : undefined;
  const data = await loc.getCityDetails(placeId, token, timestamp);
  res.json(data);
});

export const reverse = asyncHandler(async (req, res) => {
  const { lat, lon } = req.query;
  const data = await loc.reverseGeocode(lat, lon);
  res.json(data);
});
