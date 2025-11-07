// src/pages/StudentDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,      // ✅ needed for adding memberIds
  arrayUnion,     // ✅ needed for adding to array field
  where,
  serverTimestamp,
  limit, // For announcements
} from "firebase/firestore";

/*
  Student Dashboard (v3 - Hybrid Layout)
  - Sidebar: Collapsible "mini" bar that expands on click.
  - Header: Contains sidebar toggle, "Join" button, and profile.
  - Main Area: Welcome message, Announcements, and Class Card grid.
  - Modal: "Join Class" modal.
*/

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  
  // UI State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Listen for auth and load all user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
        return;
      }
      setAuthUser(user);
      loadAllData(user.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chained data loading function
  async function loadAllData(uid) {
    setLoading(true);
    try {
      await loadUserProfile(uid);
      const classes = await fetchJoinedClasses(uid);
      await fetchAnnouncements(classes);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Load Firestore user doc
  async function loadUserProfile(uid) {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setProfile(snap.data());
    } else {
      setProfile({ name: auth.currentUser?.displayName || "Student", email: auth.currentUser?.email, role: "student" });
    }
  }

  // Fetch classes where classes/{id}/members/{uid} exists
  async function fetchJoinedClasses(uid) {
    try {
      const q = query(
        collection(db, "classes"),
        where("memberIds", "array-contains", uid),
        orderBy("createdAt", "desc")
      );
      const classesSnap = await getDocs(q);
      const joined = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setJoinedClasses(joined);
      return joined;
    } catch (e) {
      console.error("fetchJoinedClasses:", e);
      setJoinedClasses([]);
      return [];
    }
  }
  
  
  // Fetch 5 most recent announcements from all joined classes
  async function fetchAnnouncements(classes) {
    if (classes.length === 0) {
      setAnnouncements([]);
      setAnnouncementsLoading(false);
      return;
    }
    setAnnouncementsLoading(true);
    try {
      const promises = classes.map(cls => {
        const annQuery = query(
          collection(db, "classes", cls.id, "announcements"),
          orderBy("postedAt", "desc"),
          limit(3)
        );
        return getDocs(annQuery).then(snap => 
          snap.docs.map(d => ({ ...d.data(), id: d.id, className: cls.name, classId: cls.id }))
        );
      });
      const results = await Promise.all(promises);
      const allAnnouncements = results.flat();
      allAnnouncements.sort((a, b) => b.postedAt.toDate() - a.postedAt.toDate());
      setAnnouncements(allAnnouncements.slice(0, 5)); // Get top 5 recent
    } catch (e) {
      console.error("fetchAnnouncements:", e);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  // Navigate to class board
  function openClass(classId) {
    navigate(`/class/${classId}`);
  }

  async function handleJoinByCode(joinCode) {
    if (!joinCode.trim()) throw new Error("Enter a class code.");
    if (!authUser) throw new Error("Not authenticated.");
  
    const q = query(
      collection(db, "classes"),
      where("classCode", "==", joinCode.trim())
    );
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("No class found with that code.");
  
    const classDoc = snap.docs[0];
    const classId = classDoc.id;
  
    // ✅ 1. Create the member document (same as before)
    const memberRef = doc(db, "classes", classId, "members", authUser.uid);
    await setDoc(memberRef, {
      uid: authUser.uid,
      email: authUser.email,
      role: "student",
      joinedAt: serverTimestamp(),
      name: profile?.name || "Student",
    });
  
    // ✅ 2. Add this student's UID to class.memberIds array
    await updateDoc(doc(db, "classes", classId), {
      memberIds: arrayUnion(authUser.uid),
    });
  
    // ✅ 3. Refresh dashboard data
    await loadAllData(authUser.uid);
  }
  

  // Logout
  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading Dashboard...</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50"> {/* <-- THIS IS THE CHANGE */}
      <Sidebar
        isExpanded={isSidebarExpanded}
        joinedClasses={joinedClasses}
        onOpenClass={openClass}
      />
      
      <JoinClassModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoinByCode}
      />

      {/* --- MAIN CONTENT (Header + Dashboard) --- */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <Header
          profile={profile}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          onOpenJoinModal={() => setIsJoinModalOpen(true)}
        />
        
        {/* --- DASHBOARD: Welcome, Announcements, Grid --- */}
        <main className="flex-1 p-6 lg:p-8"> {/* <-- Removed background color here */}
          <DashboardContent
            profileName={profile?.name}
            joinedClasses={joinedClasses}
            onOpenClass={openClass}
            announcements={announcements}
            loadingAnnouncements={announcementsLoading}
          />
        </main>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function Header({ profile, onLogout, onToggleSidebar, onOpenJoinModal }) {
  const profileInitial = profile?.name ? profile.name[0].toUpperCase() : "?";

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <MenuIcon />
        </button>
        <span className="text-xl font-medium text-gray-700">CourseConnect</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenJoinModal}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <PlusIcon />
        </button>
        <div className="relative">
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-semibold text-white">
            {profileInitial}
          </button>
        </div>
        <button 
          onClick={onLogout} 
          className="ml-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function Sidebar({ isExpanded, joinedClasses, onOpenClass }) {
  return (
    <aside 
      className={`fixed top-0 left-0 z-40 h-screen flex-col bg-white p-4 shadow-lg transition-all duration-300 ${
        isExpanded ? 'w-72' : 'w-20'
      }`}
    >
      <div className="flex h-12 items-center justify-center">
        {/* Show full logo or just icon */}
        <Logo isExpanded={isExpanded} />
      </div>
      
      <nav className="mt-8 space-y-2">
        <SidebarLink
          to="/profile"
          icon={<ProfileIcon />}
          text="My Profile"
          isExpanded={isExpanded}
        />
        {/* Add other links here (e.g., Calendar) */}
      </nav>
      
      {/* "My Classes" list, only shows when expanded */}
      <div className={`mt-8 flex-1 border-t pt-6 overflow-y-auto ${!isExpanded && 'hidden'}`}>
        <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">My Classes</h3>
        <div className="space-y-2">
          {joinedClasses.length === 0 && (
            <p className="text-sm text-gray-500">No classes joined.</p>
          )}
          {joinedClasses.map((c) => (
            <div 
              key={c.id} 
              onClick={() => onOpenClass(c.id)}
              className="cursor-pointer rounded-md p-3 hover:bg-gray-50"
            >
              <div className="font-semibold text-gray-800 truncate">{c.name || "Untitled Class"}</div>
              <div className="text-sm text-gray-500">{c.classCode}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// Helper component for links in the sidebar
function SidebarLink({ to, icon, text, isExpanded }) {
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-4 rounded-md p-3 text-gray-700 hover:bg-gray-100 ${
        !isExpanded && 'justify-center'
      }`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <span className={`flex-1 truncate ${!isExpanded && 'hidden'}`}>{text}</span>
    </Link>
  );
}

function DashboardContent({ profileName, joinedClasses, onOpenClass, announcements, loadingAnnouncements }) {
  return (
    <div className="space-y-8">
      {/* --- 1. Welcome Message --- */}
      <h1 className="text-3xl font-bold text-gray-900">
        Welcome back, {profileName || "Student"}!
      </h1>
      
      {/* --- 2. Announcements --- */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Recent Announcements</h2>
        <div className="mt-4 flow-root">
          {loadingAnnouncements && <p className="text-gray-500">Loading announcements...</p>}
          {!loadingAnnouncements && announcements.length === 0 && (
            <p className="text-sm text-gray-500">No new announcements from your classes.</p>
          )}
          {!loadingAnnouncements && announcements.length > 0 && (
            <ul className="space-y-4">
              {announcements.map((ann) => (
                <li key={ann.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                      {ann.className || "Class"}
                    </span>
                    <span className="text-sm text-gray-500">
                      {ann.postedAt?.toDate().toLocaleDateString() || "..."}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{ann.title || "No Title"}</h3>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{ann.content || "No content."}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* --- 3. Class Grid --- */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">My Classes</h2>
        {joinedClasses.length === 0 ? (
          <div className="mt-4 text-center text-gray-600">
            <p>You haven't joined any classes yet.</p>
            <p>Click the "+" button in the header to get started.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {joinedClasses.map((c) => (
              <ClassCard key={c.id} classData={c} onOpenClass={onOpenClass} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassCard({ classData, onOpenClass }) {
  const colors = [
    'bg-blue-600', 'bg-green-600', 'bg-purple-600', 
    'bg-red-600', 'bg-indigo-600', 'bg-pink-600'
  ];
  const color = colors[(classData.name.length || 0) % colors.length];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-all hover:shadow-lg">
      <div 
        onClick={() => onOpenClass(classData.id)}
        className={`relative h-32 w-full p-4 text-white cursor-pointer ${color}`}
      >
        <h3 className="text-2xl font-semibold truncate">{classData.name || "Untitled"}</h3>
        <p className="text-sm text-blue-50">{classData.classCode}</p>
        {/* You can add faculty avatar here if available */}
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm text-gray-600">
          Faculty: {classData.facultyname || "N/A"}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t p-3">
        <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><FolderIcon /></button>
        <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><OptionsIcon /></button>
      </div>
    </div>
  );
}

function JoinClassModal({ isOpen, onClose, onJoin }) {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setJoining(true);
    try {
      await onJoin(joinCode);
      onClose();
      setJoinCode("");
    } catch (err) {
      setError(err.message || "Failed to join class.");
    } finally {
      setJoining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold text-gray-900">Join Class</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter the class code provided by your faculty.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            type="text"
            placeholder="Class code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-orange-500 focus:ring-orange-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joining}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- SVG Icons ---

// This is your logo from the login page, adapted for the sidebar
function Logo({ isExpanded }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <path
          d="M16 0L32 8L16 16L0 8L16 0Z"
          className="text-gray-800"
          fill="currentColor"
        />
        <path
          d="M16 17.6L0 9.6V24L16 32L32 24V9.6L16 17.6ZM16 29.3333L2.66667 22.6667V12.1333L16 19.8667L29.3333 12.1333V22.6667L16 29.3333Z"
          className="text-orange-500"
          fill="currentColor"
        />
      </svg>
      <span className={`text-2xl font-semibold text-gray-800 ${!isExpanded && 'hidden'}`}>
        CourseConnect
      </span>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  );
}


function ProfileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}