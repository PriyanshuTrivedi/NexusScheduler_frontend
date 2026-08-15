import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Plus, Trash2, X } from "lucide-react";
import "./RecurringAvailabilityModal.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ENUMS = [
  "DAY_OF_WEEK_MONDAY", "DAY_OF_WEEK_TUESDAY", "DAY_OF_WEEK_WEDNESDAY",
  "DAY_OF_WEEK_THURSDAY", "DAY_OF_WEEK_FRIDAY", "DAY_OF_WEEK_SATURDAY", "DAY_OF_WEEK_SUNDAY",
];
const newSlot = () => ({ id: `${Date.now()}-${Math.random()}`, start: "09:00", end: "17:00" });
const emptyWeek = () => DAYS.map((day) => ({ day, slots: [] }));
const pad = (value) => String(value).padStart(2, "0");

const normalizeDay = (value) => {
  const raw = String(value || "").replace("DAY_OF_WEEK_", "").toUpperCase();
  if (/^\d+$/.test(raw)) return Number(raw);
  const index = DAY_ENUMS.findIndex((item) => item.endsWith(raw));
  return index + 1;
};

const normalizeRecurrence = (recurrence = []) => {
  const weekly = emptyWeek();
  recurrence.forEach((rule) => {
    const day = normalizeDay(rule.day ?? rule.Day);
    if (day < 1 || day > 7) return;
    const slots = (rule.slots ?? rule.Slots ?? []).map((slot) => ({
      id: `${Date.now()}-${Math.random()}`,
      start: `${pad(slot.start_hour ?? slot.StartHour)}:${pad(slot.start_minute ?? slot.StartMinute)}`,
      end: `${pad(slot.end_hour ?? slot.EndHour)}:${pad(slot.end_minute ?? slot.EndMinute)}`,
    }));
    weekly[day - 1].slots = slots;
  });

  const signatures = weekly.map((day) => day.slots.map((slot) => `${slot.start}-${slot.end}`).join("|"));
  const allSame = signatures.every((signature) => signature && signature === signatures[0]);
  return {
    type: allSame ? "daily" : "weekly",
    daily: allSame ? weekly[0].slots : [newSlot()],
    weekly,
  };
};

function buildRequest(type, daily, weekly) {
  const source = type === "daily"
    ? DAYS.map((day, index) => ({ day, slots: daily, dayEnum: DAY_ENUMS[index] }))
    : weekly.map((day, index) => ({ ...day, dayEnum: DAY_ENUMS[index] }));

  return {
    recurrence: source
      .filter((day) => day.slots.length)
      .map((day) => ({
        day: day.dayEnum,
        timezone: "Asia/Kolkata",
        slots: day.slots.map((slot) => {
          const [startHour, startMinute] = slot.start.split(":").map(Number);
          const [endHour, endMinute] = slot.end.split(":").map(Number);
          return { start_hour: startHour, start_minute: startMinute, end_hour: endHour, end_minute: endMinute };
        }),
      })),
  };
}

export default function RecurringAvailabilityModal({ open, onClose, onSave, initialRecurrence = null }) {
  const [type, setType] = useState("daily");
  const [daily, setDaily] = useState([newSlot()]);
  const [weekly, setWeekly] = useState(emptyWeek());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialRecurrence?.length) {
      const normalized = normalizeRecurrence(initialRecurrence);
      setType(normalized.type);
      setDaily(normalized.daily);
      setWeekly(normalized.weekly);
    } else {
      setType("daily");
      setDaily([newSlot()]);
      setWeekly(emptyWeek());
    }
    setMessage("");
  }, [open, initialRecurrence]);

  const schedule = useMemo(() => (type === "daily" ? [{ day: "Every day", slots: daily }] : weekly), [daily, weekly, type]);
  if (!open) return null;

  const updateSlot = (dayIndex, slotId, field, value) => {
    if (type === "daily") {
      setDaily((current) => current.map((slot) => slot.id === slotId ? { ...slot, [field]: value } : slot));
      return;
    }
    setWeekly((current) => current.map((day, index) => index === dayIndex ? { ...day, slots: day.slots.map((slot) => slot.id === slotId ? { ...slot, [field]: value } : slot) } : day));
  };

  const addSlot = (dayIndex = null) => {
    if (type === "daily") setDaily((current) => [...current, newSlot()]);
    else setWeekly((current) => current.map((day, index) => index === dayIndex ? { ...day, slots: [...day.slots, newSlot()] } : day));
  };

  const removeSlot = (dayIndex, slotId) => {
    if (type === "daily") setDaily((current) => current.filter((slot) => slot.id !== slotId));
    else setWeekly((current) => current.map((day, index) => index === dayIndex ? { ...day, slots: day.slots.filter((slot) => slot.id !== slotId) } : day));
  };

  const submit = async () => {
    if (!schedule.some((day) => day.slots.length)) {
      setMessage("Add at least one availability slot.");
      return;
    }
    if (schedule.some((day) => day.slots.some((slot) => slot.start >= slot.end))) {
      setMessage("Each availability slot must end after it starts.");
      return;
    }
    try {
      setSaving(true);
      setMessage("");
      await onSave?.(buildRequest(type, daily, weekly));
      onClose?.();
    } catch (error) {
      setMessage(error?.message || "We couldn't save the recurring availability.");
    } finally {
      setSaving(false);
    }
  };

  const editing = Boolean(initialRecurrence?.length);
  return (
    <div className="availability-modal-backdrop" onMouseDown={onClose}>
      <div className="availability-modal" role="dialog" aria-modal="true" aria-labelledby="availability-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="availability-modal-head">
          <div>
            <span className="section-kicker"><CalendarDays size={14} /> SCHEDULE</span>
            <h2 id="availability-title">{editing ? "Edit recurring availability" : "Add recurring availability"}</h2>
            <p>{editing ? "Edit the current time windows clients can book." : "Set the time windows clients can book repeatedly."}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="schedule-type-switch">
          <span>Schedule type</span>
          <label><input type="radio" checked={type === "daily"} onChange={() => setType("daily")} /> Daily</label>
          <label><input type="radio" checked={type === "weekly"} onChange={() => setType("weekly")} /> Weekly</label>
        </div>

        {type === "daily" ? (
          <div className="availability-panel">
            <div className="availability-panel-title"><strong>Daily schedule</strong><small>Repeats every day</small></div>
            <div className="daily-slots">
              {daily.map((slot) => (
                <div className="availability-slot-row" key={slot.id}>
                  <Clock3 size={15} />
                  <input type="time" value={slot.start} onChange={(event) => updateSlot(null, slot.id, "start", event.target.value)} />
                  <span>to</span>
                  <input type="time" value={slot.end} onChange={(event) => updateSlot(null, slot.id, "end", event.target.value)} />
                  <button type="button" className="remove-slot" onClick={() => removeSlot(null, slot.id)} disabled={daily.length === 1}><Trash2 size={15} /> Remove slot</button>
                </div>
              ))}
            </div>
            <button type="button" className="add-slot-button" onClick={() => addSlot()}><Plus size={15} /> Add availability</button>
          </div>
        ) : (
          <div className="weekly-scroll">
            <div className="weekly-grid">
              {weekly.map((day, dayIndex) => (
                <section className="day-card" key={day.day}>
                  <div className="day-card-head"><strong>{day.day}</strong><small>{day.slots.length ? `${day.slots.length} slot${day.slots.length > 1 ? "s" : ""}` : "No availability"}</small></div>
                  <div className="day-card-slots">
                    {day.slots.map((slot) => (
                      <div className="weekly-slot" key={slot.id}>
                        <div className="weekly-slot-times">
                          <input type="time" value={slot.start} onChange={(event) => updateSlot(dayIndex, slot.id, "start", event.target.value)} />
                          <span>to</span>
                          <input type="time" value={slot.end} onChange={(event) => updateSlot(dayIndex, slot.id, "end", event.target.value)} />
                        </div>
                        <button type="button" className="remove-slot remove-slot-inline" onClick={() => removeSlot(dayIndex, slot.id)} aria-label={`Remove slot from ${day.day}`} title="Remove slot"><Trash2 size={14} /> Remove slot</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="add-slot-button day-add" onClick={() => addSlot(dayIndex)}><Plus size={14} /> Add slot</button>
                </section>
              ))}
            </div>
          </div>
        )}

        {message && <div className="availability-message">{message}</div>}
        <div className="availability-modal-foot">
          <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button button-primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add recurring schedule"}</button>
        </div>
      </div>
    </div>
  );
}
