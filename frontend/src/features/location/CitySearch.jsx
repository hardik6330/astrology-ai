import { useEffect, useRef, useState, useMemo } from "react";
import { useCitySearch, lookupCityDetails } from "./hooks";
import { color, radius, shadow } from "../../theme/tokens.js";
import { Spinner } from "@/common/Loading";

// Generate a UUID for the Places sessiontoken. Browser-native crypto when
// available; tiny fallback for old browsers / non-secure contexts (LAN dev).
// Generate a UUID for the Places sessiontoken.
const genUUID = () => {
  try {
    return self.crypto.randomUUID();
  } catch (_) {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

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
  const sessionToken = useMemo(() => genUUID(), []);
  const wrapRef = useRef(null);

  // Suppress search when the input still equals the most-recently picked
  // value — prevents a needless autocomplete call right after selection.
  const querySuppressed = input.trim() === (value || "").trim();
  const { data: predictions = [], isFetching: loading } = useCitySearch(
    querySuppressed ? "" : input,
    sessionToken
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
      const details = await lookupCityDetails(prediction.placeId, sessionToken, birthTimestamp);
      // Note: sessiontoken is fixed for this component lifecycle in this version.
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
      <div style={{ position: "relative" }}>
        <input
          className="premium-input"
          style={{ paddingRight: 40 }}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => predictions.length && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Spinner size={20} />
          </div>
        )}
      </div>
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
            <li
              style={{
                padding: "12px 16px",
                fontSize: 13,
                color: color.textDim,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Spinner size={16} />
              Searching for "{input}"…
            </li>
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
