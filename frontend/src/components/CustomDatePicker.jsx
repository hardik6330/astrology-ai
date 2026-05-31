import React, { useState, useEffect, useRef } from "react";
import { color, gradient, radius, shadow } from "../theme/tokens.js";

function CustomDatePicker({ value, onChange, max }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("days"); // 'days', 'months', 'years'
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update current month when value changes
  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  const parseValue = () => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 100; y--) {
      years.push(y);
    }
    return years;
  };

  const handleSelect = (date) => {
    onChange(formatDate(date));
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    handleSelect(today);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelectMonth = (month) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month, 1));
    setView("days");
  };

  const handleSelectYear = (year) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setView("months");
  };

  const selectedDate = parseValue();
  const days = getDaysInMonth(currentMonth);
  const years = getYears();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const shortMonthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const isDateDisabled = (date) => {
    if (!max || !date) return false;
    const maxDate = new Date(max);
    maxDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate > maxDate;
  };

  const isDateSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (month) => {
    const today = new Date();
    return today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === month;
  };

  const isCurrentYear = (year) => {
    return new Date().getFullYear() === year;
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        className="premium-input"
        value={
          value
            ? new Date(value).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : ""
        }
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        placeholder="dd/mm/yyyy"
        style={{ cursor: "pointer" }}
      />
      <div
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          color: color.textDim,
          pointerEvents: "none",
          fontSize: "14px",
        }}
      >
        📅
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
            padding: 16,
            boxShadow: shadow.card,
            zIndex: 1000,
            backdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          {view === "days" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <button
                onClick={handlePrevMonth}
                style={{
                  background: "transparent",
                  border: "none",
                  color: color.text,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: radius.sm,
                  fontSize: 18,
                }}
              >
                ←
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setView("months")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: color.text,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: radius.sm,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {shortMonthNames[currentMonth.getMonth()]}
                </button>
                <button
                  onClick={() => setView("years")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: color.text,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: radius.sm,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {currentMonth.getFullYear()}
                </button>
              </div>

              <button
                onClick={handleNextMonth}
                style={{
                  background: "transparent",
                  border: "none",
                  color: color.text,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: radius.sm,
                  fontSize: 18,
                }}
              >
                →
              </button>
            </div>
          )}

          {view === "months" && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setView("years")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: color.text,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: radius.sm,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {currentMonth.getFullYear()}
              </button>
            </div>
          )}

          {view === "years" && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  color: color.primary,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                Select Year
              </span>
            </div>
          )}

          {/* Days View */}
          {view === "days" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {dayNames.map((day, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: color.textDim,
                      fontWeight: 600,
                      padding: "4px 0",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                }}
              >
                {days.map((date, i) => (
                  <button
                    key={i}
                    onClick={() => date && !isDateDisabled(date) && handleSelect(date)}
                    disabled={!date || isDateDisabled(date)}
                    style={{
                      aspectRatio: "1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border:
                        isToday(date) && !isDateSelected(date) ? `1px solid ${color.primaryBorder}` : "none",
                      borderRadius: radius.sm,
                      background: isDateSelected(date) ? gradient.magic : "transparent",
                      boxShadow: isDateSelected(date) ? shadow.magic : "none",
                      color: isDateSelected(date)
                        ? "#fff"
                        : isDateDisabled(date)
                          ? color.textFaint
                          : isToday(date)
                            ? color.primary
                            : color.text,
                      cursor: date && !isDateDisabled(date) ? "pointer" : "default",
                      fontSize: 13,
                      fontWeight: isToday(date) || isDateSelected(date) ? 700 : 400,
                      opacity: isDateDisabled(date) ? 0.4 : 1,
                      transition: "all 0.2s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (date && !isDateDisabled(date) && !isDateSelected(date)) {
                        e.currentTarget.style.background = "rgba(168, 85, 247, 0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (date && !isDateDisabled(date) && !isDateSelected(date)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {date ? (
                      <>
                        <span>{date.getDate()}</span>
                        {isToday(date) && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "4px",
                              width: "4px",
                              height: "4px",
                              borderRadius: "50%",
                              background: isDateSelected(date) ? "#fff" : color.primary,
                              boxShadow: isDateSelected(date) ? "none" : `0 0 8px ${color.primary}`,
                            }}
                          />
                        )}
                      </>
                    ) : (
                      ""
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Months View */}
          {view === "months" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {shortMonthNames.map((month, i) => {
                const isSelected =
                  selectedDate &&
                  selectedDate.getMonth() === i &&
                  selectedDate.getFullYear() === currentMonth.getFullYear();
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectMonth(i)}
                    style={{
                      padding: "12px 8px",
                      border: "none",
                      borderRadius: radius.md,
                      background: isSelected ? gradient.magic : "transparent",
                      color: isSelected ? "#fff" : isCurrentMonth(i) ? color.primary : color.text,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: isCurrentMonth(i) ? 700 : 500,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(168, 85, 247, 0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          )}

          {/* Years View */}
          {view === "years" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 8,
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {years.map((year) => {
                const isSelected = selectedDate && selectedDate.getFullYear() === year;
                return (
                  <button
                    key={year}
                    onClick={() => handleSelectYear(year)}
                    style={{
                      padding: "10px 6px",
                      border: "none",
                      borderRadius: radius.md,
                      background: isSelected ? gradient.magic : "transparent",
                      color: isSelected ? "#fff" : isCurrentYear(year) ? color.primary : color.text,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: isCurrentYear(year) ? 700 : 500,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(168, 85, 247, 0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}

          {/* Today Button */}
          {view === "days" && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button
                onClick={handleToday}
                disabled={isDateDisabled(new Date())}
                style={{
                  background: "transparent",
                  border: `1px solid ${color.primaryBorder}`,
                  color: color.primaryLight,
                  padding: "8px 24px",
                  borderRadius: radius.pill,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  transition: "all 0.3s ease",
                  opacity: isDateDisabled(new Date()) ? 0.4 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (!isDateDisabled(new Date())) {
                    e.currentTarget.style.background = color.primarySoft;
                    e.currentTarget.style.borderColor = color.primary;
                    e.currentTarget.style.boxShadow = `0 0 15px ${color.primarySoft}`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = color.primaryBorder;
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span style={{ fontSize: "14px" }}>✨</span> Today (
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomDatePicker;
