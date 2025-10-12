// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClassBoard from "./pages/ClassBoard";
import Login from "./pages/Login"; // adjust path if needed
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import Leaderboard from "./pages/Leaderboard";
import ProtectedRoute from "./components/ProtectedRoute"; // small guard (see implementation below)

import "./index.css"; // optional (tailwind / css)

/*
  Entry point and routing.
  - ProtectedRoute will check Firebase auth and optionally role.
  - If you don't have ProtectedRoute, add the file at src/components/ProtectedRoute.jsx
*/

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/class/:classId/leaderboard" element={<Leaderboard />} />
        <Route path="/class/:classId" element={<ClassBoard />} /> 
        <Route path="/" element={<Login />} />

        {/* Student route: only signed-in users with role 'student' should access */}
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Faculty route: only signed-in users with role 'faculty' should access */}
        <Route
          path="/faculty-dashboard"
          element={
            <ProtectedRoute requiredRole="faculty">
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        {/* fallback -> go to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<AppRoutes />);

