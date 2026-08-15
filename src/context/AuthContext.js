import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("nexus_jwt"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api.me()
      .then((response) => setUser(response.user || response))
      .catch(() => {
        localStorage.removeItem("nexus_jwt");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const completeAuth = (response) => {
    if (response.jwt) {
      localStorage.setItem("nexus_jwt", response.jwt);
      setToken(response.jwt);
    }
    setUser(response.user || null);
    return response;
  };

  const login = async (role, body) => {
    const response =
      role === "client" ? await api.loginClient(body) : await api.loginResource(body);
    return completeAuth(response);
  };

  const register = async (role, body) => {
    const response =
      role === "client" ? await api.registerClient(body) : await api.registerResource(body);
    return completeAuth(response);
  };

  const logout = () => {
    localStorage.removeItem("nexus_jwt");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
