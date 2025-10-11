import React from "react";
import { Outlet, Link } from "react-router-dom";

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", gap: 20, marginBottom: 20, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>CourseConnect (Prototype)</h2>
        <nav>
          <Link to="/" style={{ marginRight: 10 }}>Login</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

