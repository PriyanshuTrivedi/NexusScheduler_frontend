import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  RefreshCw,
  Video,
  XCircle,
} from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import CalendarSlots from "../../components/CalendarSlots/CalendarSlots";
import "./bookings.css";

const dateTime = (unix) =>
  new Date(Number(unix) * 1000).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

const statusValue = (value) =>
  String(value || "")
    .replace("BOOKING_STATUS_", "")
    .toUpperCase();

const roleValue = (role) =>
  String(role || "")
    .replace("USER_ROLE_", "")
    .toUpperCase();

const modeLabel = (value) =>
  String(value || "")
    .replace("MEETING_MODE_", "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const jitsiLink = (reference) =>
  reference ? `https://meet.jit.si/${encodeURIComponent(reference)}` : "";

const displayStatus = (booking) => {
  const raw = statusValue(booking.status);

  const end = Number(booking.end_unix || 0) * 1000;

  if (raw === "CONFIRMED") {
    return end <= Date.now() ? "Completed" : "Confirmed";
  }

  if (raw === "RESCHEDULED") {
    /*
     * A RESCHEDULED response can represent the historical row
     * while carrying the current booking's time.
     *
     * If the returned/current time is still in the future,
     * this is an active rescheduled event.
     */
    return end <= Date.now() ? "Rescheduled" : "Rescheduled";
  }

  if (raw === "CANCELLED") return "Cancelled";
  if (raw === "FAILED") return "Failed";
  if (raw === "WAITLISTED") return "Waitlisted";

  return "Confirmed";
};

/*
 * The API exposes two different collections:
 *
 *   upcoming -> active future bookings
 *   past     -> historical bookings / reschedule lineage
 *
 * DO NOT merge these collections.
 *
 * A RESCHEDULED historical row may still appear in the past response.
 * If its returned time is in the future, it represents an active
 * booking and must not be displayed in Previous.
 */
const normalizeUpcomingBookings = (bookings) => {
  return (bookings || [])
    .filter((booking) => {
      if (!booking) return false;

      const start = Number(booking.start_unix || 0) * 1000;
      const end = Number(booking.end_unix || 0) * 1000;
      const status = statusValue(booking.status);

      /*
       * Upcoming must only contain active booking states.
       */
      if (!["CONFIRMED", "WAITLISTED", "RESCHEDULED"].includes(status)) {
        return false;
      }

      /*
       * Never allow a future collection item whose end time has
       * already passed into Upcoming.
       */
      return end > Date.now() && start > 0;
    })
    .sort(
      (a, b) =>
        Number(a.start_unix || 0) - Number(b.start_unix || 0)
    );
};

const normalizePastBookings = (bookings) => {
  const now = Date.now();

  /*
   * First remove invalid/null entries.
   */
  const candidates = (bookings || []).filter(Boolean);

  /*
   * A RESCHEDULED item returned by the gateway can be the historical
   * row transformed into the CURRENT booking.
   *
   * Example:
   *
   * old booking:
   *   status = RESCHEDULED
   *   old time = yesterday
   *
   * gateway resolves lineage and returns:
   *   status = RESCHEDULED
   *   time = tomorrow
   *
   * That must NOT appear in Previous.
   */
  const filtered = candidates.filter((booking) => {
    const status = statusValue(booking.status);
    const end = Number(booking.end_unix || 0) * 1000;

    if (status === "RESCHEDULED" && end > now) {
      return false;
    }

    /*
     * Normal historical entries belong in Previous once their
     * end time has passed.
     */
    if (end > now && status !== "CANCELLED" && status !== "FAILED") {
      return false;
    }

    return true;
  });

  /*
   * Multiple rows can share a reference because rescheduling keeps
   * the same user-facing reference code.
   *
   * Keep only one historical representation per reference.
   */
  const byReference = new Map();

  for (const booking of filtered) {
    const reference = booking.reference_code;

    if (!reference) continue;

    const existing = byReference.get(reference);

    if (!existing) {
      byReference.set(reference, booking);
      continue;
    }

    /*
     * Prefer the newer row.
     */
    if (
      Number(booking.start_unix || 0) >
      Number(existing.start_unix || 0)
    ) {
      byReference.set(reference, booking);
    }
  }

  return [...byReference.values()].sort(
    (a, b) =>
      Number(b.end_unix || 0) - Number(a.end_unix || 0)
  );
};

export default function Bookings() {
  const { user } = useAuth();

  const isResource =
    roleValue(user?.role) === "RESOURCE";

  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [tab, setTab] = useState("upcoming");

  const [error, setError] = useState("");
  const [rescheduling, setRescheduling] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError("");

      const upcomingPromise = isResource
        ? api.resourceUpcomingBookings()
        : api.upcomingBookings();

      const pastPromise = isResource
        ? api.resourcePastBookings()
        : api.pastBookings();

      const [upcomingResponse, pastResponse] =
        await Promise.all([
          upcomingPromise,
          pastPromise,
        ]);

      /*
       * IMPORTANT:
       *
       * Never combine these two responses.
       *
       * The backend's Upcoming endpoint is the source of truth
       * for Upcoming.
       *
       * The backend's Past endpoint is the source of truth
       * for Previous.
       *
       * This prevents a historical RESCHEDULED row from being
       * promoted back into Upcoming by the frontend.
       */
      const next = normalizeUpcomingBookings(
        upcomingResponse?.bookings || []
      );

      const previous = normalizePastBookings(
        pastResponse?.bookings || []
      );

      setUpcoming(next);
      setPast(previous);
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't load your events. Please try again."
      );
    }
  };

  useEffect(() => {
    load();
  }, [isResource]);

  const cancel = async (reference) => {
    if (
      !window.confirm(
        "Cancel this meeting? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setError("");

      await api.cancelBooking(reference);

      await load();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't cancel this meeting."
      );
    }
  };

  const openReschedule = (booking) => {
    setRescheduling(booking);
    setSelectedSlot(null);
    setError("");
  };

  const confirmReschedule = async () => {
    if (!rescheduling || !selectedSlot) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.rescheduleBooking(
        rescheduling.reference_code,
        {
          start_unix: Number(
            selectedSlot.start_unix
          ),
          end_unix: Number(
            selectedSlot.end_unix
          ),
        }
      );

      setRescheduling(null);
      setSelectedSlot(null);

      /*
       * Re-fetch both collections after rescheduling.
       *
       * The old row should disappear from the UI and the new
       * booking should appear only in Upcoming if it is future.
       */
      await load();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't reschedule this meeting. Please choose another slot."
      );
    } finally {
      setSaving(false);
    }
  };

  const items =
    tab === "upcoming" ? upcoming : past;

  return (
    <div className="page-container bookings-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">
            YOUR EVENTS
          </span>

          <h1>Events</h1>

          <p>
            {isResource
              ? "Upcoming and previous meetings booked with your resource."
              : "Upcoming and previous meetings, sorted by date."}
          </p>
        </div>
      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <div className="booking-tabs">
        <button
          type="button"
          className={
            tab === "upcoming" ? "active" : ""
          }
          onClick={() => setTab("upcoming")}
        >
          <Clock3 size={16} />
          Upcoming
        </button>

        <button
          type="button"
          className={
            tab === "past" ? "active" : ""
          }
          onClick={() => setTab("past")}
        >
          <CheckCircle2 size={16} />
          Previous
        </button>
      </div>

      {!items.length ? (
        <div className="empty-state">
          <CalendarClock size={27} />

          <h3>No events</h3>

          <p>
            {tab === "upcoming"
              ? "Your upcoming meetings will appear here."
              : "Your previous meetings will appear here."}
          </p>
        </div>
      ) : (
        <div className="booking-list">
          {items.map((booking) => {
            const bookingStatus =
              statusValue(booking.status);

            const logicalStatus =
              displayStatus(booking);

            /*
             * Only Upcoming bookings can be modified.
             */
            const actionable =
              tab === "upcoming" &&
              [
                "CONFIRMED",
                "RESCHEDULED",
                "WAITLISTED",
              ].includes(bookingStatus) &&
              Number(booking.start_unix || 0) *
                1000 >
                Date.now();

            const online =
              String(
                booking.meeting_mode || ""
              ).includes("ONLINE") ||
              String(
                booking.meeting_mode || ""
              ).includes("HYBRID");

            const link = online
              ? jitsiLink(
                  booking.reference_code
                )
              : "";

            const hasPrevious =
              Number(
                booking.previous_start_unix || 0
              ) > 0;

            return (
              <article
                className="booking-card"
                key={booking.reference_code}
              >
                <div className="booking-icon">
                  <CalendarClock size={20} />
                </div>

                <div className="booking-main">
                  <div className="booking-title-row">
                    <h3>
                      {booking.display_title ||
                        booking.title ||
                        "Scheduled meeting"}
                    </h3>

                    <span
                      className={`status-badge status-${logicalStatus.toLowerCase()}`}
                    >
                      {logicalStatus}
                    </span>
                  </div>

                  {hasPrevious ? (
                    <div className="booking-reschedule-time">
                      <span className="booking-old-time">
                        <Clock3 size={14} />

                        {dateTime(
                          booking.previous_start_unix
                        )}

                        {" → "}

                        {dateTime(
                          booking.previous_end_unix
                        )}
                      </span>

                      <span className="booking-current-time">
                        <span className="current-marker" />

                        {dateTime(
                          booking.start_unix
                        )}

                        {" → "}

                        {dateTime(
                          booking.end_unix
                        )}
                      </span>
                    </div>
                  ) : (
                    <p className="booking-detail">
                      <Clock3 size={14} />

                      {dateTime(
                        booking.start_unix
                      )}

                      {" → "}

                      {dateTime(
                        booking.end_unix
                      )}
                    </p>
                  )}

                  {booking.meeting_mode && (
                    <p className="booking-detail">
                      <Video size={14} />

                      {modeLabel(
                        booking.meeting_mode
                      )}
                    </p>
                  )}

                  {booking.address && (
                    <p className="booking-detail">
                      <MapPin size={14} />

                      {booking.address}
                    </p>
                  )}

                  {link && (
                    <a
                      className="booking-meet-link"
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Video size={14} />

                      Join online meeting

                      <ExternalLink size={12} />
                    </a>
                  )}

                  <small>
                    Reference:{" "}
                    {booking.reference_code}
                  </small>
                </div>

                {actionable && (
                  <div className="booking-actions">
                    <button
                      type="button"
                      className="event-action reschedule"
                      onClick={() =>
                        openReschedule(booking)
                      }
                    >
                      <RefreshCw size={16} />
                      Reschedule
                    </button>

                    <button
                      type="button"
                      className="event-action cancel-booking"
                      onClick={() =>
                        cancel(
                          booking.reference_code
                        )
                      }
                    >
                      <XCircle size={18} />
                      Cancel
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {rescheduling && (
        <div
          className="reschedule-backdrop"
          onMouseDown={() =>
            !saving &&
            setRescheduling(null)
          }
        >
          <div
            className="reschedule-dialog reschedule-calendar-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="reschedule-dialog-head">
              <div>
                <span className="section-kicker">
                  RESCHEDULE
                </span>

                <h2>
                  Choose a new time
                </h2>

                <p>
                  Pick an available slot from this
                  resource's calendar.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  !saving &&
                  setRescheduling(null)
                }
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="reschedule-current">
              <span>
                Current meeting
              </span>

              <strong>
                {dateTime(
                  rescheduling.start_unix
                )}

                {" → "}

                {dateTime(
                  rescheduling.end_unix
                )}
              </strong>
            </div>

            <CalendarSlots
              compact
              title="Resource calendar"
              description="Green slots are available, red slots are booked, and past times are faded."
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
              loadSlots={(
                startUnix,
                endUnix
              ) =>
                api.resourceAvailability(
                  rescheduling.resource_id,
                  startUnix,
                  endUnix
                )
              }
            />

            <div className="reschedule-selection">
              <div>
                <span className="section-kicker">
                  NEW TIME
                </span>

                <strong>
                  {selectedSlot
                    ? `${dateTime(
                        selectedSlot.start_unix
                      )} → ${dateTime(
                        selectedSlot.end_unix
                      )}`
                    : "Select an available slot"}
                </strong>
              </div>

              <div className="reschedule-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    setRescheduling(null)
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={
                    confirmReschedule
                  }
                  disabled={
                    saving || !selectedSlot
                  }
                >
                  {saving
                    ? "Rescheduling…"
                    : "Reschedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}