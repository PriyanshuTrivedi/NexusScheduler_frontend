import React, { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Mail, MapPin, Phone, Plus, Save, Trash2, UserRound, Video } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import RecurringAvailabilityModal from "../../components/RecurringAvailabilityModal/RecurringAvailabilityModal";
import "./profile.css";

const MODES = [
  ["online", "Online", "Virtual meetings"],
  ["offline", "Offline", "In-person meetings"],
  ["hybrid", "Hybrid", "Both online and offline"],
];

const modeValue = (value) => {
  if (typeof value === "number") return { 1: "online", 2: "offline", 3: "hybrid" }[value] || "online";
  const normalized = String(value || "").replace("MEETING_MODE_", "").toLowerCase();
  if (normalized === "1") return "online";
  if (normalized === "2") return "offline";
  if (normalized === "3") return "hybrid";
  return MODES.some(([key]) => key === normalized) ? normalized : "online";
};

const tenantValue = (value) => String(value || "").replace("TENANT_TYPE_", "").toLowerCase();
const attributeId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Profile() {
  const { user } = useAuth();
  return String(user?.role || "").replace("USER_ROLE_", "") === "RESOURCE" ? <ResourceProfile /> : <ClientProfile />;
}

function RegisteredIdentifier({ user }) {
  const email = user?.identifier?.email || "";
  const phone = user?.identifier?.phone || "";
  if (!email && !phone) return null;
  const isEmail = Boolean(email);
  return (
    <div className="readonly-field registered">
      <span>{isEmail ? "Email address" : "Mobile number"}</span>
      <div>{isEmail ? <Mail size={15} /> : <Phone size={15} />}{isEmail ? email : phone}<small>Registered identifier</small></div>
    </div>
  );
}

function ClientProfile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setName(user?.name || ""), [user]);

  const save = async (event) => {
    event.preventDefault();
    try {
      setError(""); setMessage("");
      await api.updateProfile({ name: name.trim() });
      setEditing(false);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err?.message || "We couldn't update your profile.");
    }
  };

  return (
    <div className="page-container profile-account-page">
      <div className="profile-page-heading">
        <div><span className="section-kicker">ACCOUNT</span><h1>Your profile</h1><p>Manage the basic information associated with your account.</p></div>
        {!editing && <button type="button" className="button button-primary" onClick={() => setEditing(true)}>Edit profile</button>}
      </div>

      <section className="content-card account-card">
        <div className="account-avatar"><UserRound size={28} /></div>
        <div><span className="resource-chip">Client</span><h2>{user?.name || "Client"}</h2><p><RegisteredIcon user={user} /></p></div>
      </section>

      <form className="content-card profile-form" onSubmit={save}>
        <div className="profile-section-heading"><div><h2>Account information</h2><p>Your registration identifier remains unchanged.</p></div></div>
        <label className={`field ${!editing ? "field-readonly" : ""}`}>Full name<input disabled={!editing} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="profile-contact-single"><RegisteredIdentifier user={user} /></div>
        <p className="profile-note">Only the name is editable here. We are keeping contact identifiers fixed for now.</p>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="success-banner"><CheckCircle2 size={16} /> {message}</div>}
        {editing && <div className="profile-actions"><button type="button" className="button button-secondary" onClick={() => { setEditing(false); setName(user?.name || ""); }}>Cancel</button><button type="submit" className="button button-primary"><Save size={16} /> Save changes</button></div>}
      </form>
    </div>
  );
}

function RegisteredIcon({ user }) {
  const email = user?.identifier?.email || "";
  const phone = user?.identifier?.phone || "";
  return <>{email ? <Mail size={14} /> : <Phone size={14} />}{email || phone || "—"}</>;
}

function ResourceProfile() {
  const { user } = useAuth();
  const [resource, setResource] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [form, setForm] = useState({ name: "", mode: "online", address: "" });
  const [attributes, setAttributes] = useState([]);
  const [editing, setEditing] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true); setError("");
      const response = await api.myResource();
      const current = response.resource;
      if (!current) throw new Error("Your resource profile could not be found.");
      setResource(current); setOrganization(response.organization || null);
      setForm({ name: current.name || "", mode: modeValue(current.meeting_mode), address: current.attributes?.address || "" });
      setAttributes(Object.entries(current.attributes || {}).filter(([key]) => key !== "address").map(([key, value]) => ({ id: attributeId(), key, value: typeof value === "string" ? value : JSON.stringify(value) })));
    } catch (err) {
      setError(err?.message || "We couldn't load your resource profile. Please try again.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const providerLabel = useMemo(
    () => organization?.name
      ? `Organization / ${organization.name}`
      : "Individual",
    [organization?.name]
  );
  const isOfflineMode = form.mode !== "online";
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addAttribute = () => setAttributes((current) => [...current, { id: attributeId(), key: "", value: "" }]);
  const updateAttribute = (index, field, value) => setAttributes((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const removeAttribute = (index) => setAttributes((current) => current.filter((_, i) => i !== index));

  const openAvailability = async () => {
    try {
      setAvailabilityLoading(true);
      setError("");
      const response = await api.myAvailability();
      setAvailability(response.recurrence || []);
      setAvailabilityOpen(true);
    } catch (err) {
      setError(err?.message || "We couldn't load your current availability.");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); setError(""); setMessage("");
      if (!form.name.trim()) throw new Error("Enter your resource name.");
      if (isOfflineMode && !form.address.trim()) throw new Error("Enter the address where clients will meet you.");
      const nextAttributes = {};
      attributes.forEach(({ key, value }) => {
        const cleanKey = key.trim(); const cleanValue = value.trim();
        if (cleanKey && cleanKey !== "address" && cleanValue) nextAttributes[cleanKey] = cleanValue;
      });
      await api.updateResource({ resource_id: resource.resource_id, name: form.name.trim(), meeting_mode: `MEETING_MODE_${form.mode.toUpperCase()}`, address: isOfflineMode ? form.address.trim() : undefined, attributes: nextAttributes });
      await load(); setEditing(false); setMessage("Resource profile updated.");
    } catch (err) {
      setError(err?.message || "We couldn't update your resource profile.");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="empty-state">Loading resource profile…</div></div>;

  const email = user?.identifier?.email || "";
  const phone = user?.identifier?.phone || "";

  return (
    <div className="page-container profile-account-page">
      <div className="profile-page-heading">
        <div><span className="section-kicker">RESOURCE PROFILE</span><h1>Your profile</h1><p>Everything clients see before scheduling with you.</p></div>
        <div className="profile-top-actions">
          <button type="button" className="button button-secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit"}</button>
          <button type="button" className="button button-primary" onClick={openAvailability} disabled={availabilityLoading}><Plus size={16} /> {availabilityLoading ? "Loading…" : "Edit availability"}</button>
        </div>
      </div>

      <form className="content-card resource-profile-form" onSubmit={save}>
        <div className="resource-profile-header">
          <div className="resource-profile-person"><div className="account-avatar large">{String(resource?.name || user?.name || "R").slice(0, 2).toUpperCase()}</div><div><h2>{resource?.name || user?.name || "Resource"}</h2><div className="profile-tags"><span>{resource?.resource_type?.name || "Resource"}</span><span>{providerLabel}</span></div></div></div>
          {editing && <div className="profile-actions compact"><button type="submit" className="button button-primary" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save changes"}</button></div>}
        </div>

        <div className="profile-readonly-grid">
          <div className="readonly-field"><span>Resource type</span><div><UserRound size={15} />{resource?.resource_type?.name || "Resource"}</div></div>
          <div className="readonly-field"><span>Provider</span><div>{tenantValue(resource?.tenant_type) === "org" ? <Building2 size={15} /> : <UserRound size={15} />}{providerLabel}</div></div>
        </div>

        <div className="profile-info-grid">
          <label className={`field ${!editing ? "field-readonly" : ""}`}>Resource name<input disabled={!editing} value={form.name} onChange={(event) => update("name", event.target.value)} required /></label>
          <RegisteredIdentifier user={user} />
        </div>

        <div className="profile-subheading"><Video size={17} /> Meeting mode</div>
        <div className="profile-mode-options">
          {MODES.map(([value, label, description]) => <button type="button" key={value} disabled={!editing} className={`${form.mode === value ? "active" : ""} ${!editing && form.mode !== value ? "inactive" : ""}`} onClick={() => update("mode", value)}><strong>{label}</strong><span>{description}</span></button>)}
        </div>

        <label className={`field profile-address ${!isOfflineMode ? "field-faded" : ""}`}> <span className="field-label-with-icon"><MapPin size={15} /> Meeting address</span><input disabled={!editing || !isOfflineMode} value={form.address} onChange={(event) => update("address", event.target.value)} placeholder={isOfflineMode ? "Meeting address" : "Not required for online meetings"} /><small>Required for offline and hybrid meetings. Coordinates are updated automatically.</small></label>

        <div className="attributes-heading"><div><h3>Attributes</h3><p>Add extra information clients should see.</p></div>{editing && <button type="button" className="button button-secondary attribute-add" onClick={addAttribute}><Plus size={15} /> Add attribute</button>}</div>
        <div className="attributes-editor">
          {attributes.length === 0 ? <div className="attributes-empty">No custom attributes added yet.</div> : attributes.map((attribute, index) => (
            <div className={`attribute-row ${editing ? "editing" : ""}`} key={attribute.id}>
              {editing ? (
                <input className="attribute-key-input" value={attribute.key} onChange={(event) => updateAttribute(index, "key", event.target.value)} placeholder="Attribute name" />
              ) : (
                <div className="attribute-key"><span>{attribute.key || "Attribute"}</span></div>
              )}
              {editing ? <input value={attribute.value} onChange={(event) => updateAttribute(index, "value", event.target.value)} placeholder="Value" /> : <strong>{attribute.value}</strong>}
              {editing && <button type="button" className="attribute-remove" onClick={() => removeAttribute(index)} aria-label="Remove attribute"><Trash2 size={16} /></button>}
            </div>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}
        {message && <div className="success-banner"><CheckCircle2 size={16} /> {message}</div>}
      </form>

      <div className="contact-summary"><div><span>Registered via</span><strong>{email || phone}</strong></div><small>The registration identifier is read-only.</small></div>

      <RecurringAvailabilityModal
        open={availabilityOpen}
        initialRecurrence={availability}
        onClose={() => setAvailabilityOpen(false)}
        onSave={async (body) => {
          await api.setMyAvailability(body);
          setAvailability(body.recurrence || []);
          setMessage("Recurring availability updated.");
        }}
      />
    </div>
  );
}
