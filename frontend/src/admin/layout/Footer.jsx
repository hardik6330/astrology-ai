// Footer bar — static copyright line pinned to the bottom of the content column.

export default function Footer() {
  return (
    <footer className="shrink-0 border-t border-(--c-border-soft) px-6 py-3.5 text-center text-xs text-muted">
      © {YEAR} Astrology AI Pro · Admin Console
    </footer>
  );
}

// Computed once at module load — avoids a per-render Date() and keeps the year
// stable for the session.
const YEAR = new Date().getFullYear();
