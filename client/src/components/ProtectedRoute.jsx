// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/*
  Props:
   - children: the protected element to render
   - requiredRole: optional string "student" or "faculty" to enforce role-based access

  Behavior:
   - While checking, shows a simple "Loading..." text (you can replace with spinner)
   - If not authenticated -> redirect to '/'
   - If requiredRole provided and user role does not match -> redirect to '/'
*/

export default function ProtectedRoute({ children, requiredRole = null }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        setChecking(false);
        return;
      }

      if (!requiredRole) {
        setAllowed(true);
        setChecking(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const role = snap.exists() ? snap.data().role : null;
        setAllowed(role === requiredRole);
      } catch (err) {
        console.error("ProtectedRoute error:", err);
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [requiredRole]);

  if (checking) return <div style={{padding:20}}>Loading...</div>;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
