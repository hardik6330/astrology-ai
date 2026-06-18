// Searchable country-code selector for the login form. Shows the selected
// country's flag + "+<dial>"; tapping it opens a popover with a search box that
// filters by country name or dial code (e.g. "india" → 🇮🇳 +91). Selecting a
// row sets the dial code on the parent. Pure-CSS popover, no extra deps.

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES } from "@/utils/dialCode";

export default function CountrySelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // The country whose dial code matches the current value (longest match wins,
  // so "1268" beats "1"). Falls back to a bare flag when nothing matches.
  const selected = useMemo(() => {
    const code = String(value || "").replace(/\D/g, "");
    if (!code) return null;
    return COUNTRIES.filter((c) => c.dial === code).sort((a, b) => a.name.localeCompare(b.name))[0] || null;
  }, [value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/\D/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || (digits && c.dial.startsWith(digits))
    );
  }, [query]);

  // Close on outside click / Esc; focus the search box when opening.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(c) {
    onChange(c.dial);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label="Select country code"
        className="flex h-full items-center gap-1.5 rounded-l-[10px] py-3 pl-3.5 pr-2.5 text-sm text-ink outline-none disabled:opacity-60"
      >
        <span className="text-base leading-none">{selected ? selected.flag : "🌐"}</span>
        <span className="font-semibold">+{value || "?"}</span>
        <svg width="10" height="10" viewBox="0 0 10 6" className="opacity-60" aria-hidden>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-72 overflow-hidden rounded-xl border border-(--c-border) bg-[rgba(var(--panel-rgb),0.98)] shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-[8px]">
          <div className="border-b border-(--c-border) p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country…"
              className="w-full rounded-lg border border-(--c-border) bg-(--c-input-bg) px-3 py-2 text-sm text-ink outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {results.length === 0 && <li className="px-3.5 py-3 text-center text-xs text-dim">No matches</li>}
            {results.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink hover:bg-[rgba(167,139,250,0.12)] ${
                    selected?.iso === c.iso ? "bg-[rgba(167,139,250,0.16)]" : ""
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-semibold text-dim">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
