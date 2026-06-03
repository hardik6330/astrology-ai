import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { computeChart } from "@/shared/astrology";
import { useChart } from "../context/ChartContext";
import CitySearch from "../components/CitySearch";
import CustomDatePicker from "@/components/picker/CustomDatePicker";
import CustomTimePicker from "@/components/picker/CustomTimePicker";
import CustomSelect from "../components/CustomSelect";
import Card from "@/common/Card";
import Button from "@/common/Button";

import { EMOJIS } from "@/utils/emojis";

const lbl = "mb-1 block text-[13px] text-[#888]";

// Landing page — the birth-detail form. On submit it computes the chart
// and routes to the protected /reading page.
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, setForm, chart, setChart, setInterp, setDaily, setChatMsgs } = useChart();
  const [error, setError] = useState("");

  // Returning user: if ChartContext already has a chart, skip the form and
  // land on Reading. Suppressed when the user explicitly came here to edit
  // (e.g. "New Reading" / "Update Birth Details" pass `state.edit = true`).
  const editMode = !!location.state?.edit;
  useEffect(() => {
    if (chart && !editMode) navigate("/reading", { replace: true });
  }, [chart, editMode, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Today in local YYYY-MM-DD — used as the <input type=date> max attribute
  // and the defensive check below. Built locally (not via toISOString) so
  // users near midnight in non-UTC zones don't see "tomorrow" disallowed.
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // Seconds-since-epoch at the user's local birth instant — passed to the
  // Time Zone API so the offset returned is correct for the birth date
  // (handles historical DST rule changes). Only valid once both date & time
  // are filled; until then we omit it and Google returns "current" offset.
  const birthTimestamp = (() => {
    if (!form.date || !form.time) return null;
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d, hh || 0, mm || 0) / 1000);
  })();

  function onCitySelected(picked, errMsg) {
    if (errMsg) {
      setError(errMsg);
      return;
    }
    if (!picked) return;
    setError("");
    setForm((f) => ({
      ...f,
      city: picked.city,
      lat: picked.lat,
      lon: picked.lon,
      tz: picked.tz,
      tzId: picked.tzId,
      placeId: picked.placeId,
    }));
  }

  function generate() {
    if (!form.date || !form.time || !form.city) {
      setError("All fields are required!");
      return;
    }
    if (form.date > today) {
      setError("Birth date can't be in the future.");
      return;
    }
    if (form.lat == null || form.lon == null || form.tz == null) {
      setError("Please pick your city from the suggestions.");
      return;
    }
    setError("");
    try {
      const ch = computeChart(form.date, form.time, {
        n: form.city,
        lat: form.lat,
        lon: form.lon,
        tz: form.tz,
      });
      setChart(ch);
      setInterp(null);
      setDaily(null);
      setChatMsgs([]);
      // Funnel through the optional palm-reading step before kundali.
      navigate("/palm-step");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="relative mx-auto max-w-180 px-4 py-8">
      <div className="cosmos"></div>
      <div className="stars"></div>
      <div className="shooting-star"></div>

      {/* cosmic-card's bottom margin (unlayered) is overridden inline. */}
      <Card className="text-center" style={{ marginBottom: "2.5rem" }}>
        <h2 className="m-0 mb-2 bg-linear-to-r from-white to-[#a855f7] bg-clip-text text-[28px] font-bold text-transparent">
          {EMOJIS.SPARKLES} AI Kundali Insights {EMOJIS.SPARKLES}
        </h2>
        <p className="m-0 text-sm tracking-[0.5px] text-[#aaa]">
          Precision Astronomy + Celestial Intelligence
        </p>
      </Card>

      <Card>
        <div className="grid gap-4">
          <div className="grid-name-gender">
            <div>
              <label className={lbl}>Full Name</label>
              <input
                className="premium-input"
                placeholder="Enter name..."
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label className={lbl}>Gender</label>
              <CustomSelect
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                placeholder="— optional —"
                options={[
                  { label: "Male", value: "Male" },
                  { label: "Female", value: "Female" },
                  { label: "Other", value: "Other" },
                ]}
              />
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label className={lbl}>Birth Date</label>
              <CustomDatePicker value={form.date} max={today} onChange={(val) => set("date", val)} />
            </div>
            <div>
              <label className={lbl}>Birth Time</label>
              <CustomTimePicker
                value={form.time}
                onChange={(val) => set("time", val)}
                disabled={form.unknownTime}
              />
            </div>
          </div>

          <div className="my-1 flex items-center gap-2.5">
            <input
              type="checkbox"
              id="unknownTime"
              checked={form.unknownTime || false}
              onChange={(e) => {
                const checked = e.target.checked;
                set("unknownTime", checked);
                if (checked) {
                  set("time", "12:00");
                  setError("");
                }
              }}
              className="h-4.5 w-4.5 cursor-pointer accent-[#a855f7]"
            />
            <label htmlFor="unknownTime" className="cursor-pointer text-sm text-[#aaa] select-none">
              I don't know my exact birth time
            </label>
          </div>

          <div>
            <label className={lbl}>Birth City</label>
            <CitySearch value={form.city} birthTimestamp={birthTimestamp} onSelect={onCitySelected} />
          </div>
          <Button variant="magic" onClick={generate} fullWidth className="mt-2">
            Reveal My Destiny {EMOJIS.ARROW_UP_RIGHT}
          </Button>
        </div>
      </Card>

      {error && (
        // cosmic-card border/bg overridden inline (it's unlayered).
        <Card style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p className="m-0 text-sm text-danger">
            {EMOJIS.WARNING} {error}
          </p>
        </Card>
      )}
    </div>
  );
}
