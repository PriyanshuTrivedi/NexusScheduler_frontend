import React from "react";
import { BriefcaseBusiness, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import "./AuthRoleChooser.css";

export default function AuthRoleChooser({ mode }) {
  return (
    <section className="auth-choice">
      <span className="section-kicker">NEXUS ACCOUNT</span>
      <h1>{mode === "login" ? "How are you using Nexus?" : "Choose your Nexus account"}</h1>
      <p>{mode === "login" ? "Sign in to manage meetings or your resources." : "The path you choose determines what you can manage."}</p>
      <div className="auth-choice-grid">
        <Link className="auth-choice-card" to={`/${mode}/client`}>
          <span className="choice-icon"><UserRound size={24} /></span>
          <div><strong>Client</strong><span>Find resources and schedule meetings.</span></div>
        </Link>
        <Link className="auth-choice-card" to={`/${mode}/resource`}>
          <span className="choice-icon provider"><BriefcaseBusiness size={24} /></span>
          <div><strong>Resource</strong><span>Offer a resource and manage your availability.</span></div>
        </Link>
      </div>
    </section>
  );
}
