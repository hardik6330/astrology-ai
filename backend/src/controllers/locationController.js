import * as loc from '../services/locationService.js';

export async function search(req, res, next) {
  try {
    const { q, token } = req.query;
    const results = await loc.searchCities(q, token);
    res.json({ results });
  } catch (err) { next(err); }
}

export async function details(req, res, next) {
  try {
    const { placeId, token, ts } = req.query;
    const timestamp = ts ? Number(ts) : undefined;
    const data = await loc.getCityDetails(placeId, token, timestamp);
    res.json(data);
  } catch (err) { next(err); }
}
