import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import ClientOnlyRoute from "./components/ClientOnlyRoute/ClientOnlyRoute";
import { AuthProvider } from "./context/AuthContext";
import Home from "./pages/home/home";
import Login from "./pages/auth/login";
import Register from "./pages/auth/register";
import ResourceSearch from "./pages/resources/resourceSearch";
import ResourceProfile from "./pages/resources/resourceProfile";
import Bookings from "./pages/bookings/bookings";
import Profile from "./pages/profile/profile";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="app-shell">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:role" element={<Register />} />
            <Route path="/resources" element={<ClientOnlyRoute><ResourceSearch /></ClientOnlyRoute>} />
            <Route path="/resources/:resourceId" element={<ResourceProfile />} />
            <Route path="/resources/:resourceId/slots" element={<ResourceProfile />} />
            <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
