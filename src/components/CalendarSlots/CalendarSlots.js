import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import "./CalendarSlots.css";

const HOUR_START = 5;
const HOUR_END = 23;
const STEP_MINUTES = 30;
const slotDate = (unix) => new Date(Number(unix) * 1000);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const timeKey = (date) => `${date.getHours()}:${date.getMinutes()}`;
const dayLabel = (date) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric" }).format(date);
const timeLabel = (date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const statusValue = (slot) => String(slot?.status || slot?.slot_status || "available").toLowerCase().replaceAll("_", "");
const isBooked = (slot) => /book|reserved|held/.test(statusValue(slot));

const weekBounds = (start) => {
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { startUnix: Math.floor(from.getTime() / 1000), endUnix: Math.floor(to.getTime() / 1000) };
};

export default function CalendarSlots({ slots = [], selectedSlot, onSelect, loadSlots, title = "Choose a meeting time", description = "Green slots are available, red slots are already booked, and past times are faded.", compact = false }) {
  const [start, setStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  });
  const [visibleSlots, setVisibleSlots] = useState(slots);
  const [loading, setLoading] = useState(Boolean(loadSlots));
  const [loadError, setLoadError] = useState("");
  const loadSlotsRef = useRef(loadSlots);
  loadSlotsRef.current = loadSlots;

  useEffect(() => {
    if (!loadSlotsRef.current) return;
    let cancelled = false;
    const { startUnix, endUnix } = weekBounds(start);
    setLoading(true);
    setLoadError("");
    Promise.resolve(loadSlotsRef.current(startUnix, endUnix))
      .then((result) => {
        if (!cancelled) setVisibleSlots(result?.slots || result || []);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error?.message || "We couldn't load this week's availability.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [start]);

  useEffect(() => {
    if (!loadSlots) setVisibleSlots(slots || []);
  }, [loadSlots, slots]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; }), [start]);
  const rows = useMemo(() => Array.from({ length: ((HOUR_END - HOUR_START) * 60) / STEP_MINUTES }, (_, index) => { const minutes = HOUR_START * 60 + index * STEP_MINUTES; return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60); }), []);
  const byKey = useMemo(() => visibleSlots.reduce((map, slot) => {
    const date = slotDate(slot.start_unix);
    map[`${dateKey(date)}-${timeKey(date)}`] = slot;
    return map;
  }, {}), [visibleSlots]);

  const moveWeek = (direction) => setStart((current) => new Date(current.getTime() + direction * 7 * 86400000));

  return (
    <section className={`slot-calendar ${compact ? "slot-calendar-compact" : ""}`}>
      <div className="slot-calendar-header">
        <div>
          <span className="section-kicker"><CalendarDays size={15} /> AVAILABILITY</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="calendar-board-wrap">
        <div className="calendar-board">
          <div className="calendar-time-spacer" />
          {days.map((date) => <div className="calendar-day-head" key={dateKey(date)}><strong>{dayLabel(date)}</strong><small>{date.toLocaleDateString([], { month: "short" })}</small></div>)}

          {rows.map((row) => (
            <React.Fragment key={row.toTimeString()}>
              <div className="calendar-time-label">{timeLabel(row)}</div>
              {days.map((day) => {
                const cellDate = new Date(day);
                cellDate.setHours(row.getHours(), row.getMinutes(), 0, 0);
                const key = `${dateKey(cellDate)}-${timeKey(cellDate)}`;
                const slot = byKey[key];
                const past = cellDate.getTime() < Date.now();
                const booked = slot && isBooked(slot);
                const selected = slot && selectedSlot?.start_unix === slot.start_unix;
                // Past deliberately wins over Booked: a previously booked slot
                // is still a Past slot once its time has elapsed.
                const state = past ? "past" : booked ? "booked" : slot ? "available" : "empty";
                return <div className="calendar-cell" key={key}>
                  {slot && <button type="button" className={`calendar-slot ${state} ${selected ? "selected" : ""}`} disabled={state !== "available"} onClick={() => onSelect?.(slot)} title={state === "booked" ? "Already booked" : state === "past" ? "This time has passed" : "Select this slot"}>
                    <span>{state === "booked" ? "Booked" : state === "past" ? "Past" : "Available"}</span>
                    <small>{timeLabel(slotDate(slot.start_unix))}</small>
                  </button>}
                </div>;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {loading && <div className="calendar-loading">Loading availability…</div>}
      {loadError && <div className="calendar-load-error">{loadError}</div>}
      <div className="calendar-legend"><span><i className="legend-dot available" /> Available</span><span><i className="legend-dot booked" /> Booked</span><span><i className="legend-dot past" /> Past</span><span><i className="legend-dot empty" /> No slot</span></div>
    </section>
  );
}
