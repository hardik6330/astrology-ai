import React, { useState } from "react";
import PickerModal from "./PickerModal";
import { PickerColumn, Divider } from "./PickerColumn";

// Day / Month / Year wheel picker. Value + onSelect use "YYYY-MM-DD".
export default function CosmicDatePicker({ visible, value, onClose, onSelect, maxDate }) {
  const getInitial = () => {
    if (!value) return { y: new Date().getFullYear(), m: new Date().getMonth() + 1, d: new Date().getDate() };
    const [y, m, d] = value.split("-").map(Number);
    return { y, m, d };
  };

  const [date, setDate] = useState(getInitial());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const days = Array.from({ length: getDaysInMonth(date.y, date.m) }, (_, i) => i + 1);

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    onSelect(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    onClose();
  };

  const handleConfirm = () => {
    onSelect(`${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`);
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
      <PickerColumn items={days}   current={date.d} onPick={(d) => setDate((p) => ({ ...p, d }))} flex={0.8} />
      <Divider />
      <PickerColumn items={months} current={date.m} onPick={(m) => setDate((p) => ({ ...p, m }))} flex={0.8} />
      <Divider />
      <PickerColumn items={years}  current={date.y} onPick={(y) => setDate((p) => ({ ...p, y }))} flex={1.2} />
    </PickerModal>
  );
}
