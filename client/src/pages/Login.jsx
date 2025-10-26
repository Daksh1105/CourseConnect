// src/pages/Login.jsx

// React, Firebase, and Router Imports
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase"; // Make sure this path is correct
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Asset import
import backgroundImage from '../assets/college_background.jpg'; // Adjust path if needed

export default function LoginPage() {
  const navigate = useNavigate();

  // State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Logic (from your working version)
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

  // Handle Signup
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

  // Handle Login
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
        setLoading(false);
        return;
      }
      if (data.role !== role) {
        setError(
          `Selected role (“${role}”) does not match account role (“${data.role}”).`
        );
        setLoading(false);
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

  // JSX
  // NOTE: If you removed the background image, you can remove the style prop
  // and className="bg-cover bg-center" from the main div.
  return (
    <div
      className="flex min-h-screen bg-cover bg-center relative"
      // If your background is just white, you can delete this "style" prop
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Logo in top left */}
      <div className="absolute top-8 left-8 z-10">
        <Logo />
      </div>

      {/* Centered Form */}
      <div className="w-full flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <TabButton
              title="Sign In"
              isActive={!isSignupMode}
              onClick={() => {
                setIsSignupMode(false);
                setError("");
              }}
            />
            <TabButton
              title="Sign Up"
              isActive={isSignupMode}
              onClick={() => {
                setIsSignupMode(true);
                setError("");
              }}
            />
          </div>

          {/* Form Header */}
          <div className="text-center mb-6">
            <h2 className="text-3xl text-gray-800">
              {isSignupMode ? "Create Account" : "Welcome Back!"}
            </h2>
            <p className="text-gray-500 mt-2">
              {isSignupMode
                ? "Get started with your collaborative journey."
                : "Please sign in to continue."}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={isSignupMode ? handleSignup : handleLogin}
            className="space-y-5"
          >
            {isSignupMode && (
              <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                <span className="text-gray-400">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="text-gray-400">
                <MailIcon />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="you@college.edu"
              />
            </div>

            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="text-gray-400">
                <LockIcon />
              </span>
              <div className="relative w-full"> 
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <span className="block text-sm text-gray-700 mb-2">I am a</span>
              <div className="flex gap-4">
                <RadioRole
                  id="student"
                  value="student"
                  checked={role === "student"}
                  onChange={() => setRole("student")}
                  label="Student"
                />
                <RadioRole
                  id="faculty"
                  value="faculty"
                  checked={role === "faculty"}
                  onChange={() => setRole("faculty")}
                  label="Faculty"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 text-center"
            >
              {loading
                ? "Please wait..."
                : isSignupMode
                ? "Sign Up"
                : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Only students and faculty of this college can sign up.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- HELPER COMPONENTS ---

// Logo Component
function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 0L32 8L16 16L0 8L16 0Z"
          className="text-gray-800" // <-- CHANGED from text-white
          fill="currentColor"
        />
        <path
          d="M16 17.6L0 9.6V24L16 32L32 24V9.6L16 17.6ZM16 29.3333L2.66667 22.6667V12.1333L16 19.8667L29.3333 12.1333V22.6667L16 29.3333Z"
          className="text-orange-500" // <-- CHANGED from text-orange-200
          fill="currentColor"
        />
      </svg>
      {/* --- CHANGED from text-white --- */}
      <span className="text-2xl text-gray-800 font-semibold">CourseConnect</span>
    </div>
  );
}

// Tab Button Component
function TabButton({ title, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 px-1 w-1/2 text-center ${
        isActive
          ? "border-b-2 border-orange-500 text-orange-600"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {title}
    </button>
  );
}

// Radio Button Component
function RadioRole({ id, value, checked, onChange, label }) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 p-3 pr-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:bg-orange-50 has-[:checked]:border-orange-400"
    >
      <input
        type="radio"
        id={id}
        name="role"
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-orange-600"
      />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

// --- SVG ICONS ---

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}