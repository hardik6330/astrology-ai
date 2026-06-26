// LAYER 1 — ASTRONOMY. Low-level position math: real ephemeris positions
// (astronomy-engine), tropical→sidereal conversion (Lahiri ayanamsha), and the
// small placement helpers (signOf, navamsaSign, dignityOf). Imported by
// engines.js and astrology.js. Part of @astrology-ai/core.
import * as Astronomy from "astronomy-engine";
import { D2R, R2D, YEAR_MS, SIGNS, ZE, NAKSHATRAS, PLANET_DOMAIN, SIGN_QUALITY, HOUSE_AREA, HOUSE_THEME, ASPECT_QUALITY, SIGN_LORD, DIGNITY, DASHA_LEN, DASHA_ORDER } from "./constants.js";
import { nm } from "./format.js";

export function dignityOf(base, sign) {
  const dg = DIGNITY[base];
  if (!dg) return "";
  if (dg.exalt === sign) return "exalted — very strong, expressed at its best";
  if (dg.debil === sign) return "debilitated — weakened, needs conscious effort";
  if (dg.own.includes(sign)) return "in own sign — comfortable and well-supported";
  return "";
}

export function navamsaSign(lon) {
  const totalMin = nm(lon) * 60;
  const navIdx = Math.floor(totalMin / 200); // 3°20' = 200 min
  const startSigns = [0, 8, 4, 0, 8, 4, 0, 8, 4, 0, 8, 4]; // Aries, Sagittarius, Leo repeating
  const rIdx = Math.floor(nm(lon) / 30);
  return SIGNS[(startSigns[rIdx] + navIdx) % 12];
}


export function buildDate(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  let hh = 12,
    mm = 0;
  if (timeStr) {
    const t = timeStr.split(":");
    hh = +t[0];
    mm = +t[1];
  }
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - tz * 3600 * 1000);
}

// Mean obliquity of the ecliptic (degrees), d = days from J2000
export function obliquity(d) {
  const T = d / 36525;
  return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T;
}

// Lahiri ayanamsha (degrees) — tropical→sidereal offset
export function ayanamsha(d) {
  return 23.8526 + (d / 365.25) * 0.013969;
}

export function signOf(lon) {
  return SIGNS[Math.floor(nm(lon) / 30)];
}

// Geocentric apparent ecliptic-of-date longitude of a body (tropical)
export function bodyLon(body, time) {
  const vec = Astronomy.GeoVector(body, time, true);
  const rot = Astronomy.Rotation_EQJ_ECT(time);
  const sph = Astronomy.SphereFromVector(Astronomy.RotateVector(rot, vec));
  return nm(sph.lon);
}

