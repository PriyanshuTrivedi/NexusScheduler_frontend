import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import CalendarSlots from "../../components/CalendarSlots/CalendarSlots";
import "./resourceSlots.css";

export default function ResourceSlots() {
  const { resourceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [resource, setResource] = useState(location.state?.resource || null);
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resource) {
      sessionStorage.setItem(`nexus-resource-${resourceId}`, JSON.stringify(resource));
      return;
    }
    const saved = sessionStorage.getItem(`nexus-resource-${resourceId}`);
    if (saved) setResource(JSON.parse(saved));
  }, [resource, resourceId]);

  const slots = useMemo(() => resource?.next_available_slots || [], [resource]);

  const confirm = async () => {
    if (!selected) return;
    if (!isAuthenticated) {
      navigate(`/login/client`, { state: { from: `/resources/${resourceId}/slots` } });
      return;
    }

    try {
      setError("");
      const response = await api.createBooking({
        resource_id: resourceId,
        start_unix: Number(selected.start_unix),
        end_unix: Number(selected.end_unix),
        title: `Meeting with ${resource.name}`,
        subtitle: resource.resource_type?.name || "",
      });
      setBooking(response);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!resource) {
    return <div className="page-container"><div className="empty-state"><CalendarDays size={28} /><h3>Availability is not loaded</h3><p>Open the calendar from a resource result so Nexus can show the available slots returned by the backend.</p><Link className="button button-primary" to="/resources">Back to search</Link></div></div>;
  }

  return (
    <div className="page-container slots-page">
      <Link className="back-link" to={`/resources/${resourceId}`} state={{ resource }}><ArrowLeft size={16} /> Back to profile</Link>
      <div className="page-heading"><div><span className="section-kicker">SCHEDULE</span><h1>{resource.name}</h1><p>Choose a date and then an available time slot.</p></div><span className="slot-type-pill"><CalendarDays size={16} /> {resource.resource_type?.name || "Resource"}</span></div>
      <CalendarSlots slots={slots} selectedSlot={selected} onSelect={setSelected} />
      <section className="booking-confirm"><div><span className="section-kicker">YOUR SELECTION</span>{selected ? <><h2>{new Date(Number(selected.start_unix) * 1000).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</h2><p><Clock3 size={15} /> {new Date(Number(selected.start_unix) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(Number(selected.end_unix) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></> : <h2>Select a slot from the calendar</h2>}</div><button className="button button-primary button-large" disabled={!selected} onClick={confirm}><CheckCircle2 size={17} />{isAuthenticated ? "Confirm meeting" : "Login to schedule"}</button></section>
      {error && <div className="form-error">{error}</div>}
      {booking && <div className="booking-success"><CheckCircle2 size={22} /><div><strong>Meeting created</strong><p>Reference: {booking.reference_code}</p><Link to="/bookings">Open my bookings</Link></div></div>}
    </div>
  );
}
