import React, { useState } from "react";
import PickerModal from "./PickerModal";
import { PickerColumn, Divider } from "./PickerColumn";

// Hour / Minute / AM-PM wheel picker. Value + onSelect use 24h "HH:mm".
export default function CosmicTimePicker({ visible, value, onClose, onSelect }) {
  const getInitial = () => {
    if (!value) return { h: 12, m: 0, ampm: "AM" };
    const [h24, m] = value.split(":").map(Number);
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return { h: h12, m, ampm };
  };

  const [time, setTime] = useState(getInitial());

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleNow = () => {
    const now = new Date();
    onSelect(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    onClose();
  };

  const handleConfirm = () => {
    let h24 = time.h % 12;
    if (time.ampm === "PM") h24 += 12;
    onSelect(`${String(h24).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`);
    onClose();
  };

  return (
    <PickerModal
      visible={visible}
      title="Birth Time"
      onClose={onClose}
      secondaryLabel="✨ Now"
      onSecondary={handleNow}
      onConfirm={handleConfirm}
    >
      <PickerColumn items={hours}   current={time.h} onPick={(h) => setTime((p) => ({ ...p, h }))} />
      <Divider />
      <PickerColumn items={minutes} current={time.m} onPick={(m) => setTime((p) => ({ ...p, m }))} format={(i) => String(i).padStart(2, "0")} />
      <Divider />
      <PickerColumn items={["AM", "PM"]} current={time.ampm} onPick={(ampm) => setTime((p) => ({ ...p, ampm }))} />
    </PickerModal>
  );
}
