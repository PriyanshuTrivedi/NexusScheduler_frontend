import React from "react";
import { CalendarDays, ChevronDown, Filter, MapPinned, Search, UserRound } from "lucide-react";
import "./SearchTree.css";

const TIME_OPTIONS = [
  ["", "Any time"],
  ["morning", "Morning — 06:00–12:00"],
  ["afternoon", "Afternoon — 12:00–17:00"],
  ["evening", "Evening — 17:00–21:00"],
  ["night", "Night — 21:00–00:00"],
];

const DISTANCE_OPTIONS = [
  ["", "Any distance"],
  ["5", "Within 5 km"],
  ["10", "Within 10 km"],
  ["20", "Within 20 km"],
  ["50", "Within 50 km"],
];

const SORT_OPTIONS = [
  ["earliest", "Earliest availability"],
  ["name", "Name: A → Z"],
  ["closest", "Closest to me"],
];

function Field({ label, children, required }) {
  return (
    <label className="tree-field">
      <span>{label}{required && <b>*</b>}</span>
      {children}
    </label>
  );
}

export default function SearchTree({ filters, setFilters, resourceTypes, organizations, onSubmit, loading, onNeedLocation }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const offline = filters.mode === "offline";

  return (
    <form className="search-tree" onSubmit={onSubmit}>
      <div className="tree-header">
        <div>
          <span className="section-kicker"><Filter size={15} /> DISCOVER</span>
          <h2>Find a resource</h2>
          <p>Start from what you need. Optional filters branch out only when they become useful.</p>
        </div>
        <div className="tree-caption"><Search size={15} /> Human-friendly search</div>
      </div>

      <div className="tree-root">
        <div className="root-node">
          <span className="root-icon"><Search size={21} /></span>
          <div className="root-content"><small>REQUIRED START</small><strong>Resource type</strong><span>What kind of person or service are you looking for?</span></div>
          <select value={filters.resourceTypeId} onChange={(e) => update("resourceTypeId", e.target.value)} required>
            <option value="">Select resource type</option>
            {resourceTypes.map((type) => (
              <option key={type.resource_type_id} value={type.resource_type_id}>{type.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="tree-trunk" />
      <div className="tree-branches primary-branches">
        <div className="branch-line" />
        <div className="tree-node">
          <div className="node-title"><UserRound size={16} /> Provider type</div>
          <select value={filters.tenantType} onChange={(e) => update("tenantType", e.target.value)}>
            <option value="">Any</option>
            <option value="individual">Individual</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        <div className="tree-node">
          <div className="node-title"><Search size={16} /> Resource name</div>
          <input value={filters.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Dr. Mehta" />
        </div>

        <div className="tree-node">
          <div className="node-title"><MapPinned size={16} /> Meeting mode</div>
          <select value={filters.mode} onChange={(e) => update("mode", e.target.value)}>
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
          {!filters.mode && (
            <div className="mode-bars">
              <span><i className="online" /> Online</span>
              <span><i className="offline" /> Offline</span>
              <span><i className="hybrid" /> Hybrid</span>
            </div>
          )}
        </div>
      </div>

      <div className="tree-secondary">
        <div className="tree-node date-node">
          <div className="node-title"><CalendarDays size={16} /> Date</div>
          <input type="date" value={filters.date} onChange={(e) => update("date", e.target.value)} />
        </div>
        <div className="tree-node time-node">
          <div className="node-title"><CalendarDays size={16} /> Time</div>
          <select value={filters.time} onChange={(e) => update("time", e.target.value)}>
            {TIME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {filters.tenantType === "organization" && (
        <div className="conditional-branch">
          <div className="conditional-connector" />
          <Field label="Organization" required>
            <select value={filters.orgId} onChange={(e) => update("orgId", e.target.value)} required>
              <option value="">Select organization</option>
              {organizations.map((org) => <option key={org.organization_id} value={org.organization_id}>{org.name}</option>)}
            </select>
          </Field>
        </div>
      )}

      {offline && (
        <div className="conditional-branch distance-branch">
          <div className="conditional-connector" />
          <div className="distance-card">
            <div className="node-title"><MapPinned size={16} /> Search within</div>
            <select value={filters.radius} onChange={(e) => {
              const value = e.target.value;
              update("radius", value);
              if (value) onNeedLocation(value);
            }}>
              {DISTANCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {filters.radius && <div className="distance-note">Uses your current location to calculate nearby resources.</div>}
          </div>
        </div>
      )}

      <div className="search-footer">
        <div className="sort-wrap">
          <Field label="Sort by">
            <select value={filters.sort} onChange={(e) => update("sort", e.target.value)}>
              {SORT_OPTIONS.filter(([value]) => value !== "closest" || offline).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        </div>
        <button className="button button-primary button-large search-button" disabled={loading}>
          <Search size={18} /> {loading ? "Searching…" : "Search resources"}
        </button>
      </div>
    </form>
  );
}

export { TIME_OPTIONS };
