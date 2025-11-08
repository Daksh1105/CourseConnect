// src/pages/StudentProfilePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser
} from "firebase/auth";
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
  arrayUnion, // <-- 1. FIXED IMPORT
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

/*
  Student Profile Page
  - Re-uses the main dashboard layout (Sidebar, Header)
  - Fetches and displays user profile data from Firestore
  - Allows user to update name, profile picture, and manage account
*/

export default function StudentProfilePage() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinedClasses, setJoinedClasses] = useState([]); // <-- 2. ADDED STATE

  // UI State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Profile Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  // --- 1. CORE DATA LOADING ---

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/");
        return;
      }
      setAuthUser(user);
      loadUserProfile(user.uid);
      fetchJoinedClasses(user.uid); // <-- 4. FIXED useEffect
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Firestore user doc
  async function loadUserProfile(uid) {
    setLoading(true);
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setNewName(data.name);
      } else {
        setProfile({
          name: auth.currentUser?.displayName || "Student",
          email: auth.currentUser?.email,
          role: "student"
        });
      }
    } catch (err) {
      console.error("loadUserProfile error:", err);
      setError("Failed to load profile data.");
      setProfile({
        name: auth.currentUser?.displayName || "Student",
        email: auth.currentUser?.email,
        role: "student"
      });
    } finally {
      setLoading(false);
    }
  }

  // --- 3. ADDED THIS ENTIRE FUNCTION ---
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
    } catch (e) {
      console.error("fetchJoinedClasses:", e);
      setJoinedClasses([]);
    }
  }

  // --- 2. LAYOUT-SPECIFIC FUNCTIONS (Copied from Dashboard) ---

  async function handleLogout() {
    await signOut(auth);
    navigate("/");
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
  
    const memberRef = doc(db, "classes", classId, "members", authUser.uid);
    await setDoc(memberRef, {
      uid: authUser.uid,
      email: authUser.email,
      role: "student",
      joinedAt: serverTimestamp(),
      name: profile?.name || "Student",
    });
  
    await updateDoc(doc(db, "classes", classId), {
      memberIds: arrayUnion(authUser.uid),
    });
  
    await fetchJoinedClasses(authUser.uid); // <-- 4. FIXED FUNCTION CALL
  }

  // --- 3. PROFILE-SPECIFIC FUNCTIONS ---

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!authUser) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const storageRef = ref(storage, `profile_pictures/${authUser.uid}`);

    try {
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateProfile(auth.currentUser, { photoURL: downloadURL });

      const userDocRef = doc(db, "users", authUser.uid);
      await updateDoc(userDocRef, { photoURL: downloadURL });

      setProfile(prev => ({ ...prev, photoURL: downloadURL }));
      setSuccess("Profile picture updated!");

    } catch (err) {
      console.error(err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleNameUpdate = async (e) => {
    e.preventDefault();
    if (!profile || newName.trim() === profile.name) {
      setIsEditingName(false);
      return;
    }

    setError("");
    setSuccess("");

    try {
      const userDocRef = doc(db, "users", authUser.uid);
      await updateDoc(userDocRef, { name: newName.trim() });
      await updateProfile(auth.currentUser, { displayName: newName.trim() });

      setProfile(prev => ({ ...prev, name: newName.trim() }));
      setSuccess("Name updated successfully!");
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update name.");
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setSuccess("");
    if (!profile.email) {
      setError("No email on file.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setSuccess(`Password reset email sent to ${profile.email}.`);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    setError("");
    setSuccess("");

    const confirm = window.prompt("This is irreversible. Type 'DELETE' to confirm.");
    if (confirm !== "DELETE") {
      return;
    }

    try {
      await deleteUser(auth.currentUser);
      alert("Account deleted successfully.");
      navigate("/");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") {
        setError("This is a sensitive action. Please log out and log back in to confirm.");
      } else {
        setError(err.message);
      }
    }
  };


  // --- 4. RENDER ---

  if (loading || !profile) { 
    return <div className="flex min-h-screen items-center justify-center">Loading Profile...</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* --- 5. FIXED SIDEBAR --- */}
      <Sidebar
        isExpanded={isSidebarExpanded}
        joinedClasses={joinedClasses}
        onOpenClass={(classId) => navigate(`/class/${classId}`)}
      />

      <JoinClassModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoinByCode}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarExpanded ? 'ml-72' : 'ml-20'}`}>
        <Header
          profile={profile}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          onOpenJoinModal={() => setIsJoinModalOpen(true)}
        />

        <main className="flex-1 p-6 lg:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            My Profile
          </h1>

          <div className="max-w-4xl mx-auto space-y-8">

            {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
            {success && <div className="rounded-md bg-green-50 p-4 text-green-700">{success}</div>}

            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="p-6 space-y-6">

                <div className="flex items-center gap-5">
                  <div className="relative">
                    {uploading ? (
                      <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                        <SpinnerIcon />
                      </div>
                    ) : (
                      <img
                        src={profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`}
                        alt="Profile"
                        className="h-24 w-24 rounded-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <button
                      onClick={handlePhotoClick}
                      disabled={uploading}
                      className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Change Photo"}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/png, image/jpeg"
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-2">PNG or JPG, max 2MB.</p>
                  </div>
                </div>

                <hr />

                <form onSubmit={handleNameUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    {isEditingName ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingName(false);
                            setNewName(profile.name);
                          }}
                          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-lg text-gray-900">{profile.name}</p>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          className="text-sm font-medium text-orange-600 hover:text-orange-500"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-lg text-gray-500 mt-1">{profile.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="text-lg text-gray-500 mt-1 capitalize">{profile.role}</p>
                  </div>
                </form>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">Account Actions</h3>
                <div className="mt-4 space-y-4">
                  <button
                    onClick={handlePasswordReset}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Send Password Reset Email
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-red-500 bg-red-50 p-6">
              <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
              <p className="mt-1 text-sm text-red-700">
                This action is permanent and cannot be undone.
              </p>
              <div className="mt-4">
                <button
                  onClick={handleDeleteAccount}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Delete My Account
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// ---
// --- ALL HELPER COMPONENTS (Copied from StudentDashboard)
// ---

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
            <img
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || profileInitial)}&background=random`}
              alt="Avatar"
              className="h-8 w-8 rounded-full object-cover"
            />
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
        <Logo isExpanded={isExpanded} />
      </div>

      <nav className="mt-8 space-y-2">
        <SidebarLink
          to="/profile"
          icon={<ProfileIcon />}
          text="My Profile"
          isExpanded={isExpanded}
        />
        <SidebarLink
          to="/student-dashboard"
          icon={<HomeIcon />}
          text="Dashboard"
          isExpanded={isExpanded}
        />
      </nav>

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

// ---
// --- ALL SVG ICONS (Copied from StudentDashboard)
// ---

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

function ProfileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}