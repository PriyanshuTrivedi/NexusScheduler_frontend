import React, { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./organization.css";

export default function Organization() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const isAdmin = String(user?.role || "").includes("ADMIN");

  const load = async () => {
    try { const response = await api.organizations(); setOrganizations(response.organizations || []); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { await api.createOrganization({ name: name.trim() }); setName(""); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="page-container organization-page">
      <div className="page-heading"><div><span className="section-kicker">ORGANIZATIONS</span><h1>Organizations</h1><p>Browse active organizations available to resource providers.</p></div></div>
      {error && <div className="form-error">{error}</div>}
      <div className="organization-list">{organizations.map((organization) => <article className="organization-card" key={organization.organization_id}><div className="organization-icon"><Building2 size={20} /></div><div><h3>{organization.name}</h3><p>{organization.is_active ? "Active organization" : "Inactive organization"}</p></div></article>)}</div>
      {isAdmin && <div className="content-card compact-form"><span className="section-kicker">ADMIN</span><h2>Create organization</h2><div className="inline-form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Organization name" /><button className="button button-primary" onClick={create}><Plus size={16} /> Create</button></div></div>}
    </div>
  );
}
