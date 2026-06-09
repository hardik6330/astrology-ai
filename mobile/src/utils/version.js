// Tiny semver comparison — just enough for the force-update check. Compares
// dotted numeric versions ("1.2.0" vs "1.10.3") part-by-part; non-numeric or
// missing parts are treated as 0. Pre-release tags (e.g. "-beta") are ignored.

function parts(v) {
  return String(v || "0")
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

// -1 if a < b, 0 if equal, 1 if a > b.
export function compareVersions(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// True when `current` is strictly older than `latest`. Missing/garbage inputs
// resolve to false so we never force-update on bad data.
export function isOutdated(current, latest) {
  if (!current || !latest) return false;
  return compareVersions(current, latest) < 0;
}
