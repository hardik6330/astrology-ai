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
import Loading from "@/common/Loading";

import { saveProfile } from "@/services/api";
import { EMOJIS } from "@/utils/emojis";

const lbl = "mb-1 block text-[13px] text-[#888]";
const errLbl = "mt-1 mb-0 text-[12px] text-danger";

// Landing page — the birth-detail form. On submit it computes the chart
// and routes to the protected /reading page.
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, setForm, chart, setChart, setInterp, setDaily, setChatMsgs, hydrating } = useChart();
  const [error, setError] = useState("");
  // Per-field errors keyed by field name (name/date/time/city). Cleared as
  // soon as the user fixes that field.
  const [fieldErrors, setFieldErrors] = useState({});

  // Returning user: if ChartContext already has a chart, skip the form and
  // land on Reading. Suppressed when the user explicitly came here to edit
  // (e.g. "New Reading" / "Update Birth Details" pass `state.edit = true`).
  const editMode = !!location.state?.edit;
  useEffect(() => {
    if (chart && !editMode) navigate("/reading", { replace: true });
  }, [chart, editMode, navigate]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear this field's error the moment it gets a value.
    if (v) setFieldErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

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
    setFieldErrors((e) => (e.city ? { ...e, city: "" } : e));
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
    // Collect an error per required field so each one is flagged individually.
    const fe = {};
    if (!form.name?.trim()) fe.name = "Name is required.";
    if (!form.date) fe.date = "Birth date is required.";
    else if (form.date > today) fe.date = "Birth date can't be in the future.";
    if (!form.time) fe.time = "Birth time is required.";
    if (!form.city?.trim()) fe.city = "Birth city is required.";
    else if (form.lat == null || form.lon == null || form.tz == null)
      fe.city = "Please pick your city from the suggestions.";

    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      setError("Please fill in all required fields.");
      return;
    }
    setFieldErrors({});
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
      // Persist birth details onto the user row now, the moment they're
      // entered — don't wait for a reading to be generated. Fire-and-forget:
      // a failure here must never block the user's flow.
      saveProfile(form);
      // Funnel through the optional palm-reading step before kundali.
      navigate("/palm-step");
    } catch (e) {
      setError(e.message);
    }
  }

  // Returning user whose saved form is still loading — show a splash instead
  // of the empty form, so we don't flash it before redirecting to /reading.
  if (hydrating) return <Loading minHeight="100vh" />;

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
              {fieldErrors.name && <p className={errLbl}>{fieldErrors.name}</p>}
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
              {fieldErrors.date && <p className={errLbl}>{fieldErrors.date}</p>}
            </div>
            <div>
              <label className={lbl}>Birth Time</label>
              <CustomTimePicker
                value={form.time}
                onChange={(val) => set("time", val)}
                disabled={form.unknownTime}
              />
              {fieldErrors.time && <p className={errLbl}>{fieldErrors.time}</p>}
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
            {fieldErrors.city && <p className={errLbl}>{fieldErrors.city}</p>}
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
