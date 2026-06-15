/* ====================================================================
   LAYER 1 — ASTRONOMY  (real positions, both tropical & sidereal)
   The math layer. astronomy-engine = browser-grade ephemeris.
   ==================================================================== */
import * as Astronomy from "astronomy-engine";

const D2R = Math.PI / 180,
  R2D = 180 / Math.PI,
  YEAR_MS = 31557600000;

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
export const ZE = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};
const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

/* ── DETERMINISTIC RULE TABLES — fixed astrological meanings ── */
const PLANET_DOMAIN = {
  Sun: "core self, ego, vitality, father",
  Moon: "mind, emotions, mother, instincts",
  Mercury: "intellect, communication, learning",
  Venus: "love, beauty, relationships, comfort",
  Mars: "energy, drive, courage, conflict",
  Jupiter: "wisdom, growth, fortune, beliefs",
  Saturn: "discipline, limits, responsibility, karma",
  Uranus: "change, rebellion, sudden insight",
  Neptune: "dreams, spirituality, illusion",
  Pluto: "transformation, power, depth",
  Rahu: "ambition, obsession, worldly desire",
  Ketu: "detachment, spirituality, past karma",
};

const SIGN_QUALITY = {
  Aries: "bold, pioneering, impulsive, action-driven",
  Taurus: "steady, sensual, patient, security-seeking",
  Gemini: "curious, communicative, versatile, restless",
  Cancer: "nurturing, emotional, protective, home-oriented",
  Leo: "confident, expressive, proud, leadership-driven",
  Virgo: "analytical, precise, service-minded, self-critical",
  Libra: "harmonious, relational, fair-minded, indecisive",
  Scorpio: "intense, secretive, transformative, strong-willed",
  Sagittarius: "expansive, philosophical, freedom-loving, optimistic",
  Capricorn: "disciplined, ambitious, pragmatic, reserved",
  Aquarius: "innovative, humanitarian, independent, unconventional",
  Pisces: "compassionate, imaginative, intuitive, escapist",
};

const HOUSE_AREA = {
  1: "self, body, personality, life direction",
  2: "wealth, family, speech, values",
  3: "courage, siblings, communication, effort",
  4: "home, mother, roots, inner peace",
  5: "creativity, children, romance, intelligence",
  6: "health, daily work, service, obstacles",
  7: "marriage, partnerships, business",
  8: "transformation, secrets, longevity, sudden change",
  9: "fortune, dharma, higher learning, father, beliefs",
  10: "career, status, public life, achievement",
  11: "gains, networks, aspirations, friends",
  12: "loss, expenses, spirituality, foreign lands, solitude",
};

// readable theme phrases per house — for synthesised timeline summaries
const HOUSE_THEME = {
  1: "a renewed self-image and personal direction",
  2: "family wealth, savings and what you value",
  3: "bold initiative, skill-building and communication",
  4: "home, property and emotional roots",
  5: "creativity, romance, learning and self-expression",
  6: "work, service, health and overcoming obstacles",
  7: "partnership, marriage and one-to-one dealings",
  8: "deep change, shared resources and hidden matters",
  9: "higher learning, travel, fortune and belief",
  10: "career, status and public visibility",
  11: "gains, goals, networks and friendships",
  12: "foreign lands, spirituality, retreat and letting go",
};

const ASPECT_QUALITY = {
  Conjunction: "intensely fuses the energies of",
  Sextile: "creates supportive opportunity between",
  Square: "creates productive tension between",
  Trine: "lets energy flow harmoniously between",
  Opposition: "creates a balancing polarity between",
};

const SIGN_LORD = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

const DIGNITY = {
  Sun: { own: ["Leo"], exalt: "Aries", debil: "Libra" },
  Moon: { own: ["Cancer"], exalt: "Taurus", debil: "Scorpio" },
  Mercury: { own: ["Gemini", "Virgo"], exalt: "Virgo", debil: "Pisces" },
  Venus: { own: ["Taurus", "Libra"], exalt: "Pisces", debil: "Virgo" },
  Mars: { own: ["Aries", "Scorpio"], exalt: "Capricorn", debil: "Cancer" },
  Jupiter: { own: ["Sagittarius", "Pisces"], exalt: "Cancer", debil: "Capricorn" },
  Saturn: { own: ["Capricorn", "Aquarius"], exalt: "Libra", debil: "Aries" },
};

function dignityOf(base, sign) {
  const dg = DIGNITY[base];
  if (!dg) return "";
  if (dg.exalt === sign) return "exalted — very strong, expressed at its best";
  if (dg.debil === sign) return "debilitated — weakened, needs conscious effort";
  if (dg.own.includes(sign)) return "in own sign — comfortable and well-supported";
  return "";
}

function navamsaSign(lon) {
  const totalMin = nm(lon) * 60;
  const navIdx = Math.floor(totalMin / 200); // 3°20' = 200 min
  const startSigns = [0, 8, 4, 0, 8, 4, 0, 8, 4, 0, 8, 4]; // Aries, Sagittarius, Leo repeating
  const rIdx = Math.floor(nm(lon) / 30);
  return SIGNS[(startSigns[rIdx] + navIdx) % 12];
}

const DASHA_LEN = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};
const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];

function computeDasha(moonLon, birthDate) {
  const nakIdx = Math.floor(moonLon / (13 + 1 / 3));
  const rem = nm(moonLon) % (13 + 1 / 3);
  const startLord = DASHA_ORDER[(nakIdx + 0) % 9]; // starts from Ashwini(Ketu)
  const elapsed = rem / (13 + 1 / 3);
  const totalYrs = DASHA_LEN[startLord];
  const remYrs = totalYrs * (1 - elapsed);
  let curDate = new Date(birthDate.getTime() - (totalYrs - remYrs) * YEAR_MS);
  const periods = [];
  let startIdx = DASHA_ORDER.indexOf(startLord);
  for (let i = 0; i < 18; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const yrs = DASHA_LEN[lord];
    const end = new Date(curDate.getTime() + yrs * YEAR_MS);
    const m = { lord, start: new Date(curDate), end: new Date(end) };
    // add antardashas (sub-periods)
    m.sub = [];
    let subStart = new Date(curDate);
    for (let j = 0; j < 9; j++) {
      const sLord = DASHA_ORDER[(DASHA_ORDER.indexOf(lord) + j) % 9];
      const sYrs = yrs * (DASHA_LEN[sLord] / 120);
      const sEnd = new Date(subStart.getTime() + sYrs * YEAR_MS);
      m.sub.push({ lord: sLord, start: new Date(subStart), end: new Date(sEnd) });
      subStart = new Date(sEnd);
    }
    periods.push(m);
    curDate = new Date(end);
  }
  return periods;
}

export function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDay(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ── SCORE ENGINE — weighted deterministic model for life-areas ── */
function computeScores(ch) {
  const P = {};
  ch.planets.forEach((p) => {
    P[p.base] = p;
  });
  const benefics = ["Jupiter", "Venus", "Moon", "Mercury"];
  const pstr = (p) =>
    p
      ? (p.angular ? 75 : 55) +
        (p.dignity.startsWith("exalt")
          ? 20
          : p.dignity.startsWith("in own")
            ? 10
            : p.dignity.startsWith("debil")
              ? -15
              : 0)
      : 50;
  const lordOf = (h) => {
    const ascSign = Math.floor(nm(ch.angles.ascSid) / 30);
    return SIGN_LORD[SIGNS[(ascSign + h - 1) % 12]];
  };
  const occ = (h) => ch.planets.filter((p) => p.houseSid === h);

  const area = (houses, karakas, helpful) => {
    let s = 50,
      f = [];
    houses.forEach((h) => {
      occ(h).forEach((p) => {
        if (["Rahu", "Ketu"].includes(p.base) && !helpful.includes(p.base)) {
          s -= 4;
          f.push(`${p.base} in H${h} (-4)`);
          return;
        }
        let v = 0;
        if (p.dignity.startsWith("exalt")) v += 15;
        else if (p.dignity.startsWith("in own")) v += 10;
        else if (p.dignity.startsWith("debil")) v -= 13;
        v += benefics.includes(p.base) || helpful.includes(p.base) ? 8 : -2;
        s += v;
        f.push(`${p.base} in H${h} (${v >= 0 ? "+" : ""}${v})`);
      });
      const lord = lordOf(h),
        lp = P[lord];
      if (lp) {
        const v = Math.round((pstr(lp) - 50) * 0.4);
        s += v;
        f.push(`H${h} lord ${lord}→H${lp.houseSid} (${v >= 0 ? "+" : ""}${v})`);
      }
    });
    karakas.forEach((k) => {
      const kp = P[k];
      if (kp) {
        const v = Math.round((pstr(kp) - 50) * 0.5);
        s += v;
        f.push(`karaka ${k} (${v >= 0 ? "+" : ""}${v})`);
      }
    });
    return { score: Math.max(5, Math.min(98, Math.round(s))), factors: f };
  };

  const career = area([10], ["Sun", "Saturn"], ["Saturn", "Sun", "Mars"]);
  if (ch.yogas.some((y) => y.includes("Mahapurusha"))) {
    career.score = Math.min(98, career.score + 7);
    career.factors.push("Mahapurusha Yoga (+7)");
  }

  const marriage = area([7], ["Venus"], []);
  const mars = P.Mars;
  if (mars && [1, 2, 4, 7, 8, 12].includes(mars.houseSid)) {
    marriage.score = Math.max(5, marriage.score - 12);
    marriage.factors.push(`Mangal Dosha — Mars in H${mars.houseSid} (-12)`);
  }

  const wealth = area([2, 11], ["Jupiter"], []);
  if (ch.yogas.some((y) => y.includes("Gajakesari"))) {
    wealth.score = Math.min(98, wealth.score + 6);
    wealth.factors.push("Gajakesari Yoga (+6)");
  }

  const health = area([1], ["Sun"], []);
  const foreign = area([12, 9, 3], ["Rahu"], ["Rahu"]);
  const education = area([4, 5], ["Mercury", "Jupiter"], []);

  return [
    { key: "Career & Status", ...career },
    { key: "Marriage & Relationship", ...marriage },
    { key: "Wealth & Finance", ...wealth },
    { key: "Health & Vitality", ...health },
    { key: "Foreign & Travel", ...foreign },
    { key: "Education & Intellect", ...education },
  ];
}

/* ── HOUSE LORDS ENGINE — lord placements & dispositor chains ── */
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function computeHouseLords(ch) {
  const ascSign = Math.floor(nm(ch.angles.ascSid) / 30);
  const find = (b) => ch.planets.find((p) => p.base === b);
  const lords = [];
  for (let h = 1; h <= 12; h++) {
    const sign = SIGNS[(ascSign + h - 1) % 12];
    const lord = SIGN_LORD[sign];
    const lp = find(lord);
    lords.push({
      house: h,
      sign,
      lord,
      inHouse: lp ? lp.houseSid : null,
      inSign: lp ? signOf(lp.sid) : null,
    });
  }
  // dispositor of each planet = lord of the sign it occupies
  ch.planets.forEach((p) => {
    p.dispositor = SIGN_LORD[signOf(p.sid)];
  });
  // dispositor chain for each graha until it loops (own sign = self-dispositor root)
  const find2 = (b) => ch.planets.find((p) => p.base === b);
  ch.planets
    .filter((p) => SIGN_LORD[signOf(p.sid)])
    .forEach((p) => {
      const chain = [p.base];
      let cur = p,
        guard = 0;
      while (guard++ < 12) {
        const disp = cur.dispositor;
        if (disp === cur.base) break; // planet in own sign — root
        if (chain.includes(disp)) {
          chain.push(disp + " ↺");
          break;
        }
        chain.push(disp);
        cur = find2(disp);
        if (!cur) break;
      }
      p.dispoChain = chain;
    });
  return lords;
}

/* ── MARRIAGE ENGINE — Upapada Lagna, Darakaraka, D9 7th-lord strength ── */
function arudhaPada(houseIdx, lordSignIdx) {
  const d = (lordSignIdx - houseIdx + 12) % 12; // signs from house to its lord
  let ar = (lordSignIdx + d) % 12; // same distance again from the lord
  if (ar === houseIdx || (ar - houseIdx + 12) % 12 === 6) ar = (ar + 9) % 12; // exception → 10th from it
  return ar;
}
function computeMarriage(ch) {
  const ascSign = Math.floor(nm(ch.angles.ascSid) / 30);
  const find = (b) => ch.planets.find((p) => p.base === b);
  // Upapada Lagna = Arudha pada of the 12th house
  const h12 = (ascSign + 11) % 12;
  const l12p = find(SIGN_LORD[SIGNS[h12]]);
  const ulIdx = l12p ? arudhaPada(h12, Math.floor(nm(l12p.sid) / 30)) : h12;
  const upapada = SIGNS[ulIdx];
  // Darakaraka aspects (D1 + D9)
  const dk = ch.d9.darakaraka;
  const dkAspects = ch.aspects
    .filter((a) => a.a === dk || a.b === dk)
    .map((a) => `${a.a} ${a.type} ${a.b} (natal)`)
    .concat(ch.d9.aspects.filter((a) => a.a === dk || a.b === dk).map((a) => `${a.a} ${a.type} ${a.b} (D9)`));
  const ven = find("Venus"),
    jup = find("Jupiter");
  const d9LordP = find(ch.d9.d9SeventhLord);
  const h7 = (ascSign + 6) % 12,
    l7p = find(SIGN_LORD[SIGNS[h7]]);
  return {
    upapada,
    upapadaLord: SIGN_LORD[upapada],
    darakaraka: dk,
    dkAspects,
    venus: {
      sign: signOf(ven.sid),
      dignity: ven.dignity || "neutral",
      house: ven.houseSid,
      strength: ven.strength,
    },
    jupiter: {
      sign: signOf(jup.sid),
      dignity: jup.dignity || "neutral",
      house: jup.houseSid,
      strength: jup.strength,
    },
    d9SeventhLord: ch.d9.d9SeventhLord,
    d9SeventhLordStrength: d9LordP ? d9LordP.strength : null,
    d1SeventhLord: SIGN_LORD[SIGNS[h7]],
    d1SeventhLordHouse: l7p ? l7p.houseSid : null,
  };
}

// City -> coordinates + timezone offset (hours). India = +5.5
// Static CITIES list removed — city/lat/lon/tz now come from the dynamic
// Places Autocomplete picker, carried on the form object.
export function nm(x) {
  return ((x % 360) + 360) % 360;
}

// Build a UTC Date from local birth date/time + timezone offset
function buildDate(dateStr, timeStr, tz) {
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
function obliquity(d) {
  const T = d / 36525;
  return 23.4392911 - 0.0130041667 * T - 1.638889e-7 * T * T + 5.036111e-7 * T * T * T;
}

// Lahiri ayanamsha (degrees) — tropical→sidereal offset
function ayanamsha(d) {
  return 23.8526 + (d / 365.25) * 0.013969;
}

export function signOf(lon) {
  return SIGNS[Math.floor(nm(lon) / 30)];
}

// Geocentric apparent ecliptic-of-date longitude of a body (tropical)
function bodyLon(body, time) {
  const vec = Astronomy.GeoVector(body, time, true);
  const rot = Astronomy.Rotation_EQJ_ECT(time);
  const sph = Astronomy.SphereFromVector(Astronomy.RotateVector(rot, vec));
  return nm(sph.lon);
}

export function computeChart(dateStr, timeStr, city) {
  const date = buildDate(dateStr, timeStr, city.tz);
  const time = Astronomy.MakeTime(date);
  const d = time.ut; // days from J2000
  const ay = ayanamsha(d);
  const eps = obliquity(d) * D2R;

  const B = Astronomy.Body;
  const bodies = [
    ["Sun", B.Sun],
    ["Moon", B.Moon],
    ["Mercury", B.Mercury],
    ["Venus", B.Venus],
    ["Mars", B.Mars],
    ["Jupiter", B.Jupiter],
    ["Saturn", B.Saturn],
    ["Uranus", B.Uranus],
    ["Neptune", B.Neptune],
    ["Pluto", B.Pluto],
  ];

  const planets = bodies.map(([name, b]) => {
    const lon = bodyLon(b, time);
    // retrograde test (skip luminaries)
    let retro = false;
    if (name !== "Sun" && name !== "Moon") {
      const prev = bodyLon(b, Astronomy.MakeTime(new Date(date.getTime() - 86400000)));
      let dl = lon - prev;
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      retro = dl < 0;
    }
    return { name, trop: lon, sid: nm(lon - ay), retro };
  });

  // Lunar nodes (mean) — Rahu / Ketu, always retrograde
  const rahu = nm(125.04452 - 0.0529537951 * d);
  planets.push({ name: "Rahu (N.Node)", trop: rahu, sid: nm(rahu - ay), retro: true });
  planets.push({ name: "Ketu (S.Node)", trop: nm(rahu + 180), sid: nm(rahu + 180 - ay), retro: true });

  // Ascendant + Midheaven
  const gast = Astronomy.SiderealTime(time); // Greenwich apparent sidereal time (hours)
  const ramc = nm((gast + city.lon / 15) * 15) * D2R; // right ascension of meridian
  const latR = city.lat * D2R;
  let mc = nm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * R2D);
  let asc = nm(
    Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latR) * Math.sin(eps))) * R2D
  );
  if (nm(asc - mc) > 180) asc = nm(asc + 180);
  const angles = { ascTrop: asc, ascSid: nm(asc - ay), mcTrop: mc, mcSid: nm(mc - ay) };

  // Whole-sign houses for each planet, per system
  const ascSignS = Math.floor(angles.ascSid / 30),
    ascSignT = Math.floor(angles.ascTrop / 30);
  planets.forEach((p) => {
    p.houseSid = ((Math.floor(p.sid / 30) - ascSignS + 12) % 12) + 1;
    p.houseTrop = ((Math.floor(p.trop / 30) - ascSignT + 12) % 12) + 1;
    // ── deterministic rule lookup → base meaning for this placement ──
    p.base = p.name.split(" ")[0]; // "Rahu (N.Node)" -> "Rahu"
    const sign = signOf(p.sid);
    p.dignity = dignityOf(p.base, sign);
    p.nav = navamsaSign(p.sid); // D9 navamsa sign
    p.angular = [1, 4, 7, 10].includes(p.houseSid); // angular = stronger
    p.rule =
      `${p.name} (${PLANET_DOMAIN[p.base] || "—"}) in ${sign} ` +
      `[${SIGN_QUALITY[sign]}], House ${p.houseSid} ` +
      `[${HOUSE_AREA[p.houseSid]}]` +
      (p.dignity ? ` — ${p.dignity}` : "") +
      (p.angular ? " — ANGULAR (emphasised)" : "") +
      (p.retro ? " — retrograde (internalised energy)" : "");
  });

  // Moon nakshatra (sidereal)
  const moon = planets[1];
  const nakIdx = Math.floor(moon.sid / (13 + 1 / 3));
  const nakshatra = NAKSHATRAS[nakIdx];

  // Western aspects (angle-based; identical in both zodiacs)
  const ASPECTS = [
    ["Conjunction", 0, 8],
    ["Sextile", 60, 4],
    ["Square", 90, 6],
    ["Trine", 120, 6],
    ["Opposition", 180, 8],
  ];
  const aspBodies = planets.filter((p) => !p.name.startsWith("Rahu") && !p.name.startsWith("Ketu"));
  const aspects = [];
  for (let i = 0; i < aspBodies.length; i++)
    for (let j = i + 1; j < aspBodies.length; j++) {
      let sep = Math.abs(aspBodies[i].trop - aspBodies[j].trop) % 360;
      if (sep > 180) sep = 360 - sep;
      for (const [an, ang, orb] of ASPECTS) {
        if (Math.abs(sep - ang) <= orb) {
          const A = aspBodies[i].name,
            Bn = aspBodies[j].name,
            o = Math.abs(sep - ang);
          aspects.push({
            a: A,
            b: Bn,
            type: an,
            orb: o,
            tight: o < 2,
            rule:
              `${A} ${an} ${Bn} — ${ASPECT_QUALITY[an]} ${A} and ${Bn}` +
              (o < 2 ? " (TIGHT orb — strong influence)" : ""),
          });
          break;
        }
      }
    }

  // Stelliums (3+ planets in one sidereal sign)
  const bySign = {};
  planets.forEach((p) => {
    const s = signOf(p.sid);
    (bySign[s] = bySign[s] || []).push(p.name);
  });
  const stelliums = Object.entries(bySign)
    .filter(([, a]) => a.length >= 3)
    .map(([s, a]) => ({ sign: s, planets: a }));

  // Yogas (special combinations)
  const yogas = [];
  const P = {};
  planets.forEach((p) => {
    P[p.base] = p;
  });
  // Gaja Kesari: Jupiter in kendra from Moon
  if (P.Jupiter && P.Moon) {
    const dd = ((P.Jupiter.houseSid - P.Moon.houseSid + 12) % 12) + 1;
    if ([1, 4, 7, 10].includes(dd))
      yogas.push("Gajakesari Yoga — Jupiter in a quadrant from the Moon (wisdom, fortune)");
  }
  // Mahapurusha Yogas (planet in own/exalt sign in kendra from Asc)
  ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"].forEach((b) => {
    const p = P[b];
    if (!p) return;
    if (
      [1, 4, 7, 10].includes(p.houseSid) &&
      (p.dignity.startsWith("exalt") || p.dignity.startsWith("in own"))
    ) {
      const n = { Mars: "Ruchaka", Mercury: "Bhadra", Jupiter: "Hamsa", Venus: "Malavya", Saturn: "Sasha" }[
        b
      ];
      yogas.push(`${n} Mahapurusha Yoga — ${b} is strong in a quadrant (leadership, mastery)`);
    }
  });

  // Vimshottari Dasha
  const dasha = computeDasha(moon.sid, date);
  const now = new Date();
  const curMaha = dasha.find((m) => m.start <= now && m.end >= now) || dasha[0];
  const curAntar = curMaha.sub.find((s) => s.start <= now && s.end >= now);

  // Navamsa D9 summary
  const d9Lagna = navamsaSign(angles.ascSid);
  const d9LagnaIdx = SIGNS.indexOf(d9Lagna);
  const d9SeventhSign = SIGNS[(d9LagnaIdx + 6) % 12];
  const d9SeventhLord = SIGN_LORD[d9SeventhSign];
  const d9SeventhOcc = planets.filter((p) => p.nav === d9SeventhSign).map((p) => p.base);
  planets.forEach((p) => {
    p.d9House = ((SIGNS.indexOf(p.nav) - d9LagnaIdx + 12) % 12) + 1;
  });
  const d9asp = [];
  const d9planets = planets.slice(0, 10);
  for (let i = 0; i < d9planets.length; i++)
    for (let j = i + 1; j < d9planets.length; j++) {
      const s1 = SIGNS.indexOf(d9planets[i].nav),
        s2 = SIGNS.indexOf(d9planets[j].nav);
      let sep = Math.abs(s1 - s2);
      if (sep > 6) sep = 12 - sep;
      if (sep === 0) d9asp.push({ a: d9planets[i].base, b: d9planets[j].base, type: "Conjunction" });
      if (sep === 6) d9asp.push({ a: d9planets[i].base, b: d9planets[j].base, type: "Opposition" });
    }
  // Darakaraka = planet with lowest degree (excluding nodes)
  const dkP = planets.slice(0, 7).sort((a, b) => (a.sid % 30) - (b.sid % 30))[0];

  // Current Transits (Gochar)
  const tTime = Astronomy.MakeTime(now),
    tD = tTime.ut,
    tAy = ayanamsha(tD);
  const tSat = nm(bodyLon(B.Saturn, tTime) - tAy),
    tJup = nm(bodyLon(B.Jupiter, tTime) - tAy);
  const tRahu = nm(125.04452 - 0.0529537951 * tD - tAy);
  const hFromMoon = (s) => ((Math.floor(s / 30) - Math.floor(moon.sid / 30) + 12) % 12) + 1;
  const satH = hFromMoon(tSat),
    jupH = hFromMoon(tJup),
    rahuH = hFromMoon(tRahu);
  const sSati =
    satH === 12
      ? "first phase (heavy)"
      : satH === 1
        ? "peak phase (intense)"
        : satH === 2
          ? "final phase (setting)"
          : "";

  // Upcoming Eclipses (next ~18 months) — names differ across astronomy-engine builds
  const eclipses = [];
  try {
    const solSearch = Astronomy.SearchGlobalSolarEclipse;
    const solNext = Astronomy.NextGlobalSolarEclipse;
    const collectEcl = (searchFn, nextFn, type, axisOffset) => {
      if (typeof searchFn !== "function") return;
      let ev = searchFn(Astronomy.MakeTime(now));
      for (let i = 0; i < 2 && ev && ev.peak; i++) {
        const et = ev.peak;
        const elon = nm(bodyLon(B.Sun, et) - ayanamsha(et.ut) + axisOffset);
        let hit = null;
        planets.forEach((p) => {
          const dd = Math.abs(nm(p.sid) - elon);
          if (Math.min(dd, 360 - dd) < 5) hit = p.name;
        });
        eclipses.push({ date: new Date(et.date), type, sign: signOf(elon), house: hFromMoon(elon), hit });
        ev = typeof nextFn === "function" ? nextFn(et) : null;
      }
    };
    collectEcl(solSearch, solNext, "Solar Eclipse", 0);
    collectEcl(Astronomy.SearchLunarEclipse, Astronomy.NextLunarEclipse, "Lunar Eclipse", 180);
    eclipses.sort((a, b) => a.date - b.date);
  } catch (e) {
    console.warn("Eclipse computation skipped:", e.message);
  }

  // Full live sky (gochar) — EVERY graha's current sidereal position + the house
  // it transits relative to the NATAL lagna (drives the visual transit map). The
  // 4 slow planets above feed Sade Sati / notes; this adds the fast ones too.
  // Keep in sync with mobile/src/shared/astrology.js.
  const tSun = nm(bodyLon(B.Sun, tTime) - tAy),
    tMoonNow = nm(bodyLon(B.Moon, tTime) - tAy),
    tMer = nm(bodyLon(B.Mercury, tTime) - tAy),
    tVen = nm(bodyLon(B.Venus, tTime) - tAy),
    tMar = nm(bodyLon(B.Mars, tTime) - tAy);
  const ascIdxNow = Math.floor(nm(angles.ascSid) / 30);
  const hFromLagna = (lon) => ((Math.floor(nm(lon) / 30) - ascIdxNow + 12) % 12) + 1;
  const gochar = [
    ["Sun", tSun],
    ["Moon", tMoonNow],
    ["Mercury", tMer],
    ["Venus", tVen],
    ["Mars", tMar],
    ["Jupiter", tJup],
    ["Saturn", tSat],
    ["Rahu", tRahu],
    ["Ketu", nm(tRahu + 180)],
  ].map(([name, lon]) => ({
    name,
    lon: nm(lon),
    sign: signOf(lon),
    deg: +(nm(lon) % 30).toFixed(1),
    houseLagna: hFromLagna(lon),
    houseMoon: hFromMoon(lon),
    area: HOUSE_AREA[hFromLagna(lon)],
    retro: name === "Rahu" || name === "Ketu",
  }));

  const chart = {
    planets,
    angles,
    nakshatra,
    aspects,
    stelliums,
    yogas,
    dasha,
    curMaha,
    curAntar,
    ayanamsha: ay,
    d9: {
      d9Lagna,
      d9SeventhSign,
      d9SeventhLord,
      d9SeventhOcc,
      darakaraka: dkP ? dkP.base : null,
      aspects: d9asp,
    },
    transits: {
      asOf: now,
      saturn: {
        sign: signOf(tSat),
        houseMoon: satH,
        note:
          satH === 10
            ? "Saturn in 10th from Moon — career restructuring"
            : satH === 4
              ? "Saturn in 4th from Moon — home focus"
              : "",
      },
      jupiter: {
        sign: signOf(tJup),
        houseMoon: jupH,
        note: [1, 2, 5, 7, 9, 11].includes(jupH)
          ? "Jupiter in favourable transit"
          : "Jupiter in neutral transit",
      },
      positions: [
        { name: "Saturn", sign: signOf(tSat), houseMoon: satH },
        { name: "Jupiter", sign: signOf(tJup), houseMoon: jupH },
        { name: "Rahu", sign: signOf(tRahu), houseMoon: rahuH },
        { name: "Ketu", sign: signOf(tRahu + 180), houseMoon: hFromMoon(tRahu + 180) },
      ],
      gochar,
      ascSign: signOf(angles.ascSid),
      sadeSati: { active: !!sSati, phase: sSati },
      tnAspects: [],
    },
  };

  // Transit-to-natal aspects
  const tBodies = [
    { n: "Saturn", l: tSat },
    { n: "Jupiter", l: tJup },
    { n: "Rahu", l: tRahu },
  ];
  tBodies.forEach((tb) => {
    planets.slice(0, 10).forEach((np) => {
      let sep = Math.abs(tb.l - np.sid) % 360;
      if (sep > 180) sep = 360 - sep;
      ASPECTS.forEach(([an, ang]) => {
        if (Math.abs(sep - ang) < 3)
          chart.transits.tnAspects.push({
            t: tb.n,
            n: np.name,
            type: an,
            orb: Math.abs(sep - ang).toFixed(1),
          });
      });
    });
  });

  chart.scores = computeScores(chart);
  chart.houseLords = computeHouseLords(chart);
  chart.predictions = computePredictions(chart);
  chart.confidence = computeConfidence(chart);
  chart.daily = computeDaily(chart, city);
  chart.marriage = computeMarriage(chart);

  // Phase-2 enhancements — pure local math, zero token cost.
  chart.doshas = computeDoshas(chart);
  chart.panchang = computePanchang(chart, date);
  chart.strengths = computeStrengthMeter(chart);
  chart.ashtakvarga = computeAshtakvarga(chart);
  return chart;
}

/* ── DOSHA ENGINE — Mangal, Kaal Sarp, Pitra, Sade Sati ── */
function computeDoshas(ch) {
  const P = {};
  ch.planets.forEach((p) => {
    P[p.base] = p;
  });
  const ascSign = Math.floor(nm(ch.angles.ascSid) / 30);

  // Mangal Dosha — Mars in 1,2,4,7,8,12 from Lagna or Moon
  const mars = P.Mars;
  const moonHouse = (p) => ((Math.floor(p.sid / 30) - Math.floor(P.Moon.sid / 30) + 12) % 12) + 1;
  const marsFromMoon = mars && P.Moon ? moonHouse(mars) : null;
  const mangalHouses = [1, 2, 4, 7, 8, 12];
  const mangalLagna = mars && mangalHouses.includes(mars.houseSid);
  const mangalMoon = mars && marsFromMoon && mangalHouses.includes(marsFromMoon);
  let mangalLevel = "None";
  if (mangalLagna && mangalMoon) mangalLevel = "High";
  else if (mangalLagna || mangalMoon) mangalLevel = "Mild";
  // Cancellation when Mars is in own sign or exalted
  const marsCancel = mars && /own|exalt/.test(mars.dignity || "");
  const mangal = {
    level: marsCancel && mangalLevel !== "None" ? "Cancelled" : mangalLevel,
    house: mars ? mars.houseSid : null,
    fromMoon: marsFromMoon,
    detail: mars
      ? mangalLevel === "None"
        ? "Mars sits outside the malefic houses."
        : marsCancel
          ? `Mars in ${signOf(mars.sid)} (${mars.dignity}) — its affliction is largely neutralised.`
          : `Mars in House ${mars.houseSid}${marsFromMoon ? ` (${marsFromMoon}th from Moon)` : ""} — affects partnership karma.`
      : "Mars position unknown.",
  };

  // Kaal Sarp Dosha — all 7 grahas hemmed between Rahu→Ketu (one side only)
  const rahu = P.Rahu,
    ketu = P.Ketu;
  let kaalSarp = { present: false, detail: "" };
  if (rahu && ketu) {
    const rL = nm(rahu.sid),
      kL = nm(ketu.sid);
    const grahas = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]
      .map((b) => P[b])
      .filter(Boolean);
    // Check if every planet is in the "Rahu→Ketu" arc (going forward zodiacally).
    const inArc = (lon, a, b) => {
      const span = nm(b - a);
      const off = nm(lon - a);
      return off > 0 && off < span;
    };
    const allInRahuKetu = grahas.every((p) => inArc(p.sid, rL, kL));
    const allInKetuRahu = grahas.every((p) => inArc(p.sid, kL, rL));
    if (allInRahuKetu || allInKetuRahu) {
      kaalSarp = {
        present: true,
        detail: `All 7 planets hemmed between the ${allInRahuKetu ? "North Node→South Node" : "South Node→North Node"} axis — karmic ambition lessons.`,
      };
    } else {
      kaalSarp = {
        present: false,
        detail: "No nodal alignment — your planets fall on both sides of the North–South Node axis.",
      };
    }
  }

  // Pitra Dosha — Sun + Rahu conjunction (within 12°) OR Sun afflicted by Rahu/Ketu/Saturn in 9th
  const sun = P.Sun;
  let pitra = { present: false, detail: "" };
  if (sun && rahu) {
    const sep = Math.min(Math.abs(sun.sid - rahu.sid), 360 - Math.abs(sun.sid - rahu.sid));
    const sunRahuConj = sun.houseSid === rahu.houseSid && sep < 12;
    const ninthH = ((ascSign + 8) % 12) + 1;
    const malefIn9 = ["Saturn", "Rahu", "Ketu"].some((b) => P[b] && P[b].houseSid === ninthH);
    if (sunRahuConj) {
      pitra = {
        present: true,
        detail: `Sun–North Node conjunction in House ${sun.houseSid} — ancestral karma activation.`,
      };
    } else if (malefIn9) {
      const which = ["Saturn", "Rahu", "Ketu"].find((b) => P[b] && P[b].houseSid === ninthH);
      const whichEn = which === "Rahu" ? "North Node" : which === "Ketu" ? "South Node" : which;
      pitra = {
        present: true,
        detail: `${whichEn} in the 9th house — paternal/ancestral themes need attention.`,
      };
    } else {
      pitra = { present: false, detail: "No Sun–North Node affliction; the ancestral house is clear." };
    }
  }

  // Sade Sati — pull from existing transit data
  const sadeSati = {
    active: ch.transits?.sadeSati?.active || false,
    phase: ch.transits?.sadeSati?.phase || "",
    detail: ch.transits?.sadeSati?.active
      ? `Saturn ${ch.transits.sadeSati.phase} — discipline, lessons, reorientation.`
      : "Saturn is currently outside its challenging 7½-year cycle.",
  };

  return { mangal, kaalSarp, pitra, sadeSati };
}

/* ── PANCHANG — Tithi, Paksha, Karana, Yoga, Nakshatra Pada ── */
const TITHI_NAMES = [
  "Pratipada",
  "Dwitiya",
  "Tritiya",
  "Chaturthi",
  "Panchami",
  "Shashti",
  "Saptami",
  "Ashtami",
  "Navami",
  "Dashami",
  "Ekadashi",
  "Dwadashi",
  "Trayodashi",
  "Chaturdashi",
  "Purnima/Amavasya",
];
const KARANA_NAMES = [
  "Bava",
  "Balava",
  "Kaulava",
  "Taitila",
  "Garaja",
  "Vanija",
  "Vishti",
  "Shakuni",
  "Chatushpada",
  "Naga",
  "Kintughna",
];
const YOGA_NAMES = [
  "Vishkambha",
  "Preeti",
  "Ayushmana",
  "Saubhagya",
  "Shobhana",
  "Atiganda",
  "Sukarmana",
  "Dhriti",
  "Shoola",
  "Ganda",
  "Vriddhi",
  "Dhruva",
  "Vyaghata",
  "Harshana",
  "Vajra",
  "Siddhi",
  "Vyatipata",
  "Variyana",
  "Parigha",
  "Shiva",
  "Siddha",
  "Sadhya",
  "Shubha",
  "Shukla",
  "Brahma",
  "Indra",
  "Vaidhriti",
];

function computePanchang(ch, birthDate) {
  const sun = ch.planets[0],
    moon = ch.planets[1];
  if (!sun || !moon) return null;
  // Tithi = (Moon - Sun) / 12° → 1..30. Paksha 1=Shukla(waxing), 2=Krishna(waning).
  const elong = nm(moon.sid - sun.sid);
  const tithiIdx = Math.floor(elong / 12); // 0..29
  const paksha = tithiIdx < 15 ? "Shukla" : "Krishna";
  const tithiNum = (tithiIdx % 15) + 1;
  const tithiName =
    tithiNum === 15 ? (paksha === "Shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[tithiNum - 1];

  // Karana = each tithi has 2 karanas (60 total in lunar month) cycling through 11 names.
  const karanaIdx = Math.floor(elong / 6);
  // Last 4 are fixed (Shakuni..Kintughna), the first 56 cycle Bava..Vishti.
  let karana;
  if (karanaIdx === 0) karana = "Kintughna";
  else if (karanaIdx >= 57)
    karana = KARANA_NAMES[7 + (karanaIdx - 57)]; // Shakuni..Kintughna
  else karana = KARANA_NAMES[(karanaIdx - 1) % 7];

  // Yoga = (Sun + Moon) / 13°20' → 1..27 yogas.
  const yogaIdx = Math.floor(nm(sun.sid + moon.sid) / (360 / 27));
  const yoga = YOGA_NAMES[yogaIdx] || YOGA_NAMES[0];

  // Nakshatra Pada (1..4) — 13°20' nakshatra split into 4 padas of 3°20' each.
  const nakSpan = 13 + 1 / 3;
  const padaIdx = Math.floor((moon.sid % nakSpan) / (nakSpan / 4)) + 1;

  // Weekday (Vaara)
  const VAARA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const vaara = VAARA[birthDate.getDay()];

  return {
    tithi: `${paksha} Paksha · ${tithiName}`,
    karana,
    yoga,
    vaara,
    nakshatra: ch.nakshatra,
    pada: padaIdx,
  };
}

/* ── PLANETARY STRENGTH METER — 0..100% per graha ── */
function computeStrengthMeter(ch) {
  const GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  const find = (b) => ch.planets.find((p) => p.base === b);
  return GRAHAS.map((b) => {
    const p = find(b);
    if (!p) return { planet: b, score: 0, label: "—" };
    let s = 50;
    let label = "Neutral";
    if (/exalt/.test(p.dignity || "")) {
      s = 92;
      label = "Exalted";
    } else if (/in own/.test(p.dignity || "")) {
      s = 80;
      label = "Own Sign";
    } else if (/debil/.test(p.dignity || "")) {
      s = 15;
      label = "Debilitated";
    }
    if (p.angular) s += 10;
    if ([6, 8, 12].includes(p.houseSid)) s -= 12;
    if ([1, 4, 5, 7, 9, 10, 11].includes(p.houseSid)) s += 6;
    if (p.retro && !["Rahu", "Ketu"].includes(b)) s -= 4;
    s = Math.max(5, Math.min(98, Math.round(s)));
    return {
      planet: b,
      score: s,
      label,
      house: p.houseSid,
      sign: signOf(p.sid),
      retro: !!p.retro,
    };
  });
}

/* ── ASHTAKVARGA — Bhinna + Sarva totals per sign (max 56 per sign) ── */
const ASHTAK_RULES = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11],
    Moon: [3, 6, 10, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11],
    Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Asc: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11],
    Moon: [1, 3, 6, 7, 10, 11],
    Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus: [3, 4, 5, 7, 9, 10, 11],
    Saturn: [3, 5, 6, 11],
    Asc: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11],
    Moon: [3, 6, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12],
    Venus: [6, 8, 11, 12],
    Saturn: [1, 4, 7, 8, 9, 10, 11],
    Asc: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12],
    Moon: [2, 4, 6, 8, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12],
    Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Asc: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon: [2, 5, 7, 9, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus: [2, 5, 6, 9, 10, 11],
    Saturn: [3, 5, 6, 12],
    Asc: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12],
    Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars: [3, 4, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11],
    Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11],
    Asc: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11],
    Moon: [3, 6, 11],
    Mars: [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12],
    Venus: [6, 11, 12],
    Saturn: [3, 5, 6, 11],
    Asc: [1, 3, 4, 6, 10, 11],
  },
};

function computeAshtakvarga(ch) {
  const find = (b) => ch.planets.find((p) => p.base === b);
  const ascSignIdx = Math.floor(nm(ch.angles.ascSid) / 30);
  const signOfBody = (b) => {
    if (b === "Asc") return ascSignIdx;
    const p = find(b);
    return p ? Math.floor(nm(p.sid) / 30) : null;
  };

  // Per-planet bindu count per sign (Bhinna).
  const bhinna = {};
  Object.keys(ASHTAK_RULES).forEach((planet) => {
    const rules = ASHTAK_RULES[planet];
    const counts = new Array(12).fill(0);
    Object.entries(rules).forEach(([source, positions]) => {
      const srcSign = signOfBody(source);
      if (srcSign == null) return;
      positions.forEach((houseFromSource) => {
        const targetSign = (srcSign + houseFromSource - 1) % 12;
        counts[targetSign]++;
      });
    });
    bhinna[planet] = counts;
  });

  // Sarva = sum across all 7 planets per sign (max 56).
  const sarva = new Array(12).fill(0);
  Object.values(bhinna).forEach((arr) =>
    arr.forEach((v, i) => {
      sarva[i] += v;
    })
  );

  // Per-sign data with sign name + lucky flag.
  const perSign = sarva.map((total, i) => ({
    sign: SIGNS[i],
    total,
    lucky: total >= 28,
  }));

  return { bhinna, sarva, perSign };
}

/* ── PREDICTION ENGINE — deterministic timeline windows from dasha + house lords ── */
function phaseLabel(houses, tone) {
  if (houses.includes(10)) return "Career Activation";
  if (houses.includes(7)) return "Relationship Karma Phase";
  if (houses.includes(4)) return "Foundation Building";
  if (houses.includes(2) || houses.includes(11)) return "Wealth Expansion Window";
  if (houses.includes(9) || houses.includes(12)) return "Expansion Window";
  if (houses.includes(5)) return "Growth Phase";
  if (tone === "testing") return "Pressure + Opportunity";
  return "Transition Phase";
}
function computePredictions(ch) {
  const now = new Date();
  const find = (b) => ch.planets.find((p) => p.base === b);
  const rules = (b) => ch.houseLords.filter((l) => l.lord === b).map((l) => l.house);
  // flatten all antardasha windows, keep the upcoming/current ones
  const subs = [];
  ch.dasha.forEach((m) => (m.sub || []).forEach((s) => subs.push({ maha: m.lord, ...s })));
  return subs
    .filter((s) => s.end > now)
    .slice(0, 5)
    .map((s) => {
      const lp = find(s.lord);
      const ruled = rules(s.lord);
      const houses = [...new Set([...(lp ? [lp.houseSid] : []), ...ruled])];
      const dignity = lp ? lp.dignity || "" : "";
      let tone = "mixed";
      if (lp) {
        const strong = /exalt|own/.test(dignity);
        const goodHouse = [1, 4, 5, 7, 9, 10, 11].includes(lp.houseSid);
        const hardHouse = [6, 8, 12].includes(lp.houseSid);
        if (strong || goodHouse) tone = "supportive";
        if (/debil/.test(dignity) || (hardHouse && !strong)) tone = "testing";
      }
      const why = [];
      if (lp)
        why.push(
          `${s.lord} sits in House ${lp.houseSid} (${signOf(lp.sid)})${dignity ? " — " + dignity.split("—")[0].trim() : ""}`
        );
      ruled.forEach((h) => why.push(`${s.lord} rules House ${h} [${HOUSE_AREA[h]}]`));
      const themes = houses.map((h) => HOUSE_THEME[h]);
      const summary = (themes.join("; ") + " come into focus.").replace(/^./, (c) => c.toUpperCase());
      return {
        period: `${s.maha} – ${s.lord}`,
        start: s.start,
        end: s.end,
        current: s.start <= now && s.end >= now,
        tone,
        phase: phaseLabel(houses, tone),
        summary,
        areas: houses.map((h) => ({ house: h, area: HOUSE_AREA[h] })),
        why,
      };
    });
}

/* ── CONFIDENCE ENGINE — counts independent chart signatures per life theme ── */
function computeConfidence(ch) {
  const P = {};
  ch.planets.forEach((p) => {
    if (!P[p.base]) P[p.base] = p;
  });
  const occ = (h) => ch.planets.filter((p) => p.houseSid === h);
  const benefics = ["Jupiter", "Venus", "Mercury", "Moon"];
  const wellPlaced = (p) =>
    !!p && (/exalt|own/.test(p.dignity || "") || [1, 4, 5, 7, 9, 10, 11].includes(p.houseSid));
  const lordPlanet = (h) => {
    const hl = ch.houseLords.find((x) => x.house === h);
    return hl ? P[hl.lord] : null;
  };
  const strong = (b) => {
    const p = P[b];
    return !!p && ((p.strength || 0) >= 62 || /exalt|own/.test(p.dignity || ""));
  };
  const ruledBy = (b) => ch.houseLords.filter((x) => x.lord === b).map((x) => x.house);
  const dashaTouches = (h) => {
    const hit = (p) => p && (p.houseSid === h || ruledBy(p.base).includes(h));
    return hit(P[ch.curMaha.lord]) || hit(ch.curAntar && P[ch.curAntar.lord]);
  };
  const build = (theme, checks) => {
    const yes = checks.filter((c) => c.present).length,
      ratio = yes / checks.length;
    return {
      theme,
      level: ratio >= 0.6 ? "High" : ratio >= 0.34 ? "Moderate" : "Low",
      count: yes,
      total: checks.length,
      supporting: checks.filter((c) => c.present).map((c) => c.label),
      missing: checks.filter((c) => !c.present).map((c) => c.label),
    };
  };
  return [
    build("Career & Status", [
      { label: "Planet(s) occupy the 10th house", present: occ(10).length > 0 },
      { label: "10th lord strongly placed", present: wellPlaced(lordPlanet(10)) },
      { label: "Saturn empowering the career axis", present: !!P.Saturn && P.Saturn.houseSid === 10 },
      { label: "A Pancha Mahapurusha yoga", present: ch.yogas.some((y) => /Mahapurusha/.test(y)) },
      { label: "Current dasha lord linked to the 10th", present: dashaTouches(10) },
      { label: "Strong career karaka (Sun or Saturn)", present: strong("Sun") || strong("Saturn") },
    ]),
    build("Marriage & Partnership", [
      { label: "7th house occupied", present: occ(7).length > 0 },
      { label: "7th lord well placed", present: wellPlaced(lordPlanet(7)) },
      { label: "Venus well-dignified", present: strong("Venus") },
      {
        label: "Benefic in the D9 7th house",
        present: (ch.d9.d9SeventhOcc || []).some((b) => benefics.includes(b)),
      },
      { label: "Current dasha lord linked to the 7th", present: dashaTouches(7) },
      { label: "Free of Mangal Dosha", present: !(P.Mars && [1, 2, 4, 7, 8, 12].includes(P.Mars.houseSid)) },
    ]),
    build("Foreign & Relocation", [
      { label: "Planet(s) in the 12th house", present: occ(12).length > 0 },
      { label: "Jupiter or a benefic in the 12th", present: occ(12).some((p) => benefics.includes(p.base)) },
      { label: "Rahu on the 3rd/9th/12th axis", present: !!P.Rahu && [3, 9, 12].includes(P.Rahu.houseSid) },
      { label: "Rahu Mahadasha active", present: ch.curMaha.lord === "Rahu" },
      { label: "9th house activated", present: occ(9).length > 0 },
      {
        label: "9th or 12th lord well placed",
        present: wellPlaced(lordPlanet(9)) || wellPlaced(lordPlanet(12)),
      },
    ]),
    build("Wealth & Finance", [
      { label: "2nd house occupied", present: occ(2).length > 0 },
      { label: "11th house occupied", present: occ(11).length > 0 },
      { label: "Jupiter (wealth karaka) strong", present: strong("Jupiter") },
      { label: "2nd lord well placed", present: wellPlaced(lordPlanet(2)) },
      { label: "11th lord well placed", present: wellPlaced(lordPlanet(11)) },
      { label: "A Gajakesari or wealth yoga", present: ch.yogas.some((y) => /Gajakesari/.test(y)) },
    ]),
  ];
}

/* ── DAILY GUIDANCE ENGINE — weekday lord, numerology, Moon transit, Rahu Kaal ── */
function fmtClock(ms, tz) {
  const d = new Date(ms + tz * 3600000);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}
export function computeDaily(ch, city, target) {
  const now = target || new Date();
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WDLORD = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const COLOR = {
    Sun: "Orange / Gold",
    Moon: "White / Cream",
    Mars: "Red / Coral",
    Mercury: "Green / Emerald",
    Jupiter: "Yellow / Saffron",
    Venus: "White / Soft Pink",
    Saturn: "Deep Blue / Black",
  };
  const RAHU_SLOT = { 0: 8, 1: 2, 2: 7, 3: 5, 4: 6, 5: 4, 6: 3 }; // segment of the day per weekday
  const ALIGN = { 1: 72, 2: 58, 3: 82, 4: 44, 5: 60, 6: 78, 7: 80, 8: 38, 9: 62, 10: 85, 11: 88, 12: 42 }; // Moon-transit favourability
  const reduce = (n) => {
    while (n > 9)
      n = String(n)
        .split("")
        .reduce((a, b) => a + +b, 0);
    return n;
  };
  const tz = city.tz,
    wd = now.getDay(),
    dayLord = WDLORD[wd];
  const luckyNumber = reduce(now.getDate() + now.getMonth() + 1 + now.getFullYear());

  const t = Astronomy.MakeTime(now);
  const moonLon = nm(bodyLon(Astronomy.Body.Moon, t) - ayanamsha(t.ut));
  const natalMoonIdx = Math.floor(nm(ch.planets[1].sid) / 30);
  const moonHouseFromNatal = ((Math.floor(moonLon / 30) - natalMoonIdx + 12) % 12) + 1;

  // Rahu Kaal & Abhijit Muhurta from real sunrise/sunset at the city
  let rahuKaal = null,
    auspicious = null;
  try {
    const cityNow = new Date(now.getTime() + tz * 3600000);
    const midnightUTC =
      Date.UTC(cityNow.getUTCFullYear(), cityNow.getUTCMonth(), cityNow.getUTCDate()) - tz * 3600000;
    const obs = new Astronomy.Observer(city.lat, city.lon, 0);
    const start = Astronomy.MakeTime(new Date(midnightUTC));
    const sr = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, 1, start, 1);
    const ss = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, start, 1);
    if (sr && ss) {
      const sunrise = sr.date.getTime(),
        sunset = ss.date.getTime();
      const span = sunset - sunrise,
        seg = span / 8,
        slot = RAHU_SLOT[wd];
      rahuKaal = { start: fmtClock(sunrise + (slot - 1) * seg, tz), end: fmtClock(sunrise + slot * seg, tz) };
      const mid = sunrise + span / 2;
      auspicious = { start: fmtClock(mid - span / 30, tz), end: fmtClock(mid + span / 30, tz) };
    }
  } catch (e) {
    console.warn("Rahu Kaal skipped:", e.message);
  }

  return {
    date: now,
    weekday: WD[wd],
    dayLord,
    luckyColor: COLOR[dayLord],
    luckyNumber,
    moonSign: signOf(moonLon),
    moonHouseFromNatal,
    alignment: ALIGN[moonHouseFromNatal] || 60,
    rahuKaal,
    auspicious,
    dasha: `${ch.curMaha.lord} Mahadasha${ch.curAntar ? " / " + ch.curAntar.lord + " Antardasha" : ""}`,
  };
}

// Full deterministic fact sheet — used by both the reading and the chat
export function buildFactSheet(ch, form) {
  const ascS = signOf(ch.angles.ascSid);
  const pBase = (b) => ch.planets.find((p) => p.base === b);
  const mahaP = pBase(ch.curMaha.lord),
    antarP = ch.curAntar && pBase(ch.curAntar.lord);
  const dashaPos =
    `${ch.curMaha.lord} sits in House ${mahaP ? mahaP.houseSid : "?"} (${mahaP ? signOf(mahaP.sid) : "?"}) [${mahaP ? HOUSE_AREA[mahaP.houseSid] : ""}]` +
    (antarP
      ? `; ${ch.curAntar.lord} sits in House ${antarP.houseSid} (${signOf(antarP.sid)}) [${HOUSE_AREA[antarP.houseSid]}]`
      : "");
  return `BIRTH: ${form.name || "Unknown"}, ${form.date} ${form.time} (${form.city})
GENDER: ${form.gender || "NOT SPECIFIED — use the name or 'they/them', never assume"}
SYSTEM: Vedic sidereal, Lahiri ayanamsha ${ch.ayanamsha.toFixed(2)}°, whole-sign houses.

ASCENDANT (Lagna): ${ascS} [${SIGN_QUALITY[ascS]}]
MOON NAKSHATRA: ${ch.nakshatra}

=== RULE-DERIVED CHART FACTS ===
PLANETS:
${ch.planets.map((p) => "- " + p.rule).join("\n")}

ASPECTS:
${ch.aspects.map((a) => "- " + a.rule).join("\n") || "- none within orb"}

YOGAS:
${ch.yogas.map((y) => "- " + y).join("\n") || "- none"}

DASHA: ${ch.curMaha.lord} Mahadasha (${fmtDate(ch.curMaha.start)} – ${fmtDate(ch.curMaha.end)})${ch.curAntar ? `, sub-period ${ch.curAntar.lord}` : ""}

D9 NAVAMSA:
${ch.planets
  .slice(0, 9)
  .map((p) => `- ${p.name}: ${p.nav}`)
  .join("\n")}

HOUSE LORDS (a house lord's placement LINKS the two life-areas — this is the core of the reading):
${ch.houseLords.map((l) => `- ${ordinal(l.house)} lord ${l.lord} sits in House ${l.inHouse} → links ${ordinal(l.house)}-house [${HOUSE_AREA[l.house]}] with ${ordinal(l.inHouse)}-house [${HOUSE_AREA[l.inHouse]}]`).join("\n")}

DASHA LORD POSITIONS: ${dashaPos}

SCORES (already final — describe in words, never write the number):
${ch.scores.map((s) => `- ${s.key}: ${s.score}/100  [drivers: ${(s.factors || []).join(", ")}]`).join("\n")}

CONFIDENCE ENGINE (independent chart signatures counted per theme — reflect these levels honestly):
${ch.confidence.map((c) => `- ${c.theme}: ${c.level} confidence (${c.count}/${c.total} signatures). Supporting: ${c.supporting.join("; ") || "none"}`).join("\n")}

TIMELINE FORECAST (deterministic antardasha windows — word these into predictions; never change the dates or houses):
${ch.predictions.map((p) => `- ${p.period} (${fmtDate(p.start)}–${fmtDate(p.end)})${p.current ? " [CURRENT]" : ""}: ${p.phase}. ${p.summary} WHY: ${p.why.join("; ")}`).join("\n")}
${
  ch.doshas
    ? `
DOSHAS (already computed — reflect honestly; do not invent new doshas):
- Mangal: ${ch.doshas.mangal.level} — ${ch.doshas.mangal.detail}
- Kaal Sarp: ${ch.doshas.kaalSarp.present ? "ACTIVE" : "absent"} — ${ch.doshas.kaalSarp.detail}
- Pitra: ${ch.doshas.pitra.present ? "ACTIVE" : "absent"} — ${ch.doshas.pitra.detail}
- Sade Sati: ${ch.doshas.sadeSati.active ? ch.doshas.sadeSati.phase : "inactive"} — ${ch.doshas.sadeSati.detail}`
    : ""
}
${
  ch.panchang
    ? `
PANCHANG AT BIRTH (vedic time-elements):
- Tithi: ${ch.panchang.tithi}
- Nakshatra Pada: ${ch.panchang.nakshatra} (Pada ${ch.panchang.pada})
- Yoga: ${ch.panchang.yoga}
- Karana: ${ch.panchang.karana}
- Vaara: ${ch.panchang.vaara}`
    : ""
}
${
  ch.strengths
    ? `
PLANETARY STRENGTH (0–100; treat 75+ as strong, 30 or below as weak):
${ch.strengths.map((s) => `- ${s.planet}: ${s.score} (${s.label}${s.house ? ", H" + s.house : ""}${s.retro ? ", retrograde" : ""})`).join("\n")}`
    : ""
}
${
  ch.ashtakvarga
    ? `
ASHTAKVARGA SARVA (max 56 per sign; 28+ = lucky):
${ch.ashtakvarga.perSign.map((s) => `- ${s.sign}: ${s.total} bindus${s.lucky ? " [lucky]" : ""}`).join("\n")}`
    : ""
}
${
  ch.transits
    ? `
TODAY'S TRANSITS (gochar — current sky vs. natal Moon; weave into answers when timing matters):
- Saturn: ${ch.transits.saturn.sign}, House ${ch.transits.saturn.houseMoon} from Moon${ch.transits.saturn.note ? " — " + ch.transits.saturn.note : ""}
- Jupiter: ${ch.transits.jupiter.sign}, House ${ch.transits.jupiter.houseMoon} from Moon${ch.transits.jupiter.note ? " — " + ch.transits.jupiter.note : ""}
${(ch.transits.positions || [])
  .filter((p) => p.name === "Rahu" || p.name === "Ketu")
  .map((p) => `- ${p.name}: ${p.sign}, House ${p.houseMoon} from Moon`)
  .join("\n")}
${ch.transits.sadeSati?.active ? `- Sade Sati ACTIVE — ${ch.transits.sadeSati.phase}` : "- Sade Sati: inactive"}
${ch.transits.tnAspects?.length ? `Transit-to-natal aspects: ${ch.transits.tnAspects.map((a) => `${a.t} ${a.type} natal ${a.n} (orb ${a.orb}°)`).join("; ")}` : ""}`
    : ""
}`;
}
