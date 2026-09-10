import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthRoleChooser from "../../components/AuthRoleChooser/AuthRoleChooser";
import RecurringAvailabilityModal from "../../components/RecurringAvailabilityModal/RecurringAvailabilityModal";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./auth.css";

const MODES = [
  ["online", "Online", "Meet virtually"],
  ["offline", "Offline", "Meet in person"],
  ["hybrid", "Hybrid", "Offer both"],
];

const CREATE_NEW = "__create_new__";

function friendlyError(error, fallback) {
  const message = String(error?.message || "").trim();

  if (!message) return fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "We couldn't connect to the server. Please try again.";
  }
  if (/already exists|duplicate|unique/i.test(message)) {
    return "That value already exists. Please choose a different one.";
  }
  if (/relation .* does not exist|sqlstate|store:|internal/i.test(message)) {
    return fallback;
  }

  return message;
}

export default function Register() {
  const { role } = useParams();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [identifierType, setIdentifierType] = useState("email");
  const [tenantType, setTenantType] = useState("individual");
  const [meetingMode, setMeetingMode] = useState("online");
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringSchedule, setRecurringSchedule] = useState(null);

  const [resourceTypes, setResourceTypes] = useState([]);
  const [organizations, setOrganizations] = useState([]);

  const [creationDialog, setCreationDialog] = useState(null);
  const [creationName, setCreationName] = useState("");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    identifier: "",
    password: "",
    resourceTypeId: "",
    orgId: "",
    address: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== "resource") return;

    Promise.all([api.resourceTypes(), api.organizations()])
      .then(([types, orgs]) => {
        setResourceTypes(types.resource_types || []);
        setOrganizations(orgs.organizations || []);
      })
      .catch(() => {
        // Keep the form usable. A useful message is shown when the user
        // actually tries to use an unavailable option instead of exposing
        // raw API/JavaScript errors during page load.
        setResourceTypes([]);
        setOrganizations([]);
      });
  }, [role]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectedType = useMemo(
    () =>
      resourceTypes.find(
        (type) => type.resource_type_id === form.resourceTypeId,
      ),
    [resourceTypes, form.resourceTypeId],
  );

  const openCreateDialog = (type) => {
    setCreationDialog(type);
    setCreationName("");
    setError("");
  };

  const closeCreateDialog = () => {
    setCreationDialog(null);
    setCreationName("");
  };

  const createFromDialog = async () => {
    const name = creationName.trim();
    if (!name || !creationDialog) return;

    try {
      setCreating(true);
      setError("");

      if (creationDialog === "resourceType") {
        const response = await api.createResourceType({ name });
        const type = response.resource_type;

        if (!type?.resource_type_id) {
          throw new Error("The resource type could not be created.");
        }

        setResourceTypes((current) => {
          const exists = current.some(
            (item) => item.resource_type_id === type.resource_type_id,
          );
          return exists ? current : [...current, type];
        });
        update("resourceTypeId", type.resource_type_id);
      } else {
        const response = await api.createOrganization({ name });
        const organization = response.organization;

        if (!organization?.organization_id) {
          throw new Error("The organization could not be created.");
        }

        setOrganizations((current) => {
          const exists = current.some(
            (item) =>
              item.organization_id === organization.organization_id,
          );
          return exists ? current : [...current, organization];
        });
        update("orgId", organization.organization_id);
      }

      closeCreateDialog();
    } catch (err) {
      setError(
        friendlyError(
          err,
          creationDialog === "resourceType"
            ? "We couldn't create that resource type."
            : "We couldn't create that organization.",
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  const changeIdentifierType = (type) => {
    if (type === identifierType) return;
    setIdentifierType(type);
    // Email and phone are different identifiers; never carry one into the
    // other field when the user switches tabs.
    update("identifier", "");
    setError("");
  };

  const handleResourceTypeChange = (value) => {
    if (value === CREATE_NEW) {
      openCreateDialog("resourceType");
      return;
    }
    update("resourceTypeId", value);
  };

  const handleOrganizationChange = (value) => {
    if (value === CREATE_NEW) {
      openCreateDialog("organization");
      return;
    }
    update("orgId", value);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.name.trim()) {
        throw new Error("Enter your full name.");
      }

      if (!form.identifier.trim()) {
        throw new Error(
          identifierType === "email"
            ? "Enter your email address."
            : "Enter your mobile number.",
        );
      }

      if (role === "client") {
        await register("client", {
          name: form.name.trim(),
          identifier: { [identifierType]: form.identifier.trim() },
          password: form.password,
        });
        navigate("/bookings", { replace: true });
        return;
      }

      if (!form.resourceTypeId) {
        throw new Error("Select a resource type before creating your account.");
      }

      if (tenantType === "organization" && !form.orgId) {
        throw new Error("Select an organization before creating your account.");
      }

      if (meetingMode !== "online" && !form.address.trim()) {
        throw new Error("Enter the address where clients will meet you.");
      }

      const body = {
        name: form.name.trim(),
        identifier: { [identifierType]: form.identifier.trim() },
        password: form.password,
        tenant_type:
          tenantType === "organization"
            ? "TENANT_TYPE_ORG"
            : "TENANT_TYPE_INDIVIDUAL",
        org_id: tenantType === "organization" ? form.orgId : undefined,
        resource_type_id: form.resourceTypeId,
        meeting_mode: `MEETING_MODE_${meetingMode.toUpperCase()}`,
        address: meetingMode !== "online" ? form.address.trim() : undefined,
        recurrence: recurringEnabled ? (recurringSchedule?.recurrence || []) : [],
      };

      await register("resource", body);

      navigate("/login/resource", {
        replace: true,
        state: { registered: true, resourceType: selectedType?.name },
      });
    } catch (err) {
      setError(
        friendlyError(
          err,
          "We couldn't create your account. Please check the details and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!role) return <AuthRoleChooser mode="register" />;

  const isResource = role === "resource";

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <Link className="back-link" to="/register">
          <ArrowLeft size={15} /> Choose another account
        </Link>

        <span className="section-kicker">
          {isResource ? "RESOURCE ACCOUNT" : "CLIENT ACCOUNT"}
        </span>

        <h1>
          {isResource ? "Start offering a resource." : "Start scheduling."}
        </h1>

        <p>
          {isResource
            ? "Set up the resource people will discover and book."
            : "Create an account to discover resources and book available slots."}
        </p>
      </div>

      <form className="auth-card auth-registration-card" onSubmit={submit}>
        <div className="auth-card-heading">
          <span className="brand-mark small">N</span>
          <div>
            <h2>Create account</h2>
            <p>{isResource ? "Resource access" : "Client access"}</p>
          </div>
        </div>

        <label className="field">
          Full name
          <span className="input-icon-wrap">
            <UserRound size={16} />
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
              placeholder={isResource ? "e.g. Dr. Mehta" : "Your name"}
            />
          </span>
        </label>

        {isResource && (
          <>
            <div className="registration-section-heading">
              <span>1</span>
              <div>
                <strong>Resource details</strong>
                <small>What are you offering?</small>
              </div>
            </div>

            <label className="field">
              Resource type
              <select
                value={form.resourceTypeId}
                onChange={(event) =>
                  handleResourceTypeChange(event.target.value)
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
                <option value={CREATE_NEW}>＋ Create new resource type</option>
              </select>
            </label>

            <div className="registration-section-heading">
              <span>2</span>
              <div>
                <strong>Provider</strong>
                <small>
                  Are you offering this yourself or through an organization?
                </small>
              </div>
            </div>

            <div className="provider-type-grid">
              <button
                type="button"
                className={tenantType === "individual" ? "active" : ""}
                onClick={() => {
                  setTenantType("individual");
                  update("orgId", "");
                }}
              >
                <UserRound size={17} />
                <strong>Individual</strong>
                <span>I offer my own resource.</span>
              </button>

              <button
                type="button"
                className={tenantType === "organization" ? "active" : ""}
                onClick={() => setTenantType("organization")}
              >
                <Building2 size={17} />
                <strong>Organization</strong>
                <span>This resource belongs to an organization.</span>
              </button>
            </div>

            {tenantType === "organization" && (
              <label className="field">
                Organization
                <select
                  value={form.orgId}
                  onChange={(event) =>
                    handleOrganizationChange(event.target.value)
                  }
                  required
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
                  <option value={CREATE_NEW}>＋ Create new organization</option>
                </select>
              </label>
            )}

            <div className="registration-section-heading">
              <span>3</span>
              <div>
                <strong>Meeting mode</strong>
                <small>How will clients meet you?</small>
              </div>
            </div>

            <div className="meeting-registration-options">
              {MODES.map(([value, label, description]) => (
                <button
                  type="button"
                  key={value}
                  className={meetingMode === value ? "active" : ""}
                  onClick={() => setMeetingMode(value)}
                >
                  <Video size={17} />
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>

            <label className={`field registration-address-field ${meetingMode === "online" ? "field-faded" : ""}`}>
              <span className="field-label-with-icon"><MapPin size={15} /> Meeting address</span>
              <input
                value={form.address}
                onChange={(event) => update("address", event.target.value)}
                required={meetingMode !== "online"}
                disabled={meetingMode === "online"}
                placeholder={meetingMode === "online" ? "Not required for online meetings" : "e.g. 12 Hazratganj, Lucknow"}
              />
              <small className="field-help">Required for offline and hybrid meetings. Coordinates are updated automatically.</small>
            </label>

            <div className="recurring-registration-card">
              <div>
                <strong>Add recurring schedule</strong>
                <small>Set regular availability clients can book.</small>
              </div>
              <label className="schedule-checkbox"><input type="checkbox" checked={recurringEnabled} onChange={(event) => { setRecurringEnabled(event.target.checked); if (event.target.checked) setRecurringOpen(true); }} /><span>Add recurring schedule</span></label>
              <button type="button" className="button button-secondary" onClick={() => { setRecurringEnabled(true); setRecurringOpen(true); }}><Plus size={15} /> Add recurring availability</button>
            </div>
          </>
        )}

        <div className="registration-section-heading">
          <span>{isResource ? "4" : "1"}</span>
          <div>
            <strong>Account access</strong>
            <small>How should you sign in?</small>
          </div>
        </div>

        <div className="identifier-switch">
          <button
            type="button"
            className={identifierType === "email" ? "active" : ""}
            onClick={() => changeIdentifierType("email")}
          >
            <Mail size={15} /> Email
          </button>
          <button
            type="button"
            className={identifierType === "phone" ? "active" : ""}
            onClick={() => changeIdentifierType("phone")}
          >
            <Phone size={15} /> Mobile
          </button>
        </div>

        <label className="field">
          {identifierType === "email" ? "Email address" : "Mobile number"}
          <input
            type={identifierType === "email" ? "email" : "tel"}
            value={form.identifier}
            onChange={(event) => update("identifier", event.target.value)}
            required
            placeholder={
              identifierType === "email"
                ? "you@example.com"
                : "+91 98765 43210"
            }
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            required
            placeholder="At least 8 characters"
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <button
          className="button button-primary button-large full"
          disabled={loading || creating}
        >
          {loading ? "Creating account…" : "Create account"}
          <ArrowRight size={17} />
        </button>

        <p className="auth-footer">
          Already have an account? <Link to={`/login/${role}`}>Sign in</Link>
        </p>
      </form>

      {recurringOpen && (
        <RecurringAvailabilityModal
          open={recurringOpen}
          onClose={() => setRecurringOpen(false)}
          onSave={async (body) => {
            setRecurringSchedule(body);
            setRecurringEnabled(true);
          }}
        />
      )}

      {creationDialog && (
        <div className="creation-dialog-backdrop" onMouseDown={closeCreateDialog}>
          <div
            className="creation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="creation-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="creation-dialog-close"
              onClick={closeCreateDialog}
              disabled={creating}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="creation-dialog-icon">
              <Plus size={20} />
            </div>

            <h3 id="creation-dialog-title">
              {creationDialog === "resourceType"
                ? "Create resource type"
                : "Create organization"}
            </h3>
            <p>
              {creationDialog === "resourceType"
                ? "Add a new resource type. It will be available for this registration."
                : "Add the organization name. It will be available for this registration."}
            </p>

            <label className="field creation-dialog-field">
              {creationDialog === "resourceType"
                ? "Resource type name"
                : "Organization name"}
              <input
                autoFocus
                value={creationName}
                onChange={(event) => setCreationName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createFromDialog();
                  }
                }}
                placeholder={
                  creationDialog === "resourceType"
                    ? "e.g. Cardiologist"
                    : "e.g. Apollo Medics"
                }
              />
            </label>

            <div className="creation-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeCreateDialog}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={createFromDialog}
                disabled={creating || !creationName.trim()}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
