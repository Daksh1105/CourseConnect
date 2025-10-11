import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Firebase v9 modular SDK
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

/*
  =====> SETUP NOTES <====
  - You’re using Firebase for authentication and Firestore for storing user roles.
  - When deploying on Vercel, keep your Firebase config in environment variables
    (e.g., REACT_APP_FIREBASE_API_KEY) and inject them at build time.
  - Replace the firebaseConfig values below with your env vars.
  - Firestore rules should allow reads to `users/{uid}` for authenticated users.

  Expected routes in your React app:
    - /student-dashboard
    - /faculty-dashboard

  This component:
    - Provides login + signup (email/password)
    - On signup, saves {email, role, createdAt} in `users` collection
    - On login, reads user's role and redirects accordingly
    - On mount, redirects authenticated users to their dashboards automatically
*/

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "REPLACE_ME",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "REPLACE_ME",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "REPLACE_ME",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "REPLACE_ME",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MSG_SENDER_ID || "REPLACE_ME",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student"); // default role
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userRole = userDoc.exists() ? userDoc.data().role : null;
        if (userRole === "faculty") navigate("/faculty-dashboard");
        else if (userRole === "student") navigate("/student-dashboard");
        else navigate("/choose-role"); // fallback
      } catch (err) {
        console.error(err);
        setError("Failed to fetch user role. Check console.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        role,
        createdAt: new Date().toISOString(),
      });
      if (role === "faculty") navigate("/faculty-dashboard");
      else navigate("/student-dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const userRole = userDoc.exists() ? userDoc.data().role : null;
      if (!userRole) {
        setError("No role found for this account. Please contact admin.");
        return;
      }
      if (userRole !== role) {
        setError(
          `Selected role ("${role}") does not match account role ("${userRole}").`
        );
        return;
      }
      if (userRole === "faculty") navigate("/faculty-dashboard");
      else navigate("/student-dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold mb-1">CourseConnect</h1>
        <p className="text-sm text-slate-500 mb-6">
          Sign in to continue — choose your role below.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm p-2"
              placeholder="you@college.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm p-2"
              placeholder="Enter password"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">
              I am a
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === "student"}
                  onChange={() => setRole("student")}
                  className="h-4 w-4"
                />
                <span>Student</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="faculty"
                  checked={role === "faculty"}
                  onChange={() => setRole("faculty")}
                  className="h-4 w-4"
                />
                <span>Faculty</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl border border-transparent bg-slate-800 text-white font-medium hover:opacity-95"
            >
              {loading ? "Please wait..." : "Login"}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex-1 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium hover:bg-slate-50"
            >
              {loading ? "Processing..." : "Sign up"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-xs text-slate-500">
          Tip: Use environment variables on Vercel instead of committing Firebase
          credentials.
        </div>
      </div>
    </div>
  );
}
