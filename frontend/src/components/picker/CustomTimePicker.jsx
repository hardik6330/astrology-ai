import { useState, useEffect, useRef } from "react";
import { color, gradient, radius, shadow } from "@/theme/tokens.js";
import { Icon } from "@/utils/icons";

// One scrollable column (hour / minute / am-pm). Module-level + stable so React
// reconciles it in place on every pick — inlining it would remount the scroll
// container and snap the list back to the top. On open it centers the selected
// value once (didInit guard) so e.g. 11:40 opens scrolled to 11 and 40.
function Column({ title, items, current, onSelect, type, open }) {
  const containerRef = useRef(null);
  const selectedRef = useRef(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (!open) {
      didInit.current = false; // reset so it re-centers next time it opens
      return;
    }
    if (didInit.current) return;
    const c = containerRef.current;
    const sel = selectedRef.current;
    if (!c || !sel) return;
    didInit.current = true;
    // offsetTop is relative to the (position:relative) scroll container, so it
    // maps directly onto scrollTop. Center the selected row in the viewport.
    c.scrollTop = sel.offsetTop - c.clientHeight / 2 + sel.clientHeight / 2;
  }, [open, current]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        maxHeight: "200px",
        overflowY: "auto",
        flex: 1,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: color.textDim,
          marginBottom: "8px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "1px",
          position: "sticky",
          top: 0,
          background: "rgba(15, 14, 32, 0.98)",
          width: "100%",
          textAlign: "center",
          paddingBottom: "4px",
          zIndex: 1,
        }}
      >
        {title}
      </div>
      {items.map((item) => {
        const isSelected = current === item;
        return (
          <button
            key={item}
            ref={isSelected ? selectedRef : null}
            onClick={() => onSelect(item)}
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              background: isSelected ? gradient.magic : "transparent",
              color: isSelected ? "#fff" : color.text,
              borderRadius: radius.sm,
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: isSelected ? "700" : "400",
              transition: "all 0.2s ease",
              marginBottom: "2px",
              flexShrink: 0,
            }}
          >
            {type === "minute" ? String(item).padStart(2, "0") : item}
          </button>
        );
      })}
    </div>
  );
}

function CustomTimePicker({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value (HH:mm)
  const getInitialTime = () => {
    if (!value) return { h: 12, m: 0, ampm: "AM" };
    const [h24, m] = value.split(":").map(Number);
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return { h: h12, m: m, ampm };
  };

  const [time, setTime] = useState(getInitialTime());

  useEffect(() => {
    setTime(getInitialTime());
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (newTime) => {
    if (disabled) return;
    const updated = { ...time, ...newTime };
    setTime(updated);

    // Convert to 24h format for parent
    let h24 = updated.h % 12;
    if (updated.ampm === "PM") h24 += 12;
    const formatted = `${String(h24).padStart(2, "0")}:${String(updated.m).padStart(2, "0")}`;
    onChange(formatted);
  };

  const handleNow = () => {
    if (disabled) return;
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    handleSelect({ h: h12, m, ampm });
  };

  const displayValue = () => {
    if (!value) return "";
    const { h, m, ampm } = getInitialTime();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        className="premium-input"
        value={displayValue()}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        readOnly
        placeholder="--:-- --"
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          backgroundColor: disabled ? "rgba(255,255,255,0.03)" : undefined,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          color: color.textDim,
          pointerEvents: "none",
          display: "flex",
          opacity: disabled ? 0.3 : 1,
        }}
      >
        <Icon name="CLOCK" size={14} />
      </div>

      {!disabled && isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 8,
            background: "rgba(15, 14, 32, 0.98)",
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.lg,
            padding: "16px 8px",
            boxShadow: shadow.card,
            zIndex: 1000,
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <Column
              title="Hour"
              items={hours}
              current={time.h}
              onSelect={(h) => handleSelect({ h })}
              open={isOpen}
            />
            <div style={{ width: "1px", background: color.cardBorder, margin: "10px 0" }} />
            <Column
              title="Min"
              items={minutes}
              current={time.m}
              onSelect={(m) => handleSelect({ m })}
              type="minute"
              open={isOpen}
            />
            <div style={{ width: "1px", background: color.cardBorder, margin: "10px 0" }} />
            <Column
              title="AM/PM"
              items={["AM", "PM"]}
              current={time.ampm}
              onSelect={(ampm) => handleSelect({ ampm })}
              open={isOpen}
            />
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${color.cardBorder}`,
              textAlign: "center",
            }}
          >
            <button
              onClick={handleNow}
              style={{
                background: "transparent",
                border: `1px solid ${color.primaryBorder}`,
                color: color.primaryLight,
                padding: "6px 16px",
                borderRadius: radius.pill,
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                transition: "all 0.3s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = color.primarySoft;
                e.currentTarget.style.borderColor = color.primary;
                e.currentTarget.style.boxShadow = `0 0 12px ${color.primarySoft}`;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = color.primaryBorder;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <Icon name="SPARKLES" size={12} /> Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomTimePicker;
