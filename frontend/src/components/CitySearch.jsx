import { useEffect, useRef, useState } from "react";
import { useCitySearch, lookupCityDetails } from "@/features/location/hooks";
import { color, gradient, radius, shadow } from "../theme/tokens.js";

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
  const [open, setOpen] = useState(false);
  const sessionTokenRef = useRef(makeSessionToken());
  const wrapRef = useRef(null);

  // Suppress search when the input still equals the most-recently picked
  // value — prevents a needless autocomplete call right after selection.
  const querySuppressed = input.trim() === (value || "").trim();
  const { data: predictions = [], isFetching: loading } = useCitySearch(
    querySuppressed ? "" : input,
    sessionTokenRef.current
  );

  // Keep input in sync if the parent resets `value` (e.g. on form clear).
  useEffect(() => {
    setInput(value || "");
  }, [value]);

  // Open the dropdown when results land.
  useEffect(() => {
    if (predictions.length > 0) setOpen(true);
  }, [predictions]);

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
      const details = await lookupCityDetails(prediction.placeId, sessionTokenRef.current, birthTimestamp);
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
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 8,
            background: "rgba(15, 14, 32, 0.98)",
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.lg,
            listStyle: "none",
            padding: 8,
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: shadow.card,
            backdropFilter: "blur(12px)",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`
            ul::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {loading && (
            <li style={{ padding: "12px 16px", fontSize: 13, color: color.textDim }}>Searching…</li>
          )}
          {predictions.map((p) => (
            <li
              key={p.placeId}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderRadius: radius.md,
                transition: "all 0.2s ease",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(168, 85, 247, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ fontSize: 14, color: color.text, fontWeight: 500 }}>
                {p.mainText || p.description}
              </div>
              {p.secondaryText && (
                <div style={{ fontSize: 11, color: color.textDim, marginTop: 2 }}>{p.secondaryText}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
