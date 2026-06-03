// Section header for back-office pages: title (+ optional muted count), an
// optional subtitle, and an optional right-aligned `action` node (search box,
// button…).
//
// Usage:
//   <PageHeader title="Users" count={42} action={<SearchBox/>} />
//   <PageHeader title="Push Notification" subtitle="Broadcast to all devices" />
//
// Tailwind template: utility classes map to the @theme palette (text-ink,
// text-muted, text-dim) in index.css — no per-file style consts.

export default function PageHeader({ title, count, subtitle, action }) {
  return (
    <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="m-0 text-xl font-bold text-ink">
          {title}
          {count != null && <span className="text-[15px] font-normal text-muted"> ({count})</span>}
        </h2>
        {subtitle && <p className="mt-1 mb-0 text-[13px] text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
