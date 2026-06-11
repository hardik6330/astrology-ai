// Loading skeletons for the admin panel. A skeleton mirrors the SHAPE of the
// content it stands in for (same table columns, same card grid) so the layout
// doesn't jump when real data arrives — calmer than a centered spinner.
//
// Base `Skeleton` is a pulsing rounded block; the rest compose it into the
// table-row and stat-card shapes the admin pages use.

import Card from "./Card";

// A single shimmering block. Width/height via Tailwind classes in `className`
// (e.g. "h-4 w-24"); falls back to a full-width line.
export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} aria-hidden="true" />;
}

// `rows` × `cols` of placeholder table cells, for use inside an existing
// <tbody>. Column widths vary a little so it reads as data, not a grid.
export function SkeletonRows({ rows = 6, cols = 5 }) {
  const tdClass = "border-b border-[rgba(var(--slate-rgb),0.08)] px-4 py-3";
  // Deterministic per-column widths (no Math.random — keeps renders stable).
  const widths = ["w-28", "w-24", "w-12", "w-20", "w-16", "w-24", "w-20", "w-32"];
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} className={tdClass}>
          <Skeleton className={`h-3.5 ${widths[c % widths.length]}`} />
        </td>
      ))}
    </tr>
  ));
}

// A grid of stat-card skeletons matching AdminDashboard's card layout.
export function SkeletonCards({ count = 5 }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} style={{ padding: 20, marginBottom: 0 }}>
          <Skeleton className="mb-3.5 h-10 w-10 rounded-[10px]" />
          <Skeleton className="mb-2 h-7 w-20" />
          <Skeleton className="h-3.5 w-24" />
        </Card>
      ))}
    </div>
  );
}

export default Skeleton;
