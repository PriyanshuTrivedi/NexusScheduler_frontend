import React from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import "./LocationPermissionModal.css";

export default function LocationPermissionModal({ open, onClose, onAllow, loading }) {
  if (!open) return null;

  return (
    <div className="location-overlay" role="dialog" aria-modal="true">
      <div className="location-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="location-art"><span><MapPin size={28} /></span><div className="pulse" /></div>
        <span className="section-kicker">NEARBY SEARCH</span>
        <h2>Use your current location?</h2>
        <p>Nexus needs your approximate location to show resources within the selected distance. Your coordinates stay out of the filter UI.</p>
        <div className="location-actions">
          <button className="button button-quiet" onClick={onClose}>Not now</button>
          <button className="button button-primary" onClick={onAllow} disabled={loading}><LocateFixed size={17} />{loading ? "Finding you…" : "Use my location"}</button>
        </div>
      </div>
    </div>
  );
}
