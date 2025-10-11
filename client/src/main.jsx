import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClassBoard from "./pages/ClassBoard";
import FacultyDashboard from "./pages/FacultyDashboard";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Login />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="class/:classId" element={<ClassBoard />} />
        <Route path="faculty/:classId" element={<FacultyDashboard />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
