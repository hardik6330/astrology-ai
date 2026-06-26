// @astrology-ai/core — chart engine ORCHESTRATION. The heavy math lives in the
// sibling modules (constants.js, astronomy.js, format.js, engines.js); this file
// keeps the top-level flow: computeChart (assembles the natal chart and calls
// every engine), computeDaily (transit-based daily guidance), and buildFactSheet
// (flattens a chart into the text the AI reading is built from).
// Consumed by both clients via thin proxies (src/shared/astrology.js).
import * as Astronomy from "astronomy-engine";
import { STRINGS } from "./uiStrings.js";
import { D2R, R2D, YEAR_MS, SIGNS, ZE, NAKSHATRAS, PLANET_DOMAIN, SIGN_QUALITY, HOUSE_AREA, HOUSE_THEME, ASPECT_QUALITY, SIGN_LORD, DIGNITY, DASHA_LEN, DASHA_ORDER } from "./constants.js";
import { dignityOf, navamsaSign, buildDate, obliquity, ayanamsha, signOf, bodyLon } from "./astronomy.js";
import { fmtDate, fmtDay, ordinal, nm, phaseLabel, fmtClock } from "./format.js";
import { computeDasha, computeScores, computeHouseLords, computeMarriage, computeDoshas, computePanchang, computeStrengthMeter, computeAshtakvarga, computePredictions, computeConfidence } from "./engines.js";

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

  // Translate node names to professional English via the shared label
  // dictionary (STRINGS) so the fact sheet — and the AI reading built from it —
  // never carries Sanskrit. en() maps exact lord names; enText() scrubs prose.
  const NN = STRINGS.LABELS.NORTH_NODE,
    SN = STRINGS.LABELS.SOUTH_NODE;
  const en = (b) => (b === "Rahu" ? NN : b === "Ketu" ? SN : b);
  const enText = (s) => s.replace(/Rahu/g, NN).replace(/Ketu/g, SN);

  // Birth star as its ruling planet (English) instead of the Sanskrit nakshatra
  // name, and a scrubber that drops the Sanskrit yoga proper-noun while keeping
  // its plain-English meaning — so the AI reading carries zero Sanskrit.
  // NOTE: never mutate ch.yogas — engine scoring greps it for "Mahapurusha"/"Gajakesari".
  const moonP = pBase("Moon");
  const nakLordEn = moonP ? en(DASHA_ORDER[Math.floor(moonP.sid / (13 + 1 / 3)) % 9]) : "";
  const scrubYoga = (y) => {
    const m = y.match(/^(.*?)\bYoga\b\s*—\s*(.*)$/);
    return enText(m ? `auspicious combination — ${m[2]}` : y);
  };

  const curMahaLordEn = en(ch.curMaha.lord);
  const curAntarLordEn = ch.curAntar ? en(ch.curAntar.lord) : null;

  const mahaP = pBase(ch.curMaha.lord),
    antarP = ch.curAntar && pBase(ch.curAntar.lord);
  const dashaPos =
    `${curMahaLordEn} sits in House ${mahaP ? mahaP.houseSid : "?"} (${mahaP ? signOf(mahaP.sid) : "?"}) [${mahaP ? HOUSE_AREA[mahaP.houseSid] : ""}]` +
    (antarP
      ? `; ${curAntarLordEn} sits in House ${antarP.houseSid} (${signOf(antarP.sid)}) [${HOUSE_AREA[antarP.houseSid]}]`
      : "");
  return `BIRTH: ${form.name || "Unknown"}, ${form.date} ${form.time} (${form.city})
GENDER: ${form.gender || "NOT SPECIFIED — use the name or 'they/them', never assume"}
SYSTEM: Vedic sidereal, Lahiri ayanamsha ${ch.ayanamsha.toFixed(2)}°, whole-sign houses.

${STRINGS.LABELS.ASCENDANT.toUpperCase()}: ${ascS} [${SIGN_QUALITY[ascS]}]
${STRINGS.LABELS.BIRTH_STAR.toUpperCase()}: ruled by ${nakLordEn}

=== RULE-DERIVED CHART FACTS ===
PLANETS:
${ch.planets.map((p) => "- " + enText(p.rule)).join("\n")}

ASPECTS:
${ch.aspects.map((a) => "- " + a.rule).join("\n") || "- none within orb"}

YOGAS:
${ch.yogas.map((y) => "- " + scrubYoga(y)).join("\n") || "- none"}

${STRINGS.LABELS.MAJOR_PERIOD.toUpperCase()}: ${curMahaLordEn} (${fmtDate(ch.curMaha.start)} – ${fmtDate(ch.curMaha.end)})${curAntarLordEn ? `, ${STRINGS.LABELS.SUB_PERIOD.toLowerCase()} ${curAntarLordEn}` : ""}

D9 NAVAMSA:
${ch.planets
  .slice(0, 9)
  .map((p) => `- ${en(p.name)}: ${p.nav}`)
  .join("\n")}

HOUSE LORDS (a house lord's placement LINKS the two life-areas — this is the core of the reading):
${ch.houseLords.map((l) => `- ${ordinal(l.house)} lord ${en(l.lord)} sits in House ${l.inHouse} → links ${ordinal(l.house)}-house [${HOUSE_AREA[l.house]}] with ${ordinal(l.inHouse)}-house [${HOUSE_AREA[l.inHouse]}]`).join("\n")}

${STRINGS.LABELS.MAJOR_PERIOD.toUpperCase()} LORD POSITIONS: ${dashaPos}

SCORES (already final — describe in words, never write the number):
${ch.scores.map((s) => `- ${s.key}: ${s.score}/100  [drivers: ${(s.factors || []).join(", ")}]`).join("\n")}

CONFIDENCE ENGINE (independent chart signatures counted per theme — reflect these levels honestly):
${ch.confidence.map((c) => `- ${c.theme}: ${c.level} confidence (${c.count}/${c.total} signatures). Supporting: ${c.supporting.join("; ") || "none"}`).join("\n")}

TIMELINE FORECAST (deterministic sub-period windows — word these into predictions; never change the dates or houses):
${ch.predictions.map((p) => `- ${enText(p.period)} (${fmtDate(p.start)}–${fmtDate(p.end)})${p.current ? " [CURRENT]" : ""}: ${p.phase}. ${p.summary} WHY: ${enText(p.why.join("; "))}`).join("\n")}
${
  ch.doshas
    ? `
CHART AFFLICTIONS (already computed — reflect honestly; do not invent new ones):
- Mars Affliction: ${ch.doshas.mangal.level} — ${ch.doshas.mangal.detail}
- Nodal Axis Alignment: ${ch.doshas.kaalSarp.present ? "ACTIVE" : "absent"} — ${enText(ch.doshas.kaalSarp.detail)}
- Ancestral Karma: ${ch.doshas.pitra.present ? "ACTIVE" : "absent"} — ${enText(ch.doshas.pitra.detail)}
- ${STRINGS.LABELS.SATURN_CYCLE}: ${ch.doshas.sadeSati.active ? ch.doshas.sadeSati.phase : "inactive"} — ${ch.doshas.sadeSati.detail}`
    : ""
}

PLANETARY STRENGTH (0–100; treat 75+ as strong, 30 or below as weak):
${ch.strengths.map((s) => `- ${en(s.planet)}: ${s.score} (${s.label}${s.house ? ", H" + s.house : ""}${s.retro ? ", retrograde" : ""})`).join("\n")}

ASHTAKVARGA SARVA (max 56 per sign; 28+ = lucky):
${ch.ashtakvarga.perSign.map((s) => `- ${s.sign}: ${s.total} points${s.lucky ? " [lucky]" : ""}`).join("\n")}

TODAY'S TRANSITS (current sky vs. natal Moon; weave into answers when timing matters):
- Saturn: ${ch.transits.saturn.sign}, House ${ch.transits.saturn.houseMoon} from Moon${ch.transits.saturn.note ? " — " + ch.transits.saturn.note : ""}
- Jupiter: ${ch.transits.jupiter.sign}, House ${ch.transits.jupiter.houseMoon} from Moon${ch.transits.jupiter.note ? " — " + ch.transits.jupiter.note : ""}
${(ch.transits.positions || [])
  .filter((p) => p.name === "Rahu" || p.name === "Ketu")
  .map((p) => `- ${en(p.name)}: ${p.sign}, House ${p.houseMoon} from Moon`)
  .join("\n")}
${ch.transits.sadeSati?.active ? `- Saturn's 7.5-year cycle ACTIVE — ${ch.transits.sadeSati.phase}` : "- Saturn's 7.5-year cycle: inactive"}
${ch.transits.tnAspects?.length ? `Transit-to-natal aspects: ${ch.transits.tnAspects.map((a) => `${en(a.t)} ${a.type} natal ${en(a.n)} (orb ${a.orb}°)`).join("; ")}` : ""}`;
}
