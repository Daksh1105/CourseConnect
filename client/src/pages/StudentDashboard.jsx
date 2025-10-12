// src/pages/StudentDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import firebaseApp, { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  where,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

/*
 Student Dashboard
 - Shows student's name on top (fetched from users collection)
 - Profile section: shows name/email and allows editing name
 - Join class by class code (e.g. UCS501)
 - Lists only classes the student has joined (classes/{id}/members/{uid})
 - Clicking a class navigates to /class/:classId

 Assumptions:
 - users collection exists with doc id = uid and fields { name, email, role }
 - classes collection has docs with { name, classCode, createdAt }
 - membership is stored at classes/{classId}/members/{uid}
*/

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null); // Firestore user data (name, role, email)
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Listen for auth and load profile + joined classes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setAuthUser(u);
      await loadUserProfile(u.uid);
      await fetchJoinedClasses(u.uid);
      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Firestore user doc
  async function loadUserProfile(uid) {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        // fallback: set basic profile using auth info
        setProfile({ name: auth.currentUser?.displayName || "", email: auth.currentUser?.email || "", role: "student" });
      }
    } catch (e) {
      console.error("loadUserProfile:", e);
    }
  }

  // Fetch classes where classes/{id}/members/{uid} exists
  async function fetchJoinedClasses(uid) {
    try {
      const classesSnap = await getDocs(query(collection(db, "classes"), orderBy("createdAt", "desc")));
      const joined = [];
      for (const c of classesSnap.docs) {
        const memberRef = doc(db, "classes", c.id, "members", uid);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          joined.push({ id: c.id, ...c.data() });
        }
      }
      setJoinedClasses(joined);
      if (joined.length > 0 && !activeClassId) setActiveClassId(joined[0].id);
    } catch (e) {
      console.error("fetchJoinedClasses:", e);
      setJoinedClasses([]);
    }
  }

  // Navigate to class board
  function openClass(classId) {
    navigate(`/class/${classId}`);
  }

  // Join class by code (students enter classCode provided by faculty)
  async function handleJoinByCode(e) {
    e?.preventDefault?.();
    setError("");
    if (!joinCode.trim()) {
      setError("Enter a class code.");
      return;
    }
    if (!authUser) {
      setError("Not authenticated.");
      return;
    }
    setJoining(true);
    try {
      // find class by classCode (case-insensitive common approach)
      const q = query(collection(db, "classes"), where("classCode", "==", joinCode.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("No class found with that code.");
        setJoining(false);
        return;
      }
      const classDoc = snap.docs[0];
      const classId = classDoc.id;

      // Write membership doc
      const memberRef = doc(db, "classes", classId, "members", authUser.uid);
      await setDoc(memberRef, {
        uid: authUser.uid,
        email: authUser.email,
        role: "student",
        joinedAt: serverTimestamp(),
      });

      // Refresh joined classes and clear code
      await fetchJoinedClasses(authUser.uid);
      setJoinCode("");
      setError("");
      // select the class
      setActiveClassId(classId);
      alert(`Joined class: ${classDoc.data().name || classId}`);
    } catch (e) {
      console.error("handleJoinByCode:", e);
      setError("Failed to join class. See console.");
    } finally {
      setJoining(false);
    }
  }

  // Edit profile name (simple prompt)
  async function handleEditName() {
    if (!authUser) return;
    const newName = prompt("Enter your full name:", profile?.name || "");
    if (newName === null) return; // cancelled
    const trimmed = (newName || "").trim();
    if (!trimmed) return alert("Name cannot be empty.");
    try {
      const userRef = doc(db, "users", authUser.uid);
      await updateDoc(userRef, { name: trimmed });
      // update local state
      setProfile(prev => ({ ...(prev || {}), name: trimmed }));
      alert("Name updated.");
    } catch (e) {
      console.error("update name:", e);
      alert("Failed to update name.");
    }
  }

  // Logout
  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>{profile?.name || authUser?.email}</h1>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{profile?.role ? `${profile.role}` : ""}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleLogout} style={{ padding: "8px 12px", borderRadius: 8 }}>Logout</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Left: Sidebar (Profile & Join by Code & My Classes) */}
        <aside style={{ background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}>
          {/* Profile */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Profile</h3>
            <div style={{ color: "#111827" }}>
              <div style={{ fontWeight: 700 }}>{profile?.name || "-"}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{authUser?.email}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={handleEditName} style={{ padding: "6px 10px", borderRadius: 6 }}>Edit name</button>
            </div>
          </div>

          {/* Join by class code */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Join Class</h3>
            <form onSubmit={handleJoinByCode} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Enter class code (e.g. UCS501)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <button type="submit" disabled={joining} style={{ padding: "8px 10px", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none" }}>
                {joining ? "Joining..." : "Join"}
              </button>
            </form>
            {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
          </div>

          {/* My Classes */}
          <div>
            <h3 style={{ margin: "0 0 8px 0" }}>My Classes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {joinedClasses.length === 0 && <div style={{ color: "#6b7280" }}>You haven't joined any classes yet.</div>}
              {joinedClasses.map((c) => (
                <div key={c.id} onClick={() => openClass(c.id)} style={{
                  padding: 10,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: activeClassId === c.id ? "#eef2ff" : "transparent",
                  border: activeClassId === c.id ? "1px solid #c7d2fe" : "1px solid #f3f4f6"
                }}>
                  <div style={{ fontWeight: 700 }}>{c.name || "Untitled Class"}</div>
                  {c.classCode && <div style={{ fontSize: 12, color: "#6b7280" }}>{c.classCode}</div>}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content: simple welcome and instructions (actual class interactions are in ClassBoard) */}
        <main style={{ background: "#fff", padding: 20, borderRadius: 8, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}>
          <h2 style={{ marginTop: 0 }}>Welcome, {profile?.name || "Student"}!</h2>
          <p style={{ color: "#6b7280" }}>
            This page shows the classes you have joined. Click a class to open its ClassBoard where you can post questions, answer, and access resources for that class.
          </p>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Quick tips for demo</h3>
            <ul style={{ color: "#374151" }}>
              <li>Ask your faculty for the class code (e.g. UCS501) and enter it above to join.</li>
              <li>All class interactions (questions, answers, resources) happen inside the ClassBoard for the selected class.</li>
              <li>Edit your name in the Profile section — this name will show on your dashboard, class posts, and leaderboard.</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
