const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080/api/v1";

async function request(path, options = {}) {
  const token = localStorage.getItem("nexus_jwt");
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    let message =
      data.message || data.error || data.code || `Request failed (${response.status})`;
    // Never expose raw protobuf/serialization errors to end users.
    if (/^proto:\s*/i.test(message) || /invalid value for .* field/i.test(message)) {
      message = "Something went wrong while saving your changes. Please check the entered values and try again.";
    }

    throw new Error(message);
  }

  return data;
}

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const value = search.toString();
  return value ? `?${value}` : "";
};

export const api = {
  registerClient: (body) =>
    request("/auth/client/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  registerResource: (body) =>
    request("/auth/resource/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  loginClient: (body) =>
    request("/auth/client/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  loginResource: (body) =>
    request("/auth/resource/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request("/users/me"),

  updateProfile: (body) =>
    request("/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  organizations: () => request("/organizations"),

  organization: (id) => request(`/organizations/${id}`),

  createOrganization: (body) =>
    request("/organizations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resourceTypes: () => request("/resource-types"),

  createResourceType: (body) =>
    request("/resource-types", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  searchResources: (body) =>
    request("/resources/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createResource: (body) =>
    request("/resources", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  myResource: () => request("/resources/me"),

  resourceById: (id) => request(`/resources/${encodeURIComponent(id)}`),

  resourceSlots: (id, startUnix, endUnix) =>
    request(
      `/resources/${encodeURIComponent(id)}/slots${qs({
        start_unix: startUnix,
        end_unix: endUnix,
      })}`,
    ),

  addSlotException: (id, body) =>
  request(`/resources/${encodeURIComponent(id)}/slots`, {
    method: "POST",
    body: JSON.stringify(body),
  }),

  myAvailability: () => request("/resources/me/availability"),

  resourceAvailability: (id, startUnix, endUnix) =>
    request(
      `/resources/${encodeURIComponent(id)}/availability${qs({
        start_unix: startUnix,
        end_unix: endUnix,
      })}`,
    ),

  resourceAvailability: (id, startUnix, endUnix) =>
    request(
      `/resources/${encodeURIComponent(id)}/availability${qs({
        start_unix: startUnix,
        end_unix: endUnix,
      })}`,
    ),
  updateResource: (body) =>
    request("/resources/me", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  setResourceStatus: (id, body) =>
    request(`/resources/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  setAvailability: (id, body) =>
    request(`/resources/${id}/availability`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setMyAvailability: (body) =>
    request("/resources/me/availability", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  getSlot: (id) => request(`/slots/${id}`),

  createBooking: (body) =>
    request("/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  booking: (reference) =>
    request(`/bookings/${encodeURIComponent(reference)}`),

  upcomingBookings: () => request("/bookings/me/upcoming"),

  pastBookings: () => request("/bookings/me/past"),

  pastBookings: () => request("/bookings/me/past"),
  cancelBooking: (reference) =>
    request(`/bookings/${encodeURIComponent(reference)}/cancel`, {
      method: "POST",
    }),

  rescheduleBooking: (reference, body) =>
    request(`/bookings/${encodeURIComponent(reference)}/reschedule`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resourceUpcomingBookings: () => request("/resources/me/upcoming"),

  resourcePastBookings: () => request("/resources/me/past"),

  queryString: qs,
};