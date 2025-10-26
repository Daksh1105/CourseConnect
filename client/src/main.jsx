// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClassBoard from "./pages/ClassBoard";
import Login from "./pages/Login.jsx"; // adjust path if needed
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import StudentProfilePage from './pages/StudentProfilePage'; // CHANGED: Back to your filename
import Leaderboard from "./pages/LeaderboardPage";
import ProtectedRoute from "./components/ProtectedRoute"; // small guard (see implementation below)

import "./index.css"; // optional (tailwind / css)

/*
  Entry point and routing.
  - ProtectedRoute will check Firebase auth and optionally role.
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

        {/* Profile route for both students and faculty */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole={["student", "faculty"]}>
              <StudentProfilePage /> {/* CHANGED: Back to your filename */}
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