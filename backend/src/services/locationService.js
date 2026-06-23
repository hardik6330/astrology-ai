import { Op } from 'sequelize';
import tzLookup from 'tz-lookup';
import { Location } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/envConfig.js';

const log = logger.child({ mod: 'location' });

// === Google Maps Platform ======================================================
// Requires GOOGLE_MAPS_API_KEY with the Places API + Geocoding API enabled.
// Timezone is still resolved OFFLINE via tz-lookup (coords -> IANA id) + Intl, so
// we don't need the (extra-billed) Time Zone API. Autocomplete only yields a
// placeId + description; lat/lng come from a follow-up Place Details call, so
// /details resolves coords and persists the row for instant cache hits later.
const PLACES_AUTOCOMPLETE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json';
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

async function googleJson(url, params) {
  if (!env.GOOGLE_MAPS_API_KEY) throw AppError.http(503, 'GOOGLE_MAPS_API_KEY not configured');
  const qs = new URLSearchParams({ ...params, key: env.GOOGLE_MAPS_API_KEY });
  const res = await fetch(`${url}?${qs}`);
  if (!res.ok) throw AppError.http(502, `Google Maps ${res.status}`);
  const body = await res.json();
  // ZERO_RESULTS is a valid "found nothing"; anything else is a real failure.
  if (body.status && body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
    throw AppError.http(502, `Google Maps: ${body.status}${body.error_message ? ` — ${body.error_message}` : ''}`);
  }
  return body;
}

// Compute hours-offset-from-UTC at a given instant for an IANA tz id, using
// the native Intl API (no extra dependency). Handles DST and half/quarter-hour
// zones (IST +5.5, Nepal +5.75, etc.) because Intl reports "GMT+5:30" style.
function offsetForTz(tzId, when = new Date()) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tzId,
      timeZoneName: 'shortOffset',
    });
    const offsetStr = dtf.formatToParts(when)
      .find((p) => p.type === 'timeZoneName')?.value || 'GMT+0';
    // e.g. "GMT+5:30", "GMT-5", "GMT"
    const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetStr);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    const hours = Number(m[2]);
    const mins  = Number(m[3] || 0);
    return sign * (hours + mins / 60);
  } catch (err) {
    log.warn({ err: err.message, tzId }, 'offset computation failed');
    return 0;
  }
}

// tz id + current offset for a coordinate, via the offline tz-lookup table.
function tzForCoords(lat, lng) {
  try {
    const tzId = tzLookup(lat, lng);
    return { tzId, tzOffset: offsetForTz(tzId) };
  } catch (err) {
    log.warn({ err: err.message, lat, lng }, 'tz-lookup failed');
    return { tzId: null, tzOffset: 0 };
  }
}

// Best-effort short label like "City, State, Country" from a Google geocode
// result's address_components.
function shortNameFromComponents(components = []) {
  const pick = (type) => components.find((c) => c.types?.includes(type))?.long_name || '';
  const city = pick('locality') || pick('postal_town')
    || pick('administrative_area_level_2') || pick('sublocality');
  const state = pick('administrative_area_level_1');
  const country = pick('country');
  return [city, state, country].filter(Boolean).join(', ');
}

// Collapse predictions that point at the same place. One city resolves to
// several rows the user shouldn't see twice: a seeded row whose label omits the
// country ("Surat, Gujarat") next to Google's fuller "Surat, Gujarat, India".
// We key on COORDINATES when present (ground truth for "same place") rounded to
// ~0.1° (≈11 km) plus the city label, else fall back to the normalized
// description. Keeps the FIRST occurrence (cache entries passed first → the
// already-persisted row wins, so its placeId resolves instantly in /details).
function dedupePredictions(predictions) {
  const seen = new Set();
  const out = [];
  for (const p of predictions) {
    const hasCoords = Number.isFinite(p.lat) && Number.isFinite(p.lng);
    const key = hasCoords
      ? `${(p.mainText || '').trim().toLowerCase()}@${p.lat.toFixed(1)},${p.lng.toFixed(1)}`
      : (p.description || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// Phase A — Autocomplete with DB-first lookup.
// 1. Local Location cache (seeded + previously resolved). 3+ hits → return,
//    no network call.
// 2. Otherwise hit Google Places Autocomplete. Predictions carry only a
//    placeId + description (no coords) — those are resolved & persisted on the
//    follow-up /details call.
export async function searchCities(query, sessionToken) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const cacheHits = await Location.findAll({
    where: { searchName: { [Op.like]: `%${q}%` } },
    order: [['updatedAt', 'DESC']],
    limit: 8,
  });
  const cachePredictions = cacheHits.map((r) => {
    const [main, ...rest] = r.searchName.split(',');
    return {
      placeId: r.placeId,
      description: r.searchName,
      mainText: main.trim(),
      secondaryText: rest.join(',').trim(),
      lat: r.lat,
      lng: r.lng,
      source: r.source,
    };
  });

  if (cachePredictions.length >= 3) return dedupePredictions(cachePredictions);

  // Cache too thin — ask Google. Best-effort; if it fails (network, quota,
  // missing key) we still return whatever the cache had.
  let livePredictions = [];
  try {
    const body = await googleJson(PLACES_AUTOCOMPLETE, {
      input: q,
      types: '(cities)',
      ...(sessionToken && { sessiontoken: sessionToken }),
    });
    livePredictions = (body.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
      source: 'google',
    }));
  } catch (err) {
    log.warn({ err: err.message }, 'Google autocomplete failed — returning cache only');
  }

  const seen = new Set(cachePredictions.map((p) => p.placeId));
  for (const n of livePredictions) {
    if (!seen.has(n.placeId)) cachePredictions.push(n);
  }
  // Final pass: drop same-named duplicates across cache + live (different
  // placeId, same city) so each place shows once.
  return dedupePredictions(cachePredictions);
}

// Phase B — Reverse geocoding (Lat/Lon -> City Name + Timezone).
// Used by the web/mobile app's "Live Location" feature to get a clean
// display name and a coordinates-derived timezone (more accurate than
// the device's system clock).
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) throw AppError.http(400, 'lat and lon required');

  const l = Number(lat);
  const r = Number(lon);

  // 1. Resolve timezone first (offline/fast).
  const { tzId, tzOffset } = tzForCoords(l, r);

  // 2. Resolve city name via Google reverse geocoding (best-effort).
  let name = 'Current Location';
  try {
    const body = await googleJson(GEOCODE, {
      latlng: `${l},${r}`,
      result_type: 'locality|administrative_area_level_1|country',
    });
    const result = body.results?.[0];
    if (result) {
      name = shortNameFromComponents(result.address_components) || result.formatted_address || name;
    }
  } catch (err) {
    log.warn({ err: err.message, lat, lon }, 'Google reverse geocode failed');
  }

  return {
    name,
    lat: l,
    lon: r,
    timezone: { id: tzId, offset: tzOffset },
  };
}

// Phase C — resolve placeId to {coordinates, timezone, ...}.
// Cache-first: a row persisted by a prior /details (or a seed) is an instant DB
// read. On a miss we call Google Place Details for the coords, derive the tz
// offline, persist, and return. `birthTimestamp` is accepted for API parity but
// not used (the cached offset is "current"; for historical DST accuracy in the
// user's birth year we'd need the Time Zone API — punt, as before).
export async function getCityDetails(placeId, sessionToken /*, _birthTimestamp */) {
  if (!placeId) throw AppError.http(400, 'placeId required');

  const cached = await Location.findOne({ where: { placeId } });
  if (cached) {
    return {
      searchName: cached.searchName,
      coordinates: { lat: cached.lat, lng: cached.lng },
      timezone: { offset: cached.tzOffset, id: cached.tzId },
      source: 'cache',
      placeId: cached.placeId,
    };
  }

  // Cache miss — resolve via Google Place Details, then persist.
  const body = await googleJson(PLACE_DETAILS, {
    place_id: placeId,
    fields: 'geometry/location,formatted_address,name',
    ...(sessionToken && { sessiontoken: sessionToken }),
  });
  const loc = body.result?.geometry?.location;
  if (!loc) throw AppError.http(404, 'Unknown placeId — re-run search first');

  const lat = loc.lat;
  const lng = loc.lng;
  const searchName = body.result.formatted_address || body.result.name || '';
  const { tzId, tzOffset } = tzForCoords(lat, lng);

  await Location.findOrCreate({
    where: { placeId },
    defaults: { placeId, searchName, lat, lng, tzOffset, tzId, source: 'google' },
  });

  return {
    searchName,
    coordinates: { lat, lng },
    timezone: { offset: tzOffset, id: tzId },
    source: 'google',
    placeId,
  };
}
