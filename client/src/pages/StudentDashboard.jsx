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
  updateDoc,
  arrayUnion,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";

// --- NEW: Added lucide icons for new cards ---
import {
  MenuIcon as MenuIconSvg,
  PlusIcon as PlusIconSvg,
  FolderIcon as FolderIconSvg,
  LogOut,
  Bell,
  Home,
  User,
  Calendar,
  Activity,
  MessageSquare
} from "lucide-react";


export default function StudentDashboard() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // --- NEW: State for new cards ---
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  
  // --- NEW: Loading states for new cards ---
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  
  // UI State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isAnnouncementsExpanded, setIsAnnouncementsExpanded] = useState(false);

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

  // --- MODIFIED: Chained data loading function ---
  async function loadAllData(uid) {
    setLoading(true);
    try {
      await loadUserProfile(uid);
      const classes = await fetchJoinedClasses(uid);
      // Fetch all data in parallel
      await Promise.all([
        fetchAnnouncements(classes),
        fetchUpcomingTasks(classes),
        fetchRecentActivity(classes)
      ]);
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
      setAnnouncements(allAnnouncements.slice(0, 5));
    } catch (e) {
      console.error("fetchAnnouncements:", e);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  }
  
  // --- NEW: Fetch Upcoming Tasks ---
  async function fetchUpcomingTasks(classes) {
    if (classes.length === 0) {
      setUpcomingTasks([]);
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    try {
      const today = new Date();
      const promises = classes.map(cls => {
        const tasksQuery = query(
          collection(db, "classes", cls.id, "tasks"), // <-- ASSUMES 'tasks' collection
          where("dueDate", ">=", today), // <-- Only future tasks
          orderBy("dueDate", "asc"),
          limit(3)
        );
        return getDocs(tasksQuery).then(snap => 
          snap.docs.map(d => ({ ...d.data(), id: d.id, className: cls.name }))
        );
      });
      const results = await Promise.all(promises);
      const allTasks = results.flat();
      allTasks.sort((a, b) => a.dueDate.toDate() - b.dueDate.toDate());
      setUpcomingTasks(allTasks.slice(0, 3)); // Get top 3 overall
    } catch (e) {
      console.error("fetchUpcomingTasks:", e);
      setUpcomingTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }
  
  // --- NEW: Fetch Recent Activity (from Q&A) ---
  async function fetchRecentActivity(classes) {
    if (classes.length === 0) {
      setRecentActivity([]);
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    try {
      const promises = classes.map(cls => {
        const activityQuery = query(
          collection(db, "classes", cls.id, "questions"), // <-- ASSUMES 'questions' collection
          orderBy("postedAt", "desc"),
          limit(3)
        );
        return getDocs(activityQuery).then(snap => 
          snap.docs.map(d => ({ ...d.data(), id: d.id, className: cls.name }))
        );
      });
      const results = await Promise.all(promises);
      const allActivity = results.flat();
      allActivity.sort((a, b) => b.postedAt.toDate() - a.postedAt.toDate());
      setRecentActivity(allActivity.slice(0, 3)); // Get top 3 overall
    } catch (e) {
      console.error("fetchRecentActivity:", e);
      setRecentActivity([]);
    } finally {
      setActivityLoading(false);
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
  
    // Refresh all dashboard data
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
    <div className="min-h-screen bg-slate-100">
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

      <RightAnnouncementsBar
        isExpanded={isAnnouncementsExpanded} 
        announcements={announcements}
        loading={announcementsLoading}
      />
      
      <Header
        profile={profile}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        onToggleAnnouncements={() => setIsAnnouncementsExpanded(!isAnnouncementsExpanded)}
        isSidebarExpanded={isSidebarExpanded}
        isAnnouncementsExpanded={isAnnouncementsExpanded}
      />
        
      <main 
        className={`p-6 lg:p-8 transition-all duration-300 mt-16 ${isSidebarExpanded ? 'ml-72' : 'ml-20'} ${isAnnouncementsExpanded ? 'mr-96' : 'mr-0'}`}
      >
        <DashboardContent
          profileName={profile?.name}
          joinedClasses={joinedClasses}
          onOpenClass={openClass}
          upcomingTasks={upcomingTasks}
          tasksLoading={tasksLoading}
          recentActivity={recentActivity}
          activityLoading={activityLoading}
        />
      </main>
    </div>
  );
}

// --- Sub-Components ---

function Header({ profile, onLogout, onToggleSidebar, onOpenJoinModal, onToggleAnnouncements, isSidebarExpanded, isAnnouncementsExpanded }) {
  const profileInitial = profile?.name ? profile.name[0].toUpperCase() : "?";

  return (
    <header 
      className={`fixed top-0 z-20 h-16 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6 transition-all duration-300 ${isSidebarExpanded ? 'left-72' : 'left-20'} ${isAnnouncementsExpanded ? 'right-96' : 'right-0'}`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <MenuIconSvg className="h-6 w-6" />
        </button>
        <span className="text-xl font-medium text-gray-700">CourseConnect</span>
      </div>
      <div className="flex items-center gap-3">
        
        <button
          onClick={onToggleAnnouncements}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <Bell className="h-6 w-6" />
        </button>

        <button
          onClick={onOpenJoinModal}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <PlusIconSvg className="h-6 w-6" />
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
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function Sidebar({ isExpanded, joinedClasses, onOpenClass }) {
  return (
    <aside 
      className={`fixed top-0 left-0 z-40 h-screen flex flex-col bg-gray-900 p-4 shadow-lg transition-all duration-300 ${
        isExpanded ? 'w-72' : 'w-20'
      }`}
    >
      <div className="flex h-12 items-center justify-center">
        <Logo isExpanded={isExpanded} />
      </div>
      
      <nav className="mt-8 space-y-2">
        <SidebarLink
          to="/student-dashboard"
          icon={<Home className="h-6 w-6" />}
          text="Dashboard"
          isExpanded={isExpanded}
        />
        <SidebarLink
          to="/profile"
          icon={<User className="h-6 w-6" />}
          text="My Profile"
          isExpanded={isExpanded}
        />
      </nav>
      
      <div className={`mt-8 flex-1 border-t border-gray-700 pt-6 overflow-y-auto ${!isExpanded && 'hidden'}`}>
        <h3 className="mb-3 text-xs font-semibold uppercase text-gray-400">My Classes</h3>
        <div className="space-y-2">
          {joinedClasses.length === 0 && (
            <p className="text-sm text-gray-400">No classes joined.</p>
          )}
          {joinedClasses.map((c) => (
            <div 
              key={c.id} 
              onClick={() => onOpenClass(c.id)}
              className="cursor-pointer rounded-md p-3 hover:bg-gray-800"
            >
              <div className="font-semibold text-white truncate">{c.name || "Untitled Class"}</div>
              <div className="text-sm text-gray-400">{c.classCode}</div>
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
      className={`flex items-center gap-4 rounded-md p-3 text-gray-300 hover:bg-gray-700 hover:text-white ${
        !isExpanded && 'justify-center'
      }`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <span className={`flex-1 truncate ${!isExpanded && 'hidden'}`}>{text}</span>
    </Link>
  );
}

function DashboardContent({ profileName, joinedClasses, onOpenClass, upcomingTasks, tasksLoading, recentActivity, activityLoading }) {
  
  // Helper function to format dates
  const formatDueDate = (date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      
      <div className="bg-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 text-center">
          Welcome back, {profileName || "Student"}!
        </h1>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">My Classes</h2>
        {joinedClasses.length === 0 ? (
          <div className="mt-4 text-center text-gray-600">
            <p>You haven't joined any classes yet.</p>
            <p>Click the "+" button in the header to get started.</p>
          </div>
        ) : (
          <div className="flex space-x-6 overflow-x-auto py-4">
            {joinedClasses.map((c) => (
              <div key={c.id} className="w-80 flex-shrink-0">
                <ClassCard classData={c} onOpenClass={onOpenClass} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h3>
          </div>
          <div className="p-4 space-y-4">
            {tasksLoading ? (
              <p className="text-sm text-gray-500">Loading tasks...</p>
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.map(task => (
                <div key={task.id} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-gray-800">{task.title}</p>
                    <p className="text-sm text-gray-500">
                      {task.className} • Due {formatDueDate(task.dueDate.toDate())}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No upcoming deadlines. You're all caught up!</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <Activity className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-4 space-y-4">
            {activityLoading ? (
              <p className="text-sm text-gray-500">Loading activity...</p>
            ) : recentActivity.length > 0 ? (
              recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <MessageSquare className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{activity.authorName || 'Someone'}</span> asked a question in <span className="font-medium">{activity.className}</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent activity in your classes.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function RightAnnouncementsBar({ isExpanded, announcements, loadingAnnouncements }) {
  return (
    <aside 
      className={`fixed top-0 z-30 h-screen w-96 flex-col border-l border-gray-700 bg-gray-900 p-6 shadow-lg transition-all duration-300 ${
        isExpanded ? 'right-0' : '-right-96' 
      }`}
    >
      <div className="flex h-16 items-center border-b border-gray-700 pb-6">
        <h2 className="text-2xl font-semibold text-white">Recent Announcements</h2>
      </div>
      <div className="mt-6 flow-root overflow-y-auto h-[calc(100vh-100px)]">
        {loadingAnnouncements && <p className="text-gray-400">Loading announcements...</p>}
        {!loadingAnnouncements && announcements.length === 0 && (
          <p className="text-sm text-gray-400">No new announcements from your classes.</p>
        )}
        {!loadingAnnouncements && announcements.length > 0 && (
          <ul className="space-y-4">
            {announcements.map((ann) => (
              <li key={ann.id} className="rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                    {ann.className || "Class"}
                  </span>
                  <span className="text-sm text-gray-400">
                    {ann.postedAt?.toDate().toLocaleDateString() || "..."}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{ann.title || "No Title"}</h3>
                <p className="mt-1 text-sm text-gray-300 line-clamp-2">{ann.content || "No content."}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
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
        <p className="text-sm opacity-90">{classData.classCode}</p>
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm text-gray-600">
          {/* --- ✅ FIX: Changed to lowercase 'facultyname' --- */}
          Faculty: {classData.facultyname || "N/A"}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t p-3">
        <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><FolderIconSvg className="h-5 w-5" /></button>
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
          className="text-white"
          fill="currentColor"
        />
        <path
          d="M16 17.6L0 9.6V24L16 32L32 24V9.6L16 17.6ZM16 29.3333L2.66667 22.6667V12.1333L16 19.8667L29.3333 12.1333V22.6667L16 29.3333Z"
          className="text-orange-500"
          fill="currentColor"
        />
      </svg>
      <span className={`text-2xl font-semibold text-white ${!isExpanded && 'hidden'}`}>
        CourseConnect
      </span>
    </div>
  );
}

function OptionsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  );
}

// Renamed icons to avoid conflicts
const MenuIcon = MenuIconSvg;
const PlusIcon = PlusIconSvg;
const FolderIcon = FolderIconSvg;
const ProfileIcon = User;
const HomeIcon = Home;
const BellIcon = Bell;
const CalendarIcon = Calendar;
const ActivityIcon = Activity;
const MessageSquareIcon = MessageSquare;