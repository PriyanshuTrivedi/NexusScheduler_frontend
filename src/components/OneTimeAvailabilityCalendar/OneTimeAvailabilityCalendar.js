import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "../../api";
import "./OneTimeAvailabilityCalendar.css";

const HOUR_START = 5;
const HOUR_END = 23;
const ROW_MINUTES = 30;
const ROW_HEIGHT = 42;
const DAY_WIDTH = 150;

const slotDate = (unix) => new Date(Number(unix) * 1000);

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const timeLabel = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

const dayLabel = (date) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date);

// Aligned with CalendarSlots status parsing logic
const statusValue = (slot) =>
  String(slot?.status || slot?.slot_status || slot?.state || "available")
    .toLowerCase()
    .replaceAll("_", "");

const isBooked = (slot) => {
  if (slot?.is_booked === true || slot?.booked === true) return true;
  if (slot?.is_available === false || slot?.available === false) return true;
  if (slot?.booking_id || slot?.bookingId || slot?.booking) return true;
  return /book|reserved|held|busy|occupied|taken|unavailable/.test(statusValue(slot));
};

const startOfWeek = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
};

const weekBounds = (start) => {
  const from = startOfWeek(start);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return {
    startUnix: Math.floor(from.getTime() / 1000),
    endUnix: Math.floor(to.getTime() / 1000),
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const snapMinutes = (minutes) => Math.round(minutes / ROW_MINUTES) * ROW_MINUTES;

const formatRange = (start, end) => {
  const left = start.toLocaleDateString([], { month: "short", day: "numeric" });
  const right = end.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return left === right ? left : `${left} – ${right}`;
};

const makeDraftFromMinutes = (baseDay, startMinutes, endMinutes) => {
  const start = new Date(baseDay);
  start.setHours(0, 0, 0, 0);
  start.setMinutes(startMinutes);

  const end = new Date(baseDay);
  end.setHours(0, 0, 0, 0);
  end.setMinutes(endMinutes);

  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
};

const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const timeStringToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, mins] = timeStr.split(":").map(Number);
  return hours * 60 + mins;
};

export default function OneTimeAvailabilityCalendar({
  open,
  resourceId,
  onClose,
  onSaved,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(null);
  const boardRef = useRef(null);

  const timeOptions = useMemo(() => {
    const options = [];
    for (let m = HOUR_START * 60; m <= HOUR_END * 60; m += ROW_MINUTES) {
      const hours = Math.floor(m / 60);
      const mins = m % 60;
      const date = new Date(2000, 0, 1, hours, mins);
      options.push({
        minutes: m,
        value: minutesToTimeString(m),
        label: timeLabel(date),
      });
    }
    return options;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);
        return date;
      }),
    [weekStart]
  );

  const rows = useMemo(
    () =>
      Array.from(
        { length: ((HOUR_END - HOUR_START) * 60) / ROW_MINUTES },
        (_, index) => HOUR_START * 60 + index * ROW_MINUTES
      ),
    []
  );

  const draftDayIndex = draft
    ? days.findIndex((day) => dateKey(day) === dateKey(slotDate(draft.startUnix)))
    : -1;

  const currentDraftMinutes = useMemo(() => {
    if (!draft) return { startMinutes: 0, endMinutes: 0 };
    const sDate = slotDate(draft.startUnix);
    const eDate = slotDate(draft.endUnix);
    return {
      startMinutes: sDate.getHours() * 60 + sDate.getMinutes(),
      endMinutes: eDate.getHours() * 60 + eDate.getMinutes(),
    };
  }, [draft]);

  const loadWeek = async () => {
    if (!resourceId) return;
    try {
      setLoading(true);
      setLoadError("");
      const { startUnix, endUnix } = weekBounds(weekStart);
      const response = await api.resourceSlots(resourceId, startUnix, endUnix);
      setSlots(response?.slots || response || []);
    } catch (error) {
      setLoadError(error?.message || "We couldn't load this week's availability.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setReason("");
    loadWeek();
  }, [open, resourceId, weekStart]);

  useEffect(() => {
    if (!open) return undefined;
    const finishDrag = () => setDrag(null);
    window.addEventListener("mouseup", finishDrag);
    return () => window.removeEventListener("mouseup", finishDrag);
  }, [open]);

  if (!open) return null;

  const moveWeek = (direction) => {
    setWeekStart((current) => new Date(current.getTime() + direction * 7 * 86400000));
  };

  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const minutesFromPointer = (event, column) => {
    const rect = column.getBoundingClientRect();
    const raw = ((event.clientY - rect.top) / ROW_HEIGHT) * ROW_MINUTES + HOUR_START * 60;
    return clamp(snapMinutes(raw), HOUR_START * 60, HOUR_END * 60);
  };

  const startSelection = (event, dayIndex) => {
    if (event.button !== 0 || saving) return;
    const column = event.currentTarget;
    const clickedMinutes = minutesFromPointer(event, column);
    const day = days[dayIndex];
    const now = new Date();
    const selected = new Date(day);
    selected.setHours(0, 0, 0, 0);
    selected.setMinutes(clickedMinutes);

    if (selected <= now) return;

    setDrag({
      dayIndex,
      startMinutes: clickedMinutes,
      endMinutes: Math.min(clickedMinutes + ROW_MINUTES, HOUR_END * 60),
    });
    setDraft(null);
    setReason("");
  };

  const updateSelection = (event, dayIndex) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    const currentMinutes = minutesFromPointer(event, event.currentTarget);
    const calculatedEnd =
      currentMinutes === drag.startMinutes
        ? currentMinutes + ROW_MINUTES
        : currentMinutes;

    setDrag((current) => ({
      ...current,
      endMinutes: clamp(calculatedEnd, HOUR_START * 60, HOUR_END * 60),
    }));
  };

  const finishSelection = () => {
    if (!drag) return;
    const { dayIndex, startMinutes, endMinutes } = drag;
    let finalStart = Math.min(startMinutes, endMinutes);
    let finalEnd = Math.max(startMinutes, endMinutes);

    if (finalStart === finalEnd) {
      finalEnd = Math.min(finalStart + ROW_MINUTES, HOUR_END * 60);
    }

    const next = makeDraftFromMinutes(days[dayIndex], finalStart, finalEnd);
    if (next.startUnix > Math.floor(Date.now() / 1000)) {
      setDraft(next);
    }
    setDrag(null);
  };

  const handleTimeChange = (type, valueString) => {
    if (!draft || draftDayIndex < 0) return;

    const selectedMinutes = timeStringToMinutes(valueString);
    let { startMinutes, endMinutes } = currentDraftMinutes;

    if (type === "start") {
      startMinutes = clamp(selectedMinutes, HOUR_START * 60, HOUR_END * 60 - ROW_MINUTES);
      if (startMinutes >= endMinutes) {
        endMinutes = Math.min(startMinutes + ROW_MINUTES, HOUR_END * 60);
      }
    } else {
      endMinutes = clamp(selectedMinutes, HOUR_START * 60 + ROW_MINUTES, HOUR_END * 60);
      if (endMinutes <= startMinutes) {
        startMinutes = Math.max(endMinutes - ROW_MINUTES, HOUR_START * 60);
      }
    }

    const nextDraft = makeDraftFromMinutes(days[draftDayIndex], startMinutes, endMinutes);
    if (nextDraft.startUnix > Math.floor(Date.now() / 1000)) {
      setDraft(nextDraft);
    }
  };

  const resizeDraft = (edge, event) => {
    event.stopPropagation();
    if (!draft || draftDayIndex < 0) return;
    const column = event.currentTarget.closest(".one-time-day-column");
    if (!column) return;

    const pointerMinutes = minutesFromPointer(event, column);
    let { startMinutes, endMinutes } = currentDraftMinutes;

    if (edge === "start") {
      startMinutes = clamp(pointerMinutes, HOUR_START * 60, endMinutes - ROW_MINUTES);
    } else {
      endMinutes = clamp(pointerMinutes, startMinutes + ROW_MINUTES, HOUR_END * 60);
    }

    const nextDraft = makeDraftFromMinutes(days[draftDayIndex], startMinutes, endMinutes);
    if (nextDraft.startUnix > Math.floor(Date.now() / 1000)) {
      setDraft(nextDraft);
    }
  };

  const saveDraft = async () => {
    if (!draft || !resourceId || saving) return;
    try {
      setSaving(true);
      setLoadError("");
      await api.addSlotException(resourceId, {
        start_unix: draft.startUnix,
        end_unix: draft.endUnix,
        reason: reason.trim(),
      });
      setDraft(null);
      setReason("");
      await loadWeek();
      onSaved?.();
    } catch (error) {
      setLoadError(error?.message || "We couldn't add this availability.");
    } finally {
      setSaving(false);
    }
  };

  // Convert raw API slots into rendered slot blocks adhering to CalendarSlots state precedence
  const slotBlocks = slots
    .filter((slot) => slot?.slot_timing || (slot?.start_unix != null && slot?.end_unix != null))
    .map((slot) => {
      const startUnix = Number(slot.start_unix ?? slot.slot_timing?.start_unix);
      const endUnix = Number(slot.end_unix ?? slot.slot_timing?.end_unix);
      const start = slotDate(startUnix);
      const dayIndex = days.findIndex((day) => dateKey(day) === dateKey(start));
      if (dayIndex < 0) return null;

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const durationMinutes = Math.max(1, (endUnix - startUnix) / 60);
      const top = (startMinutes - HOUR_START * 60) * (ROW_HEIGHT / ROW_MINUTES);
      const height = durationMinutes * (ROW_HEIGHT / ROW_MINUTES);

      // Past precedence rule match: past takes precedence over booked/available
      const past = endUnix * 1000 < Date.now();
      const booked = isBooked(slot);
      const state = past ? "past" : booked ? "booked" : "available";

      return {
        key: slot.slot_id || `${startUnix}-${endUnix}`,
        dayIndex,
        top,
        height,
        startUnix,
        endUnix,
        state,
      };
    })
    .filter(Boolean);

  const draftStyle = draft
    ? (() => {
        const { startMinutes, endMinutes } = currentDraftMinutes;
        const durationMinutes = Math.max(ROW_MINUTES, endMinutes - startMinutes);
        return {
          top: (startMinutes - HOUR_START * 60) * (ROW_HEIGHT / ROW_MINUTES),
          height: durationMinutes * (ROW_HEIGHT / ROW_MINUTES),
        };
      })()
    : null;

  const draftStartVal = minutesToTimeString(currentDraftMinutes.startMinutes);
  const draftEndVal = minutesToTimeString(currentDraftMinutes.endMinutes);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="one-time-calendar-overlay">
      <section className="one-time-calendar-modal" role="dialog" aria-modal="true" aria-label="Add one-time availability">
        <header className="one-time-calendar-header">
          <div>
            <span className="section-kicker"><CalendarDays size={15} /> ONE-TIME AVAILABILITY</span>
            <h2>{formatRange(weekStart, weekEnd)}</h2>
            <p>Click or drag on the calendar to configure slot openings.</p>
          </div>
          <button type="button" className="one-time-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="one-time-toolbar">
          <div className="one-time-nav">
            <button type="button" onClick={goToday}>Today</button>
            <button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={17} /></button>
            <button type="button" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={17} /></button>
          </div>
          <div className="one-time-hint">Drag or click on an empty time region to create availability</div>
        </div>

        <div className="one-time-calendar-container" style={{ "--day-width": `${DAY_WIDTH}px`, "--row-height": `${ROW_HEIGHT}px` }}>
          <div className="one-time-header-row">
            <div className="one-time-corner" />
            <div className="one-time-days-header">
              {days.map((day) => (
                <div className="one-time-day-head" key={dateKey(day)}>
                  <strong>{dayLabel(day)}</strong>
                  <span>{day.getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="one-time-calendar-scroll" ref={boardRef}>
            <div className="one-time-board">
              <div className="one-time-time-column">
                {rows.map((minutes) => {
                  const time = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
                  return <div className="one-time-time-label" key={minutes}>{timeLabel(time)}</div>;
                })}
              </div>

              <div className="one-time-grid-columns">
                {days.map((day, dayIndex) => (
                  <div
                    className="one-time-day-column"
                    key={dateKey(day)}
                    onMouseDown={(event) => startSelection(event, dayIndex)}
                    onMouseMove={(event) => updateSelection(event, dayIndex)}
                    onMouseUp={finishSelection}
                  >
                    {rows.map((minutes) => {
                      const cell = new Date(day);
                      cell.setHours(0, 0, 0, 0);
                      cell.setMinutes(minutes);
                      const past = cell.getTime() < Date.now();
                      return <div className={`one-time-grid-row ${past ? "past-row" : ""}`} key={minutes} />;
                    })}

                    {slotBlocks.filter((block) => block.dayIndex === dayIndex).map((block) => (
                      <div
                        key={block.key}
                        className={`one-time-event ${block.state}`}
                        style={{ top: block.top, height: block.height }}
                        onMouseDown={(event) => event.stopPropagation()}
                        title={block.state === "booked" ? "Booked" : block.state === "past" ? "This time has passed" : "Available"}
                      >
                        <strong>{block.state === "booked" ? "Booked" : block.state === "past" ? "Past" : "Available"}</strong>
                        <span>{timeLabel(slotDate(block.startUnix))} – {timeLabel(slotDate(block.endUnix))}</span>
                      </div>
                    ))}

                    {draft && draftDayIndex === dayIndex && draftStyle && (
                      <div
                        className="one-time-event draft"
                        style={{ top: draftStyle.top, height: draftStyle.height }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <button type="button" className="draft-resize draft-resize-top" onMouseDown={(event) => resizeDraft("start", event)} aria-label="Resize start" />
                        <div className="draft-info">
                          <strong>New availability</strong>
                          <span>{timeLabel(slotDate(draft.startUnix))} – {timeLabel(slotDate(draft.endUnix))}</span>
                        </div>
                        <button type="button" className="draft-resize draft-resize-bottom" onMouseDown={(event) => resizeDraft("end", event)} aria-label="Resize end" />

                        <div className={`draft-popover-card ${dayIndex >= 4 ? "popover-left" : "popover-right"}`} onMouseDown={(e) => e.stopPropagation()}>
                          <div className="popover-header">
                            <span>Add New Slot</span>
                            <button type="button" onClick={() => setDraft(null)} className="popover-close"><X size={14} /></button>
                          </div>
                          <div className="popover-time-selectors">
                            <div className="popover-field">
                              <label>From</label>
                              <select value={draftStartVal} onChange={(e) => handleTimeChange("start", e.target.value)}>
                                {timeOptions.slice(0, -1).map((opt) => (
                                  <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="popover-field">
                              <label>To</label>
                              <select value={draftEndVal} onChange={(e) => handleTimeChange("end", e.target.value)}>
                                {timeOptions.slice(1).map((opt) => (
                                  <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="popover-field">
                            <input
                              type="text"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Optional note / reason"
                              maxLength={200}
                            />
                          </div>
                          <div className="popover-actions">
                            <button type="button" className="button button-secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
                            <button type="button" className="button button-primary" onClick={saveDraft} disabled={saving}>
                              <Check size={14} /> {saving ? "Saving…" : "Save Slot"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {drag && drag.dayIndex === dayIndex && (
                      <div
                        className="one-time-selection"
                        style={{
                          top: (Math.min(drag.startMinutes, drag.endMinutes) - HOUR_START * 60) * (ROW_HEIGHT / ROW_MINUTES),
                          height: Math.max(ROW_HEIGHT, Math.abs(drag.endMinutes - drag.startMinutes) * (ROW_HEIGHT / ROW_MINUTES)),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="one-time-footer">
          <div className="one-time-legend">
            <span><i className="one-time-dot available" /> Available</span>
            <span><i className="one-time-dot booked" /> Booked</span>
            <span><i className="one-time-dot past" /> Past</span>
            <span><i className="one-time-dot draft" /> New slot draft</span>
          </div>
        </div>
        {loading && <div className="one-time-status">Loading availability…</div>}
        {loadError && <div className="one-time-status error">{loadError}</div>}
      </section>
    </div>
  );
}