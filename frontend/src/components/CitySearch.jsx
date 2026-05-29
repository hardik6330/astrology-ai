import { useEffect, useRef, useState } from "react";
import { searchCities, getCityDetails } from "../services/api";

// Generate a UUID for the Places sessiontoken. Browser-native crypto when
// available; tiny fallback for old browsers / non-secure contexts (LAN dev).
function makeSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Debounced city autocomplete. `value` is the display string; `onSelect`
// fires with the full resolved record (name + lat/lng + tz) once the user
// picks a prediction. `birthTimestamp` (seconds since epoch) — passed
// through so the timezone offset is correct for the birth date.
export default function CitySearch({
  value,
  onSelect,
  birthTimestamp,
  placeholder = "Search your birth city...",
}) {
  const [input, setInput] = useState(value || "");
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef(makeSessionToken());
  const wrapRef = useRef(null);

  // Keep input in sync if the parent resets `value` (e.g. on form clear).
  useEffect(() => {
    setInput(value || "");
  }, [value]);

  // Debounced autocomplete — wait 300ms after the last keystroke before firing.
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setPredictions([]);
      return;
    }
    if (q === (value || "").trim()) return; // already selected, don't re-search
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCities(q, sessionTokenRef.current);
        setPredictions(res);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, value]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function pick(prediction) {
    setOpen(false);
    setInput(prediction.description);
    try {
      const details = await getCityDetails(prediction.placeId, sessionTokenRef.current, birthTimestamp);
      // Rotate sessiontoken — sessions end after Place Details is called.
      sessionTokenRef.current = makeSessionToken();
      onSelect({
        city: details.searchName,
        lat: details.coordinates.lat,
        lon: details.coordinates.lng,
        tz: details.timezone.offset,
        tzId: details.timezone.id,
        placeId: details.placeId,
      });
    } catch (err) {
      console.error("[CitySearch] details lookup failed:", err);
      onSelect(null, err.message || "Location lookup failed");
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="premium-input"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => predictions.length && setOpen(true)}
        autoComplete="off"
      />
      {open && (predictions.length > 0 || loading) && (
        <ul style={dropdownStyle}>
          {loading && <li style={hintStyle}>Searching…</li>}
          {predictions.map((p) => (
            <li
              key={p.placeId}
              style={itemStyle}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
            >
              <div style={{ fontSize: 14, color: "#fff" }}>{p.mainText || p.description}</div>
              {p.secondaryText && <div style={{ fontSize: 11, color: "#888" }}>{p.secondaryText}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dropdownStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 4,
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 8,
  listStyle: "none",
  padding: 0,
  maxHeight: 240,
  overflowY: "auto",
  zIndex: 50,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};
const itemStyle = {
  padding: "10px 14px",
  cursor: "pointer",
  borderBottom: "1px solid #2a2a3e",
};
const hintStyle = {
  padding: "10px 14px",
  fontSize: 13,
  color: "#888",
};
