import React, { useState } from "react";
import PickerModal from "./PickerModal";
import { PickerColumn, Divider } from "./PickerColumn";

const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();

// Day / Month / Year wheel picker. Value + onSelect use "YYYY-MM-DD".
// maxDate ("YYYY-MM-DD") caps the latest selectable date — defaults to today so
// a birth date can never be in the future. Months/days past the cap are hidden,
// and any pick that would land in the future is clamped back to the cap.
export default function CosmicDatePicker({ visible, value, onClose, onSelect, maxDate }) {
  // Upper bound, parsed once. Falls back to today.
  const max = (() => {
    if (maxDate) {
      const [y, m, d] = maxDate.split("-").map(Number);
      return { y, m, d };
    }
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  })();

  const getInitial = () => {
    if (!value) return { y: max.y, m: max.m, d: max.d };
    const [y, m, d] = value.split("-").map(Number);
    return clamp({ y, m, d });
  };

  // Pull any selection back inside the [.., max] range so the wheels never hold
  // a future value (e.g. switching to the current year while month is December).
  function clamp({ y, m, d }) {
    if (y > max.y) y = max.y;
    if (y === max.y && m > max.m) m = max.m;
    let dim = getDaysInMonth(y, m);
    if (y === max.y && m === max.m) dim = Math.min(dim, max.d);
    if (d > dim) d = dim;
    return { y, m, d };
  }

  const [date, setDate] = useState(getInitial());
  const pick = (patch) => setDate((p) => clamp({ ...p, ...patch }));

  // Years descend from the cap year — no future years ever appear.
  const years = Array.from({ length: 120 }, (_, i) => max.y - i);
  // In the cap year, only months up to the cap month; otherwise all 12.
  const monthCount = date.y === max.y ? max.m : 12;
  const months = Array.from({ length: monthCount }, (_, i) => i + 1);
  // In the cap month of the cap year, only days up to the cap day.
  const dayCount =
    date.y === max.y && date.m === max.m
      ? max.d
      : getDaysInMonth(date.y, date.m);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const handleToday = () => {
    onSelect(`${max.y}-${String(max.m).padStart(2, "0")}-${String(max.d).padStart(2, "0")}`);
    onClose();
  };

  const handleConfirm = () => {
    const c = clamp(date);
    onSelect(`${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`);
    onClose();
  };

  return (
    <PickerModal
      visible={visible}
      title="Birth Date"
      onClose={onClose}
      secondaryLabel="✨ Today"
      onSecondary={handleToday}
      onConfirm={handleConfirm}
    >
      <PickerColumn items={days}   current={date.d} onPick={(d) => pick({ d })} flex={0.8} />
      <Divider />
      <PickerColumn items={months} current={date.m} onPick={(m) => pick({ m })} flex={0.8} />
      <Divider />
      <PickerColumn items={years}  current={date.y} onPick={(y) => pick({ y })} flex={1.2} />
    </PickerModal>
  );
}
