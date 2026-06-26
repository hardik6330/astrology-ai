// Deterministic sub-engines: each takes the (partially built) chart and returns
// one computed piece — dasha, scores, house lords, marriage, doshas, panchang,
// strength meter, ashtakvarga, predictions, confidence. Orchestrated by
// computeChart in astrology.js. Part of @astrology-ai/core.
import { D2R, R2D, YEAR_MS, SIGNS, ZE, NAKSHATRAS, PLANET_DOMAIN, SIGN_QUALITY, HOUSE_AREA, HOUSE_THEME, ASPECT_QUALITY, SIGN_LORD, DIGNITY, DASHA_LEN, DASHA_ORDER } from "./constants.js";
import { dignityOf, navamsaSign, buildDate, obliquity, ayanamsha, signOf, bodyLon } from "./astronomy.js";
import { fmtDate, fmtDay, ordinal, nm, phaseLabel, fmtClock } from "./format.js";

export function computeDasha(moonLon, birthDate) {
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


export function computeScores(ch) {
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


export function computeHouseLords(ch) {
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


export function arudhaPada(houseIdx, lordSignIdx) {
  const d = (lordSignIdx - houseIdx + 12) % 12; // signs from house to its lord
  let ar = (lordSignIdx + d) % 12; // same distance again from the lord
  if (ar === houseIdx || (ar - houseIdx + 12) % 12 === 6) ar = (ar + 9) % 12; // exception → 10th from it
  return ar;
}
export function computeMarriage(ch) {
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

/* ── DOSHA ENGINE — Mangal, Kaal Sarp, Pitra, Sade Sati ── */
export function computeDoshas(ch) {
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


export const TITHI_NAMES = [
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
export const KARANA_NAMES = [
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
export const YOGA_NAMES = [
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

export function computePanchang(ch, birthDate) {
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


export function computeStrengthMeter(ch) {
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


export const ASHTAK_RULES = {
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


export function computeAshtakvarga(ch) {
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


export function computePredictions(ch) {
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


export function computeConfidence(ch) {
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

