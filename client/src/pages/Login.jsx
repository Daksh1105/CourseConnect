// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // ✅ added name
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignupMode, setIsSignupMode] = useState(false); // toggle for showing name field only during signup

  // Redirect if already logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userRole = userDoc.exists() ? userDoc.data().role : null;
        if (userRole === "faculty") navigate("/faculty-dashboard");
        else if (userRole === "student") navigate("/student-dashboard");
      } catch (err) {
        console.error(err);
        setError("Error checking user role.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  // 🔹 Handle Signup
  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name: name.trim(),
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

  // 🔹 Handle Login
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      const data = userDoc.exists() ? userDoc.data() : null;
      if (!data) {
        setError("No user data found. Please sign up first.");
        return;
      }
      if (data.role !== role) {
        setError(
          `Selected role (“${role}”) does not match account role (“${data.role}”).`
        );
        return;
      }
      if (data.role === "faculty") navigate("/faculty-dashboard");
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
          {isSignupMode
            ? "Create your account below."
            : "Sign in to continue — choose your role below."}
        </p>

        <form
          onSubmit={isSignupMode ? handleSignup : handleLogin}
          className="space-y-4"
        >
          {isSignupMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm p-2"
                placeholder="John Doe"
              />
            </div>
          )}

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
              {loading
                ? "Please wait..."
                : isSignupMode
                ? "Sign Up"
                : "Login"}
            </button>

            <button
              type="button"
              onClick={() => setIsSignupMode(!isSignupMode)}
              disabled={loading}
              className="flex-1 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium hover:bg-slate-50"
            >
              {isSignupMode
                ? "Back to Login"
                : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
