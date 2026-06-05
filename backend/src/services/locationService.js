import { Op } from 'sequelize';
import tzLookup from 'tz-lookup';
import { Location } from '../models/index.js';
import { httpError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'location' });

// === OpenStreetMap Nominatim ===================================================
// Free geocoding, no API key, no billing. Usage policy requires:
//  - 1 req/sec maximum (we hit it once per debounced keystroke — well within)
//  - a meaningful User-Agent identifying the app
// Search results already include lat/lon + display_name, so we don't need a
// separate "details" call like with Google Places.
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AstrologyAI/1.0 (location lookup for birth-chart app)';

async function nominatimSearch(query, limit = 8) {
  const qs = new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
    addressdetails: '1',
    'accept-language': 'en',
  });
  const res = await fetch(`${NOMINATIM_SEARCH}?${qs}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw httpError(502, `Nominatim ${res.status}`);
  return res.json();
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

// Best-effort short label like "City, State" from Nominatim's address blob.
function shortName(item) {
  const a = item.address || {};
  const city  = a.city || a.town || a.village || a.municipality || a.county || a.name || '';
  const state = a.state || a.region || '';
  const country = a.country || '';
  const parts = [city, state, country].filter(Boolean);
  return parts.join(', ') || item.display_name;
}

// Collapse predictions that point at the same place. One city resolves to
// several rows the user shouldn't see twice: multiple OSM place_ids (a city node
// + an admin boundary), and a seeded row whose label omits the country
// ("Surat, Gujarat") next to Nominatim's fuller "Surat, Gujarat, India". Names
// alone don't catch that, so we key on COORDINATES — the ground truth for "same
// place" — rounded to ~0.1° (≈11 km), with the city label to avoid merging two
// distinct nearby towns. Falls back to the normalized description when a row has
// no coordinates. Keeps the FIRST occurrence (cache entries passed first → the
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
// 2. Otherwise hit Nominatim, persist EACH result (with computed lat/lng/tz)
//    so a subsequent /details lookup is instant.
export async function searchCities(query, _sessionToken /* kept for API compat */) {
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

  // Cache too thin — ask Nominatim. Best-effort; if it fails (network,
  // rate-limit, 5xx) we still return whatever the cache had.
  let nominatimPredictions = [];
  try {
    const items = await nominatimSearch(q, 8);
    nominatimPredictions = await Promise.all(items.map(async (item) => {
      const placeId = `osm:${item.place_id}`;
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const searchName = shortName(item);

      // Persist on first sighting so /details is a free cache hit later.
      // tz-lookup is offline + sync; couples lat/lng → IANA tz id.
      let tzId = null;
      let tzOffset = 0;
      try {
        tzId = tzLookup(lat, lng);
        tzOffset = offsetForTz(tzId);
      } catch (err) {
        log.warn({ err: err.message, lat, lng }, 'tz-lookup failed');
      }

      await Location.findOrCreate({
        where: { placeId },
        defaults: {
          placeId, searchName, lat, lng, tzOffset, tzId, source: 'nominatim',
        },
      });

      const [main, ...rest] = searchName.split(',');
      return {
        placeId,
        description: searchName,
        mainText: main.trim(),
        secondaryText: rest.join(',').trim(),
        lat,
        lng,
        source: 'nominatim',
      };
    }));
  } catch (err) {
    log.warn({ err: err.message }, 'Nominatim search failed — returning cache only');
  }

  const seen = new Set(cachePredictions.map((p) => p.placeId));
  for (const n of nominatimPredictions) {
    if (!seen.has(n.placeId)) cachePredictions.push(n);
  }
  // Final pass: drop same-named duplicates across cache + live (different
  // placeId, same city) so each place shows once.
  return dedupePredictions(cachePredictions);
}

// Phase B + C — resolve placeId to {coordinates, timezone, ...}.
// With Nominatim, /search already persisted the full record into the cache,
// so this is just a DB read. `birthTimestamp` is accepted for API parity but
// not used (the cached offset is "current"; for historical DST accuracy
// in the user's birth year we'd need a different tz library — punt).
export async function getCityDetails(placeId /*, _sessionToken, _birthTimestamp */) {
  if (!placeId) throw httpError(400, 'placeId required');

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
  throw httpError(404, 'Unknown placeId — re-run search first');
}

/* ============================================================================
 * Google Places fallback — COMMENTED OUT. Re-enable by:
 *   1. Set GOOGLE_MAPS_API_KEY in .env (envConfig already accepts optional).
 *   2. Uncomment the code below and rename functions if you want them.
 *   3. Enable Places API + Time Zone API on the key in GCP Console.
 *
 * import { env } from '../config/envConfig.js';
 * const PLACES_AUTOCOMPLETE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
 * const PLACE_DETAILS       = 'https://maps.googleapis.com/maps/api/place/details/json';
 * const TIMEZONE_API        = 'https://maps.googleapis.com/maps/api/timezone/json';
 *
 * async function googleJson(url, params) {
 *   const qs = new URLSearchParams({ ...params, key: env.GOOGLE_MAPS_API_KEY });
 *   const res = await fetch(`${url}?${qs}`);
 *   if (!res.ok) throw httpError(502, `Google API ${res.status}`);
 *   const body = await res.json();
 *   if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
 *     throw httpError(502, `Google API: ${body.status}`);
 *   }
 *   return body;
 * }
 *
 * // Autocomplete via Google Places + sessiontoken trick (free if same token
 * // is passed to subsequent /details).
 * export async function googleSearchCities(query, sessionToken) {
 *   const body = await googleJson(PLACES_AUTOCOMPLETE, {
 *     input: query.trim(),
 *     types: '(cities)',
 *     ...(sessionToken && { sessiontoken: sessionToken }),
 *   });
 *   return (body.predictions || []).map((p) => ({
 *     placeId: p.place_id,
 *     description: p.description,
 *     mainText: p.structured_formatting?.main_text || '',
 *     secondaryText: p.structured_formatting?.secondary_text || '',
 *   }));
 * }
 *
 * // Place Details for lat/lng, then Time Zone API for DST-aware offset at
 * // the user's birth timestamp.
 * export async function googleGetCityDetails(placeId, sessionToken, birthTimestamp) {
 *   const details = await googleJson(PLACE_DETAILS, {
 *     place_id: placeId,
 *     fields: 'geometry/location,formatted_address,name',
 *     ...(sessionToken && { sessiontoken: sessionToken }),
 *   });
 *   const { lat, lng } = details.result.geometry.location;
 *   const tsSec = Number.isFinite(birthTimestamp)
 *     ? Math.floor(birthTimestamp)
 *     : Math.floor(Date.now() / 1000);
 *   const tz = await googleJson(TIMEZONE_API, {
 *     location: `${lat},${lng}`,
 *     timestamp: String(tsSec),
 *   });
 *   return {
 *     searchName: details.result.formatted_address,
 *     coordinates: { lat, lng },
 *     timezone: {
 *       offset: ((tz.rawOffset || 0) + (tz.dstOffset || 0)) / 3600,
 *       id: tz.timeZoneId || null,
 *     },
 *     placeId,
 *     source: 'google_api',
 *   };
 * }
 * ========================================================================== */
