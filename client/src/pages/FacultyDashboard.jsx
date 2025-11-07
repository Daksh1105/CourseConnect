// src/pages/FacultyDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import firebaseApp, { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

/*
 Dashboard.jsx
 - Shows  name at top (fetched from users collection)
 - Profile section with name + email and "Edit name"
 - Create a class (classCode + title). On create, also add member doc under classes/{id}/members/{uid} with role 'faculty'
 - Lists only classes where faculty is a member (classes/{id}/members/{uid})
 - Clicking a class navigates to /class/:classId (ClassBoard)
 - Does NOT include post/answer/resource/analytics UI here (that belongs to ClassBoard)
*/

export default function FacultyDashboard() {
  const navigate = useNavigate();

  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);

  const [creating, setCreating] = useState(false);
  const [newClass, setNewClass] = useState({ code: "", title: "" });

  const [loading, setLoading] = useState(true);

  // Listen auth and load profile + classes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setAuthUser(u);
      await loadUserProfile(u.uid);
      await fetchMyClasses(u.uid);
      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Firestore user doc
  async function loadUserProfile(uid) {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile({ name: auth.currentUser?.displayName || "", email: auth.currentUser?.email || "", role: "faculty" });
      }
    } catch (e) {
      console.error("loadUserProfile:", e);
    }
  }

  // Fetch classes where classes/{id}/members/{uid} exists
  async function fetchMyClasses(uid) {
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
      setMyClasses(joined);
      if (joined.length > 0 && !activeClassId) setActiveClassId(joined[0].id);
    } catch (e) {
      console.error("fetchMyClasses:", e);
      setMyClasses([]);
    }
  }

// Create a new class (faculty only)
async function handleCreateClass(e) {
  e?.preventDefault?.();
  if (!authUser) {
    alert("Not signed in");
    return;
  }
  const code = (newClass.code || "").trim();
  const title = (newClass.title || "").trim();
  if (!code) return alert("Class code is required (e.g. UCS501).");
  if (!title) return alert("Class title is required.");
  setCreating(true);

  try {
    const classesRef = collection(db, "classes");

    // ✅ Create class with faculty UID in memberIds array
    const docRef = await addDoc(classesRef, {
      classCode: code,
      name: title,
      createdBy: authUser.email,
      createdAt: serverTimestamp(),
      facultyId: authUser.uid,       // optional metadata
      memberIds: [authUser.uid],     // ✅ critical new field
    });

    // ✅ Add faculty membership in the members subcollection
    const memberRef = doc(db, "classes", docRef.id, "members", authUser.uid);
    await setDoc(memberRef, {
      uid: authUser.uid,
      email: authUser.email,
      role: "faculty",
      joinedAt: serverTimestamp(),
    });

    // Refresh list and UI
    await fetchMyClasses(authUser.uid);
    setNewClass({ code: "", title: "" });
    setActiveClassId(docRef.id);
    alert("Class created successfully.");
  } catch (e) {
    console.error("create class error:", e);
    alert("Failed to create class. See console.");
  } finally {
    setCreating(false);
  }
}


  // Edit name
  async function handleEditName() {
    if (!authUser) return;
    const next = prompt("Enter full name:", profile?.name || "");
    if (next === null) return;
    const trimmed = (next || "").trim();
    if (!trimmed) return alert("Name cannot be empty.");
    try {
      const userRef = doc(db, "users", authUser.uid);
      // If doc exists update, otherwise create
      await updateDoc(userRef, { name: trimmed }).catch(async () => {
        // if update fails (doc missing) then setDoc to create
        await setDoc(userRef, { uid: authUser.uid, name: trimmed, email: authUser.email, role: "faculty", createdAt: serverTimestamp() });
      });
      setProfile(prev => ({ ...(prev || {}), name: trimmed }));
      alert("Name updated.");
    } catch (e) {
      console.error("update name error:", e);
      alert("Failed to update name.");
    }
  }

  // Navigate to class board
  function openClass(classId) {
    navigate(`/class/${classId}`);
  }

  // Logout
  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>{profile?.name || authUser?.email}</h1>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{profile?.role || "faculty"}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleLogout} style={{ padding: "8px 12px", borderRadius: 8 }}>Logout</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Left: Profile + Create Class + My Classes */}
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

          {/* Create Class */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Create Class</h3>
            <form onSubmit={handleCreateClass} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={newClass.code}
                onChange={(e) => setNewClass({ ...newClass, code: e.target.value })}
                placeholder="Class Code (e.g. UCS501)"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <input
                value={newClass.title}
                onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                placeholder="Class Title (e.g. Software Engineering)"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <button type="submit" disabled={creating} style={{ padding: "8px 10px", borderRadius: 6, background: "#0ea5a4", color: "#fff", border: "none" }}>
                {creating ? "Creating..." : "Create Class"}
              </button>
            </form>
          </div>

          {/* My Classes */}
          <div>
            <h3 style={{ margin: "0 0 8px 0" }}>My Classes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myClasses.length === 0 && <div style={{ color: "#6b7280" }}>You are not a member of any classes yet.</div>}
              {myClasses.map((c) => (
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

        {/* Main content: instructions, nothing else (ClassBoard contains interactions) */}
        <main style={{ background: "#fff", padding: 20, borderRadius: 8, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}>
          <h2 style={{ marginTop: 0 }}>Faculty Dashboard</h2>
          <p style={{ color: "#6b7280" }}>
            Create a class using a unique class code and a title. Click a class from the left to open its ClassBoard where you can manage questions, resources, answers and view analytics.
          </p>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Quick demo tips</h3>
            <ul style={{ color: "#374151" }}>
              <li>Enter a class code (e.g. UCS501) and a title, then click <em>Create Class</em>.</li>
              <li>After creating, click the class on the left to open the ClassBoard where you can upload resources and manage questions for that class.</li>
              <li>Edit your profile name if you want a different display name on posts and the leaderboard.</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
