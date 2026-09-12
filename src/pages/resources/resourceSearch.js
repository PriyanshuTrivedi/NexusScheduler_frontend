import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  RotateCcw,
  Search,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";

import { api } from "../../api";
import ResourceCard from "../../components/ResourceCard/ResourceCard";

import "./resourceSearch.css";

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

const TIME_RANGES = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 24],
};

function createInitialFilters() {
  return {
    resourceTypeId: "",
    tenantType: "",
    orgId: "",
    name: "",
    mode: "",
    date: "",
    time: "",
    radius: "",
    lat: "",
    lng: "",
    sort: "earliest",
  };
}

function toUnix(date, hour) {
  const value = new Date(`${date}T00:00:00`);
  value.setHours(hour, 0, 0, 0);
  return Math.floor(value.getTime() / 1000);
}

function sortResults(resources, sort) {
  return [...resources].sort((a, b) => {
    if (sort === "name") {
      return String(a.name).localeCompare(String(b.name));
    }

    if (sort === "closest") {
      return (
        Number(a.distance_km ?? Infinity) -
        Number(b.distance_km ?? Infinity)
      );
    }

    const aSlot = Number(
      a.next_available_slot_time?.start_unix ?? Infinity,
    );
    const bSlot = Number(
      b.next_available_slot_time?.start_unix ?? Infinity,
    );

    return aSlot - bSlot;
  });
}

function getResourceTypeIcon(name) {
  const value = String(name || "").toLowerCase();

  if (value.includes("doctor") || value.includes("medical")) {
    return <Stethoscope size={21} />;
  }

  return <UserRound size={21} />;
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location search is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        reject(
          new Error(
            "Location permission is required when a distance filter is selected.",
          ),
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  });
}

export default function ResourceSearch() {
  const [resourceTypes, setResourceTypes] = useState([]);
  const [organizations, setOrganizations] = useState([]);

  const [filters, setFilters] = useState(createInitialFilters);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultMode, setResultMode] = useState("");

  useEffect(() => {
    let mounted = true;

    Promise.all([api.resourceTypes(), api.organizations()])
      .then(([typesResponse, orgResponse]) => {
        if (!mounted) {
          return;
        }

        setResourceTypes(typesResponse?.resource_types || []);
        setOrganizations(orgResponse?.organizations || []);
      })
      .catch(() => {
        // Do not show metadata/network failures as a page-level
        // "Failed to fetch" error before the user searches.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedResourceType = useMemo(
    () =>
      resourceTypes.find(
        (type) => type.resource_type_id === filters.resourceTypeId,
      ),
    [resourceTypes, filters.resourceTypeId],
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateTenantType = (value) => {
    setFilters((current) => ({
      ...current,
      tenantType: value,
      orgId: value === "organization" ? current.orgId : "",
    }));
  };

  const updateMeetingMode = (value) => {
    setFilters((current) => ({
      ...current,
      mode: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!filters.resourceTypeId) {
      setError("Select a resource type to start the search.");
      return;
    }

    if (filters.tenantType === "organization" && !filters.orgId) {
      setError("Select an organization.");
      return;
    }

    setLoading(true);

    try {
      let latitude = filters.lat;
      let longitude = filters.lng;

      // The distance filter is available for every meeting-mode selection.
      // If the user actually chooses a distance, obtain the coordinates
      // automatically instead of displaying a separate location button.
      if (filters.radius && (!latitude || !longitude)) {
        const location = await getCurrentLocation();
        latitude = String(location.lat);
        longitude = String(location.lng);

        setFilters((current) => ({
          ...current,
          lat: latitude,
          lng: longitude,
        }));
      }

      let windowStart;
      let windowEnd;

      if (filters.date) {
        const range = TIME_RANGES[filters.time];

        windowStart = toUnix(filters.date, range ? range[0] : 0);
        windowEnd = toUnix(filters.date, range ? range[1] : 24);
      }

      const response = await api.searchResources({
        resource_type_id: filters.resourceTypeId,

        tenant_type:
          filters.tenantType === "individual"
            ? "TENANT_TYPE_INDIVIDUAL"
            : filters.tenantType === "organization"
              ? "TENANT_TYPE_ORG"
              : undefined,

        org_id: filters.orgId || undefined,
        name: filters.name || undefined,

        meeting_mode: filters.mode
          ? `MEETING_MODE_${filters.mode.toUpperCase()}`
          : undefined,

        lat: latitude ? Number(latitude) : undefined,
        lng: longitude ? Number(longitude) : undefined,
        radius_km: filters.radius ? Number(filters.radius) : undefined,

        window_start_unix: windowStart,
        window_end_unix: windowEnd,
      });

      let resources = response?.resources || [];

      setResults(sortResults(resources, filters.sort));
      setSearched(true);
    } catch (err) {
      setSearched(false);
      setError(
        err?.message || "Unable to search resources. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setFilters(createInitialFilters());
    setResults([]);
    setSearched(false);
    setResultMode("");
    setError("");
  };

  const showOrganization = filters.tenantType === "organization";

  const displayedResults = resultMode
    ? results.filter(
        (resource) =>
          String(resource.meeting_mode || "")
            .replace("MEETING_MODE_", "")
            .toLowerCase() === resultMode,
      )
    : results;

  return (
    <div className="page-container resource-search-page">
      <header className="resource-search-header">
        <div>
          <h1>Find resources</h1>
          <p>Search and book the right resource for your needs</p>
        </div>

        <div className="resource-search-actions">
          <button
            type="button"
            className="clear-all-button"
            onClick={clear}
          >
            <RotateCcw size={17} />
            Clear all
          </button>

          <button
            type="button"
            className="button button-primary search-top-button"
            onClick={submit}
            disabled={loading}
          >
            <Search size={18} />
            {loading ? "Searching…" : "Search resources"}
          </button>
        </div>
      </header>

      <form className="resource-filter-panel" onSubmit={submit}>
        {/* Resource type + resource name */}
        <section className="filter-row resource-type-row">
          <div className="filter-icon">
            {getResourceTypeIcon(selectedResourceType?.name)}
          </div>

          <div className="filter-description">
            <h2>
              Resource type <span>*</span>
            </h2>
            <p>What type of resource do you need?</p>
          </div>

          <div className="filter-control resource-type-control">
            <div className="select-shell">
              <select
                value={filters.resourceTypeId}
                onChange={(event) =>
                  updateFilter("resourceTypeId", event.target.value)
                }
                required
              >
                <option value="">Select resource type</option>
                {resourceTypes.map((type) => (
                  <option
                    key={type.resource_type_id}
                    value={type.resource_type_id}
                  >
                    {type.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={18} />
            </div>
          </div>

          <div className="filter-extra resource-name-control">
            <label>
              Resource name <span>(optional)</span>
            </label>
            <input
              value={filters.name}
              onChange={(event) => updateFilter("name", event.target.value)}
              placeholder="e.g. Dr. Mehta, Cardiologist, Physiotherapist"
            />
          </div>
        </section>

        {/* Provider + organization */}
        <section className="filter-row provider-row">
          <div className="filter-icon">
            <UserRound size={21} />
          </div>

          <div className="filter-description">
            <h2>Provider</h2>
            <p>Who would you prefer?</p>
          </div>

          <div className="provider-options">
            {[
              ["", "Any"],
              ["individual", "Individual"],
              ["organization", "Organization"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value || "any"}
                className={filters.tenantType === value ? "active" : ""}
                onClick={() => updateTenantType(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="filter-extra provider-org-control">
            <label>Organization</label>

            <div className="select-shell">
              <select
                value={filters.orgId}
                onChange={(event) =>
                  updateFilter("orgId", event.target.value)
                }
                disabled={!showOrganization}
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option
                    key={organization.organization_id}
                    value={organization.organization_id}
                  >
                    {organization.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={18} />
            </div>
          </div>
        </section>

        {/* Meeting mode */}
        <section className="filter-row meeting-row">
          <div className="filter-icon">
            <Video size={21} />
          </div>

          <div className="filter-description">
            <h2>Meeting mode</h2>
            <p>How do you want to meet?</p>
          </div>

          <div className="meeting-options">
            {[
              ["", "Any", "Show all meeting modes"],
              [
                "offline",
                "Offline",
                "Show only offline (in-person) meetings",
              ],
            ].map(([value, label, description]) => (
              <button
                type="button"
                key={value || "any"}
                className={filters.mode === value ? "active" : ""}
                onClick={() => updateMeetingMode(value)}
              >
                <span className="radio-dot" />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>

          {/* Never remove this block. Offline only fades it. */}
          <div
            className={`meeting-mode-summary ${
              filters.mode === "offline"
                ? "meeting-mode-summary-faded"
                : ""
            }`}
          >
            <span>
              <i className="online-dot" />
              Online
              <small>Virtual meetings</small>
            </span>
            <span>
              <i className="offline-dot" />
              Offline
              <small>In-person meetings</small>
            </span>
            <span>
              <i className="hybrid-dot" />
              Hybrid
              <small>Both online and offline</small>
            </span>
          </div>
        </section>

        {/* Date */}
        <section className="filter-row date-row">
          <div className="filter-icon">
            <CalendarDays size={21} />
          </div>

          <div className="filter-description">
            <h2>Date</h2>
            <p>When do you want to meet?</p>
          </div>

          <div className="date-options">
            <label className="date-choice">
              <input
                type="radio"
                name="date-mode"
                checked={!filters.date}
                onChange={() => updateFilter("date", "")}
              />
              <span>
                <strong>Any date</strong>
                <small>Show results for all available dates</small>
              </span>
            </label>

            <label className="date-choice">
              <input
                type="radio"
                name="date-mode"
                checked={Boolean(filters.date)}
                onChange={() => {
                  if (!filters.date) {
                    updateFilter(
                      "date",
                      new Date().toISOString().slice(0, 10),
                    );
                  }
                }}
              />
              <span>
                <strong>Specific date</strong>
                <small>Choose a particular date</small>
              </span>
            </label>
          </div>

          <div className="filter-extra date-control">
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
            />
          </div>
        </section>

        {/* Time */}
        <section className="filter-row time-row">
          <div className="filter-icon">
            <Clock3 size={21} />
          </div>

          <div className="filter-description">
            <h2>Time</h2>
            <p>What time works for you?</p>
          </div>

          <div className="filter-control time-control">
            <div className="select-shell">
              <select
                value={filters.time}
                onChange={(event) => updateFilter("time", event.target.value)}
              >
                {TIME_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={18} />
            </div>
            <small>You can refine time while viewing availability</small>
          </div>
        </section>

        {/* Search within — always visible */}
        <section className="filter-row distance-row">
          <div className="filter-icon">
            <MapPin size={21} />
          </div>

          <div className="filter-description">
            <h2>Search within (for offline)</h2>
            <p>How far are you willing to travel?</p>
          </div>

          <div className="filter-control distance-control">
            <div className="select-shell">
              <select
                value={filters.radius}
                onChange={(event) =>
                  updateFilter("radius", event.target.value)
                }
              >
                {DISTANCE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="select-icon" size={18} />
            </div>
          </div>
        </section>

        <div className="smart-search-note">
          <span className="smart-search-icon">✦</span>
          <strong>Smart search</strong>
          <span>
            We&apos;ll show you the best matching resources based on your
            preferences
          </span>
        </div>
      </form>

      {error && <div className="search-error">{error}</div>}

      {/* Results are intentionally rendered only after Search resources. */}
      {searched && (
        <section className="results-panel">
          <div className="results-tabs">
            <button
              className={!resultMode ? "active" : ""}
              type="button"
              onClick={() => setResultMode("")}
            >
              All results <span>{results.length}</span>
            </button>

            {[
              ["online", "Online"],
              ["offline", "Offline"],
              ["hybrid", "Hybrid"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={resultMode === value ? "active" : ""}
                type="button"
                onClick={() => setResultMode(value)}
              >
                {label}
              </button>
            ))}

            <label className="sort-control">
              <span>Sort by</span>
              <div className="select-shell">
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    updateFilter("sort", event.target.value)
                  }
                >
                  {SORT_OPTIONS.filter(
                    ([value]) =>
                      value !== "closest" || Boolean(filters.radius),
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="select-icon" size={18} />
              </div>
            </label>
          </div>

          {displayedResults.length === 0 ? (
            <div className="empty-results">
              <Search size={26} />
              <h3>No matching resources</h3>
              <p>Try relaxing one of the optional filters.</p>
            </div>
          ) : (
            <div className="resource-list">
              {displayedResults.map((resource) => (
                <ResourceCard
                  key={resource.resource_id}
                  resource={resource}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
