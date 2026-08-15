import React, { useEffect, useState } from "react";
import { CalendarClock, Clock3, MapPin, Video } from "lucide-react";
import { api } from "../../api";
import "./resourceUpcoming.css";

const dateTime = (unix) =>
  new Date(Number(unix) * 1000).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

const modeLabel = (value) =>
  String(value || "")
    .replace("MEETING_MODE_", "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export default function ResourceUpcoming() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.resourceUpcomingBookings()
      .then((response) => setEvents(response.bookings || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page-container resource-upcoming-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">RESOURCE SCHEDULE</span>
          <h1>Upcoming events</h1>
          <p>Meetings booked with your resource.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!events.length ? (
        <div className="empty-state">
          <CalendarClock size={28} />
          <h3>No upcoming events</h3>
          <p>Your scheduled meetings will appear here.</p>
        </div>
      ) : (
        <div className="resource-event-list">
          {events.map((event) => (
            <article className="resource-event-card" key={event.reference_code}>
              <div className="resource-event-icon"><CalendarClock size={21} /></div>
              <div className="resource-event-main">
                <div className="resource-event-heading">
                  <h3>{event.title || "Scheduled meeting"}</h3>
                  <span>{event.reference_code}</span>
                </div>
                <p><Clock3 size={15} /> {dateTime(event.start_unix)} → {dateTime(event.end_unix)}</p>
                {event.meeting_mode && (
                  <p><Video size={15} /> {modeLabel(event.meeting_mode)}</p>
                )}
                {event.address && (
                  <p><MapPin size={15} /> {event.address}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
