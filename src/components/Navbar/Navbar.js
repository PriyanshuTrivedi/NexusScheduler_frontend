import React, { useState } from "react";
import { CalendarDays, LogIn, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

const roleLabel = (role) => {
  const value = String(role || "").replace("USER_ROLE_", "");
  if (value === "RESOURCE") return "Resource";
  if (value === "CLIENT") return "Client";
  return value || "Account";
};

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark">N</span>
          <span><strong>Nexus</strong><small>Scheduler</small></span>
        </Link>

        <button className="mobile-menu" onClick={() => setOpen((value) => !value)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={`nav-links ${open ? "open" : ""}`}>
          {(!isAuthenticated || String(user?.role || "").replace("USER_ROLE_", "") === "CLIENT") && <NavLink to="/resources" onClick={close}><Search size={16} /> Find resources</NavLink>}
          {isAuthenticated && (
            <>
              <NavLink to="/bookings" onClick={close}><CalendarDays size={16} /> Events</NavLink>
              <NavLink to="/profile" onClick={close}><UserRound size={16} /> Profile</NavLink>
            </>
          )}
          {!isAuthenticated ? (
            <Link className="nav-login" to="/login" onClick={close}><LogIn size={16} /> Login</Link>
          ) : (
            <button className="nav-logout" onClick={() => { logout(); close(); }}><LogOut size={16} /> Logout</button>
          )}
        </nav>

        {isAuthenticated && (
          <div className="nav-user">
            <span>{user?.name || "Account"}</span>
            <small>{roleLabel(user?.role)}</small>
          </div>
        )}
      </div>
    </header>
  );
}
