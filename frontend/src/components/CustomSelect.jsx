import React, { useState, useEffect, useRef } from "react";
import { color, gradient, radius, shadow } from "../theme/tokens.js";

function CustomSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        className="premium-input"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: "48px",
        }}
      >
        <span style={{ color: selectedOption ? color.text : color.textMuted }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          style={{
            color: color.textDim,
            fontSize: "12px",
            transition: "transform 0.3s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && (
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
            padding: "8px",
            boxShadow: shadow.card,
            zIndex: 1000,
            backdropFilter: "blur(12px)",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                style={{
                  padding: "12px 16px",
                  borderRadius: radius.md,
                  cursor: "pointer",
                  background: isSelected ? gradient.magic : "transparent",
                  color: isSelected ? "#fff" : color.text,
                  fontSize: "14px",
                  fontWeight: isSelected ? "600" : "400",
                  transition: "all 0.2s ease",
                  marginBottom: "2px",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "rgba(168, 85, 247, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
