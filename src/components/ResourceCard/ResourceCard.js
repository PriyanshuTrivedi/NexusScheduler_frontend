import React from "react";
import { ArrowRight, CalendarDays, MapPin, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import "./ResourceCard.css";

const clean = (value) =>
  String(value || "")
    .replace("MEETING_MODE_", "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const tenant = (value) =>
  String(value || "")
    .replace("TENANT_TYPE_", "")
    .replace("ORG", "Organization")
    .replace("INDIVIDUAL", "Individual");

export default function ResourceCard({ resource }) {
  const distance = resource.distance_km > 0 ? `${Number(resource.distance_km).toFixed(1)} km away` : null;
  const slots = resource.next_available_slots || [];

  return (
    <article className="resource-card">
      <div className="resource-card-main">
        <div className="resource-avatar"><UserRound size={23} /></div>
        <div className="resource-copy">
          <div className="resource-chip-row">
            <span className="resource-chip">{resource.resource_type?.name || "Resource"}</span>
            <span className="provider-chip">{tenant(resource.tenant_type)}</span>
          </div>
          <h3>{resource.name}</h3>
          <div className="resource-meta">
            <span>{clean(resource.meeting_mode)}</span>
            {resource.attributes?.address && <><span>•</span><span><MapPin size={13} /> {resource.attributes.address}</span></>}
            {distance && <><span>•</span><span><MapPin size={13} /> {distance}</span></>}
          </div>
        </div>
      </div>

      <div className="resource-availability">
        <small>NEXT AVAILABLE</small>
        {slots.length ? (
          <div className="slot-preview">
            {slots.slice(0, 2).map((slot) => (
              <span key={`${slot.start_unix}-${slot.end_unix}`}>
                {new Date(Number(slot.start_unix) * 1000).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(Number(slot.start_unix) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </div>
        ) : <span className="no-preview">Check profile</span>}
      </div>

      <div className="resource-actions">
        <Link
          className="button button-primary"
          to={`/resources/${resource.resource_id}`}
          state={{ resource }}
        >
          <CalendarDays size={16} /> View / Schedule <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}
