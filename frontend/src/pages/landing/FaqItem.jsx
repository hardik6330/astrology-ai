// FAQ accordion item (controlled, animated grid-rows expand/collapse).
import { useState } from "react";
import { LuPlus } from "react-icons/lu";

export default function FaqItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-bold text-ink">{q}</span>
        <LuPlus
          className={`shrink-0 text-lg text-primary transition-transform duration-300 ${open ? "rotate-45" : ""}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm text-body">{a}</p>
        </div>
      </div>
    </div>
  );
}
