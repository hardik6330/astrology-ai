// Maps the phone's OS region (from expo-localization) to an E.164 dialing code,
// so the login screen can pre-fill the right country code without a permission
// prompt, network call, or GPS. Region reflects the country the user configured
// their phone for (tracks their phone NUMBER far better than physical location —
// an Indian traveler in the US still has region=IN, so they get +91, not +1).
//
// The detected code is only a DEFAULT — the login prefix stays editable, so a
// wrong/unknown region is a quick manual fix, never a lockout.

import * as Localization from "expo-localization";

// ISO 3166-1 alpha-2 → country calling code (digits, no "+"). NANP island
// nations carry their full "1XXX" code (e.g. Anguilla 1264) so the national
// number completes a valid E.164. An unlisted region falls back to "" (plain
// "+"). NOTE: French overseas territories are keyed by their REAL ISO codes
// (PF/GP/MQ/YT/RE), not "fr", so FR stays +33.
const ISO_TO_DIAL = {
  AD: "376", AE: "971", AF: "93", AG: "1268", AI: "1264", AL: "355", AM: "374",
  AN: "599", AO: "244", AR: "54", AT: "43", AU: "61", AW: "297", AZ: "994",
  BA: "387", BB: "1246", BD: "880", BE: "32", BF: "226", BG: "359", BH: "973",
  BI: "257", BJ: "229", BM: "1441", BN: "673", BO: "591", BR: "55", BS: "1242",
  BT: "975", BW: "267", BY: "375", BZ: "501",
  CA: "1", CD: "243", CF: "236", CG: "242", CH: "41", CI: "225", CK: "682",
  CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CU: "53", CV: "238",
  CX: "61", CY: "357", CZ: "420",
  DE: "49", DJ: "253", DK: "45", DM: "1767", DO: "1809", DZ: "213",
  EC: "593", EE: "372", EG: "20", ER: "291", ES: "34", ET: "251",
  FI: "358", FJ: "679", FK: "500", FM: "691", FO: "298", FR: "33",
  GA: "241", GB: "44", GD: "1473", GE: "995", GH: "233", GI: "350", GL: "299",
  GM: "220", GN: "224", GP: "590", GQ: "240", GR: "30", GT: "502", GW: "245",
  GY: "592",
  HK: "852", HN: "504", HR: "385", HT: "509", HU: "36",
  ID: "62", IE: "353", IL: "972", IN: "91", IO: "246", IQ: "964", IR: "98",
  IS: "354", IT: "39",
  JM: "1876", JO: "962", JP: "81",
  KE: "254", KG: "996", KH: "855", KI: "686", KM: "269", KN: "1869", KP: "850",
  KR: "82", KW: "965", KY: "1345", KZ: "7",
  LA: "856", LB: "961", LC: "1758", LI: "423", LK: "94", LR: "231", LS: "266",
  LT: "370", LU: "352", LV: "371", LY: "218",
  MA: "212", MC: "377", MD: "373", ME: "382", MG: "261", MH: "692", MK: "389",
  ML: "223", MM: "95", MN: "976", MO: "853", MP: "1670", MQ: "596", MR: "222",
  MS: "1664", MT: "356", MU: "230", MV: "960", MW: "265", MX: "52", MY: "60",
  MZ: "258",
  NA: "264", NC: "687", NE: "227", NG: "234", NI: "505", NL: "31", NO: "47",
  NP: "977", NR: "674", NU: "683", NZ: "64",
  OM: "968",
  PA: "507", PE: "51", PF: "689", PH: "63", PK: "92", PL: "48", PM: "508",
  PR: "1", PS: "970", PT: "351", PW: "680", PY: "595",
  QA: "974",
  RE: "262", RO: "40", RS: "381", RU: "7", RW: "250",
  SA: "966", SB: "677", SC: "248", SD: "249", SE: "46", SG: "65", SH: "290",
  SI: "386", SK: "421", SL: "232", SM: "378", SN: "221", SO: "252", SR: "597",
  SS: "211", ST: "239", SV: "503", SY: "963", SZ: "268",
  TC: "1649", TD: "235", TG: "228", TH: "66", TJ: "992", TL: "670", TM: "993",
  TN: "216", TO: "676", TR: "90", TT: "1868", TV: "688", TW: "886", TZ: "255",
  UA: "380", UG: "256", US: "1", UY: "598", UZ: "998",
  VA: "39", VC: "1784", VE: "58", VG: "1284", VI: "1340", VN: "84", VU: "678",
  WF: "681", WS: "685",
  XK: "383",
  YE: "967", YT: "262",
  ZA: "27", ZM: "260", ZW: "263",
};

// The phone's region as an ISO code, e.g. "IN" / "US". Null if unavailable.
function deviceRegion() {
  try {
    const locales = Localization.getLocales?.() || [];
    return locales[0]?.regionCode || null;
  } catch {
    return null;
  }
}

// Best-guess dialing code (digits, no "+") for the phone's region, or "" when
// the region is unknown/unlisted — caller then shows a plain editable "+".
export function defaultDialCode() {
  const region = deviceRegion();
  return (region && ISO_TO_DIAL[region]) || "";
}
