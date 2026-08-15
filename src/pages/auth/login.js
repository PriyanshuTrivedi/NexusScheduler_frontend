import React, { useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, Phone } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AuthRoleChooser from "../../components/AuthRoleChooser/AuthRoleChooser";
import { useAuth } from "../../context/AuthContext";
import "./auth.css";

export default function Login() {
  const { role } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [type, setType] = useState("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!role) return <AuthRoleChooser mode="login" />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(role, { identifier: { [type]: identifier }, password });
      navigate(location.state?.from || (role === "resource" ? "/profile" : "/bookings"), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-intro"><Link className="back-link" to="/login"><ArrowLeft size={15} /> Choose another account</Link><span className="section-kicker">{role === "client" ? "CLIENT ACCOUNT" : "RESOURCE PROVIDER"}</span><h1>{role === "client" ? "Welcome back." : "Welcome back, resource."}</h1><p>{role === "client" ? "Search resources and keep your meetings in one place." : "Manage your resource, availability and upcoming meetings."}</p></div>
      <form className="auth-card" onSubmit={submit}>
        {location.state?.registered && <div className="success-banner">Account created. Sign in to continue.</div>}
        <div className="auth-card-heading"><span className="brand-mark small">N</span><div><h2>Sign in</h2><p>{role === "client" ? "Client access" : "Resource access"}</p></div></div>
        <div className="identifier-switch"><button type="button" className={type === "email" ? "active" : ""} onClick={() => setType("email")}><Mail size={15} /> Email</button><button type="button" className={type === "phone" ? "active" : ""} onClick={() => setType("phone")}><Phone size={15} /> Mobile</button></div>
        <label className="field">{type === "email" ? "Email address" : "Mobile number"}<input type={type === "email" ? "email" : "tel"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} required placeholder={type === "email" ? "you@example.com" : "+91 98765 43210"} /></label>
        <label className="field">Password<span className="input-icon-wrap"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Your password" /></span></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button button-primary button-large full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight size={17} /></button>
        <p className="auth-footer">New here? <Link to={`/register/${role}`}>Create a {role === "client" ? "client" : "resource"} account</Link></p>
      </form>
    </div>
  );
}
