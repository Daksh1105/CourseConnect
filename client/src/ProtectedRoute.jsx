// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // Make sure this path is correct

export default function ProtectedRoute({ children, requiredRole }) {
  const [user, loadingAuth] = useAuthState(auth);
  const [role, setRole] = React.useState(null);
  const [loadingRole, setLoadingRole] = React.useState(true);

  React.useEffect(() => {
    if (!user && !loadingAuth) {
      // Not logged in, no need to check role
      setLoadingRole(false);
      return;
    }
    if (user) {
      // User is logged in, fetch their role from Firestore
      const fetchRole = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            setRole(null); // No user data found in Firestore
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          setRole(null);
        } finally {
          setLoadingRole(false);
        }
      };
      fetchRole();
    }
  }, [user, loadingAuth]);

  // 1. Show loading screen while checking auth and role
  if (loadingAuth || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  // 2. Not logged in, redirect to login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // --- THIS IS THE CHANGED SECTION ---
  // 3. Logged in, but role does not match
  // Checks if requiredRole is an array (e.g., ["student", "faculty"]) 
  // or a single string (e.g., "student")
  const hasRequiredRole = Array.isArray(requiredRole)
    ? requiredRole.includes(role)
    : role === requiredRole;

  if (!hasRequiredRole) {
    // Role doesn't match, redirect to login
    console.warn(
      `Role mismatch: User has role [${role}], route requires [${requiredRole}]`
    );
    return <Navigate to="/" replace />;
  }
  // --- END OF CHANGE ---

  // 4. Logged in AND has correct role
  return children;
}