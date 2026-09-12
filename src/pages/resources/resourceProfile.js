import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Globe2,
  MapPin,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import CalendarSlots from "../../components/CalendarSlots/CalendarSlots";
import "./resourceProfile.css";

const clean = (value) =>
  String(value || "")
    .replace("MEETING_MODE_", "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const tenantLabel = (resource, organizationName) => {
  const tenant = String(resource?.tenant_type || "")
    .replace("TENANT_TYPE_", "")
    .toLowerCase();

  if (tenant === "org") {
    return `Organization / ${organizationName || "Organization"}`;
  }

  return "Individual";
};

export default function ResourceProfile() {
  const { resourceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [resource, setResource] = useState(
    location.state?.resource || null,
  );
  const [organizationName, setOrganizationName] = useState("");
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(null);
  const [upcomingSlots, setUpcomingSlots] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resourceId) return;

    let cancelled = false;
    api.resourceById(resourceId)
      .then((response) => {
        if (cancelled || !response?.resource) return;
        const current = {
          ...response.resource,
          attributes: response.attributes || {},
        };
        setResource(current);
        sessionStorage.setItem(`nexus-resource-${resourceId}`, JSON.stringify(current));
      })
      .catch(() => {
        if (cancelled) return;
        const saved = sessionStorage.getItem(`nexus-resource-${resourceId}`);
        if (saved) {
          try {
            setResource(JSON.parse(saved));
          } catch {
            // Ignore stale session data.
          }
        }
      });

    return () => { cancelled = true; };
  }, [resourceId]);

  useEffect(() => {
    if (!resource?.org_id) return;

    api
      .organization(resource.org_id)
      .then((response) =>
        setOrganizationName(response.organization?.name || ""),
      )
      .catch(() => setOrganizationName(""));
  }, [resource?.org_id]);

  useEffect(() => {
    if (!resourceId || !resource) return;
    const now = Math.floor(Date.now() / 1000);
    api.resourceAvailability(resourceId, now, now + 14 * 86400)
      .then((response) => setUpcomingSlots((response.slots || []).filter((slot) => String(slot.status).toLowerCase() === "available").slice(0, 10)))
      .catch(() => setUpcomingSlots([]));
  }, [resourceId, resource]);

  const confirm = async () => {
    if (!selected) return;

    if (!isAuthenticated) {
      navigate("/login/client", {
        state: {
          from: `/resources/${resourceId}`,
        },
      });
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
      setSelected(null);
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't schedule this meeting. Please try another slot.",
      );
    }
  };

  if (!resource) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <UserRound size={28} />
          <h3>Resource details are not loaded</h3>
          <p>
            Open this page from a resource search result.
          </p>
          <Link
            className="button button-primary"
            to="/resources"
          >
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container profile-page">
      <Link className="back-link" to="/resources">
        <ArrowLeft size={16} /> Back to search
      </Link>

      <section className="profile-hero">
        <div className="profile-person">
          <div className="profile-avatar">{String(resource.name || "R").slice(0, 2).toUpperCase()}</div>
          <div>
            <h1>{resource.name}</h1>
            <div className="profile-tags"><span>{resource.resource_type?.name || "Resource"}</span><span>{tenantLabel(resource, organizationName)}</span></div>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="content-card">
          <span className="section-kicker">PROFILE</span>
          <h2>About this resource</h2>
          <p>
            {resource.attributes?.description ||
              "This resource is available for scheduling through Nexus."}
          </p>

          <div className="profile-detail-list">
            <div>
              <Globe2 size={17} />
              <span>{clean(resource.meeting_mode)} meeting</span>
            </div>

            {resource.attributes?.address && (
              <div>
                <MapPin size={17} />
                <span>{resource.attributes.address}</span>
              </div>
            )}

            {resource.distance_km > 0 && (
              <div>
                <MapPin size={17} />
                <span>
                  {Number(resource.distance_km).toFixed(1)} km away
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="content-card profile-availability">
          <span className="section-kicker">NEXT AVAILABLE</span>

          <h2>Check availability</h2>

          {upcomingSlots.length ? (
            <div className="profile-slots">
              {upcomingSlots.map((slot) => (
                <span key={slot.start_unix}>
                  {new Date(Number(slot.start_unix) * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
              ))}
            </div>
          ) : (
            <p>No upcoming slot is shown in the current search result.</p>
          )}
        </section>
      </div>

      <section className="content-card profile-schedule">
        <div className="profile-schedule-heading">
          <div>
            <span className="section-kicker">
              <CalendarDays size={15} /> SCHEDULE
            </span>
            <h2>Choose a meeting time</h2>
            <p>
              Select an available slot below to schedule a meeting.
            </p>
          </div>
        </div>

        <CalendarSlots
          slots={upcomingSlots}
          selectedSlot={selected}
          onSelect={setSelected}
          loadSlots={(startUnix, endUnix) => api.resourceAvailability(resourceId, startUnix, endUnix)}
        />

        <div className="booking-confirm">
          <div>
            <span className="section-kicker">YOUR SELECTION</span>
            {selected ? (
              <p className="selected-slot">
                {new Date(
                  Number(selected.start_unix) * 1000,
                ).toLocaleString([], {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
            ) : (
              <h3>Select a slot from the calendar</h3>
            )}
          </div>

          <button
            type="button"
            className="button button-primary button-large"
            disabled={isAuthenticated && !selected}
            onClick={confirm}
          >
            <CheckCircle2 size={17} />
            {!isAuthenticated ? "Login to schedule" : selected ? "Confirm slot" : "Select slot"}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {booking && (
          <div className="booking-success">
            <CheckCircle2 size={22} />
            <div>
              <strong>Meeting scheduled</strong>
              <p>Reference: {booking.reference_code}</p>
              <Link to="/bookings">Open events</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
