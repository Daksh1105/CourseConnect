// src/pages/FacultyDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
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
  limit, 
  getCountFromServer, 
} from "firebase/firestore";

// --- Shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Lucide React Imports ---
import {
  LogOut,
  PenSquare,
  PlusCircle,
  BookMarked,
  LayoutDashboard,
  Users,      
  BookCopy,   
  FileText,   
  Bell, 
  MessageSquare, 
} from "lucide-react";

export default function FacultyDashboard() {
  const navigate = useNavigate();

  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);

  const [creating, setCreating] = useState(false);
  const [newClass, setNewClass] = useState({ code: "", title: "" });

  const [loading, setLoading] = useState(true);
  
  // --- NEW: State for stats and feeds ---
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalResources, setTotalResources] = useState(0);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Listen auth and load profile + classes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setAuthUser(u);
      setLoading(true);
      await loadUserProfile(u.uid);
      const classes = await fetchMyClasses(u.uid);
      // After classes are fetched, fetch all related stats
      await fetchDashboardData(u.uid, classes); 
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
        setProfile({
          name: auth.currentUser?.displayName || "",
          email: auth.currentUser?.email || "",
          role: "faculty",
        });
      }
    } catch (e) {
      console.error("loadUserProfile:", e);
    }
  }

  // Fetch classes and calculate total students
  async function fetchMyClasses(uid) {
    try {
      const classesSnap = await getDocs(
        query(collection(db, "classes"), orderBy("createdAt", "desc"))
      );
      const joined = [];
      const allMemberIds = new Set();

      for (const c of classesSnap.docs) {
        const memberRef = doc(db, "classes", c.id, "members", uid);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const classData = c.data();
          joined.push({ id: c.id, ...classData });
          // Add all members to the Set for counting
          classData.memberIds?.forEach(id => allMemberIds.add(id));
        }
      }
      
      allMemberIds.delete(uid); // Remove the faculty member from the count
      setTotalStudents(allMemberIds.size); // Set total unique students
      
      setMyClasses(joined);
      if (joined.length > 0 && !activeClassId)
        setActiveClassId(joined[0].id);
        
      return joined; // Return for next function
    } catch (e) {
      console.error("fetchMyClasses:", e);
      setMyClasses([]);
      return [];
    }
  }
  
  // --- NEW: Function to fetch all dashboard card data ---
  async function fetchDashboardData(uid, classes) {
    if (classes.length === 0) {
      setLoadingStats(false);
      return;
    }
    
    setLoadingStats(true);
    try {
      // 1. Fetch recent announcements
      const annPromises = classes.map(cls => 
        getDocs(query(collection(db, "classes", cls.id, "announcements"), orderBy("postedAt", "desc"), limit(2)))
      );
      const annSnapshots = await Promise.all(annPromises);
      const allAnnouncements = annSnapshots.flatMap(snap => snap.docs.map(d => d.data()));
      allAnnouncements.sort((a, b) => b.postedAt.toDate() - a.postedAt.toDate());
      setRecentAnnouncements(allAnnouncements.slice(0, 3));

      // 2. Fetch recent questions
      const qPromises = classes.map(cls => 
        getDocs(query(collection(db, "classes", cls.id, "questions"), orderBy("postedAt", "desc"), limit(2)))
      );
      const qSnapshots = await Promise.all(qPromises);
      const allQuestions = qSnapshots.flatMap(snap => snap.docs.map(d => d.data()));
      allQuestions.sort((a, b) => b.postedAt.toDate() - a.postedAt.toDate());
      setRecentQuestions(allQuestions.slice(0, 3));

      // 3. Count total resources
      let resourceCount = 0;
      const resourcePromises = [];
      classes.forEach(cls => {
        resourcePromises.push(getCountFromServer(collection(db, "classes", cls.id, "tasks")));
        resourcePromises.push(getCountFromServer(collection(db, "classes", cls.id, "questions")));
        // Add more collections here as you build them (e.g., 'ppts', 'syllabus')
      });
      const counts = await Promise.all(resourcePromises);
      counts.forEach(snap => {
        resourceCount += snap.data().count;
      });
      setTotalResources(resourceCount);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoadingStats(false);
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

      const docRef = await addDoc(classesRef, {
        classCode: code,
        name: title,
        facultyname: profile?.name || "Faculty", // Using lowercase to match your fix
        createdBy: authUser.email,
        createdAt: serverTimestamp(),
        facultyId: authUser.uid,
        memberIds: [authUser.uid],
      });

      const memberRef = doc(db, "classes", docRef.id, "members", authUser.uid);
      await setDoc(memberRef, {
        uid: authUser.uid,
        email: authUser.email,
        role: "faculty",
        joinedAt: serverTimestamp(),
        name: profile?.name || "Faculty", 
      });

      // Manually add the new class to state to avoid a full re-fetch
      const newClassData = { id: docRef.id, classCode: code, name: title, facultyname: profile?.name || "Faculty" };
      setMyClasses([newClassData, ...myClasses]);
      setNewClass({ code: "", title: "" });
      setActiveClassId(docRef.id);
      
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
      await updateDoc(userRef, { name: trimmed }).catch(async () => {
        await setDoc(userRef, {
          uid: authUser.uid,
          name: trimmed,
          email: authUser.email,
          role: "faculty",
          createdAt: serverTimestamp(),
        });
      });
      setProfile((prev) => ({ ...(prev || {}), name: trimmed }));
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

  // --- NEW: Stat Card Component ---
  function StatCard({ title, value, icon, color, loading }) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {React.cloneElement(icon, { className: `h-4 w-4 ${color}` })}
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
          ) : (
             <div className="text-2xl font-bold">{value}</div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  return (
    <TooltipProvider> {/* Added for Tooltip */}
      <div className="min-h-screen bg-slate-100 p-6 lg:p-8">
        {/* --- Header --- */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {profile?.name || authUser?.email}
            </h1>
            <p className="text-gray-500 capitalize">
              {profile?.role || "faculty"} Dashboard
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </header>

        {/* --- MODIFIED: Stat Cards Grid --- */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <StatCard 
            title="Total Classes" 
            value={myClasses.length} // Real data
            icon={<BookCopy />}
            color="text-orange-600"
            loading={loading}
          />
          <StatCard 
            title="Total Students" 
            value={totalStudents} // Real data
            icon={<Users />}
            color="text-blue-600"
            loading={loadingStats}
          />
          <StatCard 
            title="Total Resources" 
            value={totalResources} // Real data
            icon={<FileText />}
            color="text-green-600"
            loading={loadingStats}
          />
        </div>
        
        {/* --- Main 2-Column Layout --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* --- Left Column --- */}
          <aside className="lg:col-span-1 space-y-6">
            
            {/* Profile Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profile</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleEditName} className="text-gray-500 hover:text-orange-600">
                      <PenSquare className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Name</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={profile?.photoURL} alt={profile?.name} />
                    <AvatarFallback className="bg-orange-100 text-orange-600">
                      {profile?.name ? profile.name[0].toUpperCase() : "F"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{profile?.name || "Faculty User"}</div>
                    <div className="text-sm text-gray-500">{authUser?.email}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Create Class Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-orange-600" />
                  Create New Class
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleCreateClass}>
                <CardContent className="space-y-4">
                  <Input
                    value={newClass.title}
                    onChange={(e) =>
                      setNewClass({ ...newClass, title: e.target.value })
                    }
                    placeholder="Class Title (e.g. Machine Learning)"
                  />
                  <Input
                    value={newClass.code}
                    onChange={(e) =>
                      setNewClass({ ...newClass, code: e.target.value })
                    }
                    placeholder="Class Code (e.g. UCS501)"
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={creating} className="w-full bg-orange-600 hover:bg-orange-700">
                    {creating ? "Creating..." : "Create Class"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* My Classes Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-orange-600" />
                  My Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {myClasses.length === 0 && (
                    <p className="text-sm text-gray-500 text-center">
                      You haven't created any classes yet.
                    </p>
                  )}
                  {myClasses.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveClassId(c.id);
                        openClass(c.id);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        activeClassId === c.id
                          ? "bg-orange-100 border-orange-200 border"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{c.name || "Untitled Class"}</div>
                      <div className="text-sm text-gray-500">{c.classCode}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* --- MODIFIED: Right (Main) Column --- */}
          <main className="lg:col-span-2 space-y-6">
            
            {/* --- NEW: Recent Announcements Card --- */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-600" />
                  Recent Announcements
                </CardTitle>
                <CardDescription>
                  The last 3 announcements you posted across all classes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <p className="text-sm text-gray-500">Loading announcements...</p>
                ) : recentAnnouncements.length === 0 ? (
                  <p className="text-sm text-gray-500">No announcements found.</p>
                ) : (
                  <div className="space-y-3">
                    {recentAnnouncements.map((ann, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-800 truncate">{ann.title}</p>
                        <p className="text-sm text-gray-600 line-clamp-1">{ann.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {ann.postedAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- NEW: Recent Questions Card --- */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  Recent Student Questions
                </CardTitle>
                <CardDescription>
                  The newest questions from students in your classes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <p className="text-sm text-gray-500">Loading questions...</p>
                ) : recentQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500">No questions found.</p>
                ) : (
                  <div className="space-y-3">
                    {recentQuestions.map((q, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-800 line-clamp-1">{q.text}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          by {q.authorName || 'Student'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}