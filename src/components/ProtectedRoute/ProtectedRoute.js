import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./ProtectedRoute.css";

export default function ProtectedRoute({ children, providerOnly = false }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <div className="route-loader">Checking your session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (providerOnly) {
    const role = String(user?.role || "").replace("USER_ROLE_", "");
    if (role !== "RESOURCE") {
      return <Navigate to="/bookings" replace />;
    }
  }

  return children;
}
