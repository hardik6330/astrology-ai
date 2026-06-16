// Shared "nothing to show" block for the admin pages — covers both an empty
// response (data loaded, but no rows) and a load error. Renders just the
// centered icon + title + message; the caller wraps it in a <Card> (card pages)
// or a colSpan <td> (table pages) as needed.

import { LuInbox, LuTriangleAlert } from "react-icons/lu";

export default function AdminEmptyState({ variant = "empty", title, message, className = "" }) {
  const isError = variant === "error";
  const Icon = isError ? LuTriangleAlert : LuInbox;
  const heading = title || (isError ? "Couldn't load data" : "No data found");
  const fallbackMsg = isError
    ? "Something went wrong fetching this data. Check your connection and try again."
    : "There's nothing here yet.";

  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <Icon size={40} className={`mb-3 ${isError ? "text-red-400" : "text-muted"}`} />
      <p className="m-0 text-base font-semibold text-ink">{heading}</p>
      <p className="mx-0 mt-1.5 mb-0 max-w-md text-[13px] text-muted leading-relaxed">
        {message || fallbackMsg}
      </p>
    </div>
  );
}
