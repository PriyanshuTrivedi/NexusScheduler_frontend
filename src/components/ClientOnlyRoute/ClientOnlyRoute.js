import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ClientOnlyRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="route-loader">Checking your session…</div>;
  }

  if (isAuthenticated) {
    const role = String(user?.role || "").replace("USER_ROLE_", "");
    if (role !== "CLIENT") {
      return <Navigate to="/bookings" replace state={{ from: location.pathname }} />;
    }
  }

  return children;
}
