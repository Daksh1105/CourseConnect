// src/pages/ClassBoard.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom"; // Import useParams and Link
import { db, auth } from "../firebase"; // Assuming firebase is configured
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Lucide Icons (as in your sample)
import { Home, Megaphone, MessageSquare, BookOpen, Trophy, Bell, Calendar, Clock, TrendingUp, Award, Users, CheckCircle2, Folder, ChevronRight } from "lucide-react";

// Shadcn/ui components (make sure these are installed and configured)
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";

// Your existing sub-page components
import QnaPage from "./QnaPage";
import ResourcesPage from "./ResourcesPage";
import AnnouncementsPage from "./AnnouncementsPage";
import LeaderboardPage from "./LeaderboardPage";

export default function ClassBoard() {
  const { classId } = useParams(); // Get classId from URL
  const [activePage, setActivePage] = useState("home");
  const [classData, setClassData] = useState(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch basic class details and recent announcements
  useEffect(() => {
    if (!classId) return;
  
    // ✅ Wait for Firebase Auth to confirm user is loaded
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return; // if user not logged in, skip
  
      setLoading(true);
      setError("");
  
      try {
        // Fetch class details
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        if (classSnap.exists()) {
          setClassData(classSnap.data());
        } else {
          setError("Class not found.");
        }
  
        // Fetch announcements only for logged-in user
        const annQuery = query(
          collection(db, "classes", classId, "announcements"),
          orderBy("postedAt", "desc"),
          limit(3)
        );
        const annSnap = await getDocs(annQuery);
        setRecentAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching class data:", err);
        setError("Failed to load class data.");
      } finally {
        setLoading(false);
      }
    });
  
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [classId]);



  // --- Placeholder Data (from your sample App code) ---
  // Replace these with actual fetched data later if needed
  const stats = [
    { label: "Course Progress", value: 68, icon: TrendingUp, color: "text-blue-600" },
    { label: "Assignments Due", value: 4, icon: Calendar, color: "text-orange-600" },
    { label: "Class Rank", value: "#12", icon: Award, color: "text-purple-600" },
  ];
   const upcomingDeadlines = [
     { title: "Assignment 3: Data Structures", due: "Tomorrow", status: "pending" },
     { title: "Quiz 4: Algorithms", due: "Oct 29", status: "pending" },
     { title: "Project Milestone 2", due: "Nov 2", status: "completed" },
   ];
   const recentActivity = [
     { user: "Dr. Sarah Johnson", action: "posted a new resource", time: "1h ago", avatar: "SJ" },
     { user: "Alex Chen", action: "answered your question", time: "3h ago", avatar: "AC" },
     { user: "Course TA", action: "graded Assignment 2", time: "5h ago", avatar: "TA" },
   ];
  // --- End Placeholder Data ---


  // Sidebar menu items - using your original items
  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "announcements", label: "Announcements", icon: Megaphone }, // Changed icon to Megaphone as per your original code
    { id: "qna", label: "Q&A", icon: MessageSquare },
    { id: "resources", label: "Resources", icon: BookOpen },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  // Function to render the main content based on activePage
  const renderContent = () => {
    if (loading) {
        return <div className="flex items-center justify-center h-full"><p>Loading class...</p></div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full"><p className="text-red-600">{error}</p></div>;
    }
    if (!classData) {
        return <div className="flex items-center justify-center h-full"><p>Class data not available.</p></div>;
    }

    // Show specific page components when selected
    switch (activePage) {
      case "announcements":
        return <AnnouncementsPage classId={classId} />; // Pass classId
      case "qna":
        return <QnaPage classId={classId} />; // Pass classId
      case "resources":
        return <ResourcesPage classId={classId} />; // Pass classId
      case "leaderboard":
        return <LeaderboardPage classId={classId} />; // Pass classId
      case "home":
      default:
        // Render the new dashboard layout for the "home" page
        return (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 text-white shadow-xl">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">👋</span>
                  {/* You could add dynamic info like current week later */}
                </div>
                <h2 className="text-3xl mb-1 font-semibold">{classData.name || "Class Dashboard"}</h2>
                <p className="text-orange-100 text-lg mb-2">
                  Class Code: {classData.classCode || "N/A"}
                </p>
                <p className="text-orange-100">
                    Welcome back! Use the sidebar to navigate through class sections.
                </p>
              </div>
              {/* Optional decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50"></div>
              <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-yellow-300/20 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* Stats Grid - Using Placeholders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl bg-gray-100 ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        {typeof stat.value === 'number' && stat.value <= 100 ? (
                           <span className="text-3xl font-semibold text-gray-800">{stat.value}%</span>
                         ) : (
                           <span className="text-3xl font-semibold text-gray-800">{stat.value}</span>
                         )}
                      </div>
                      <p className="text-gray-600">{stat.label}</p>
                      {typeof stat.value === 'number' && stat.value <= 100 && (
                        <Progress value={stat.value} className="mt-3 h-2 [&>*]:bg-orange-500" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Announcements Card - Using Fetched Data */}
             <Card className="border-none shadow-md">
               <CardHeader className="border-b border-gray-100">
                 <div className="flex items-center justify-between">
                   <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                     <Bell className="w-5 h-5 text-orange-600" />
                     Recent Announcements
                   </CardTitle>
                   <Button variant="ghost" size="sm" onClick={() => setActivePage('announcements')}>
                     View All <ChevronRight className="w-4 h-4 ml-1"/>
                   </Button>
                 </div>
               </CardHeader>
               <CardContent className="p-6 space-y-4">
                 {recentAnnouncements.length === 0 && (
                     <p className="text-gray-500 text-sm">No announcements posted yet.</p>
                 )}
                 {recentAnnouncements.map((announcement) => (
                   <div
                     key={announcement.id}
                     className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                     // Optional: Make this clickable to view full announcement
                     // onClick={() => navigateToAnnouncement(announcement.id)}
                   >
                     {/* Icon or indicator can go here */}
                     <div className="w-2 h-2 rounded-full mt-1.5 bg-orange-500 flex-shrink-0"></div>
                     <div className="flex-1">
                       <p className="font-medium text-gray-900">{announcement.title || "Untitled Announcement"}</p>
                       <p className="text-sm text-gray-600 line-clamp-2 mt-1">{announcement.content}</p>
                       <div className="flex items-center gap-2 mt-1">
                         <Clock className="w-3 h-3 text-gray-400" />
                         <span className="text-xs text-gray-500">
                             {announcement.postedAt?.toDate().toLocaleDateString('en-IN', { month: 'short', day: 'numeric'}) || "Unknown date"}
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}
               </CardContent>
             </Card>

            {/* Placeholder Cards for Deadlines & Activity (Optional) */}
            {/* You can remove these if you don't need them now */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upcoming Deadlines */}
               <Card className="border-none shadow-md">
                 <CardHeader className="border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                      <Calendar className="w-5 h-5 text-orange-600" />
                      Upcoming Deadlines
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-4">
                   {upcomingDeadlines.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                         {item.status === "completed" ? (
                           <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                         ) : (
                           <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0"></div>
                         )}
                         <div className="flex-1">
                           <p className={item.status === "completed" ? "text-gray-500 line-through" : "text-gray-900"}>
                             {item.title}
                           </p>
                           <span className="text-sm text-gray-500">{item.due}</span>
                         </div>
                         {item.status === "pending" && item.due === "Tomorrow" && (
                           <Badge variant="destructive" className="flex-shrink-0 bg-red-500">Urgent</Badge>
                         )}
                      </div>
                   ))}
                 </CardContent>
               </Card>

                {/* Recent Activity */}
               <Card className="border-none shadow-md">
                 <CardHeader className="border-b border-gray-100">
                   <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                     <Users className="w-5 h-5 text-orange-600" />
                     Recent Activity
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                   <div className="space-y-4">
                     {recentActivity.map((activity, index) => (
                       <div key={index} className="flex items-center gap-4">
                         <Avatar className="h-9 w-9">
                           <AvatarFallback className="bg-orange-100 text-orange-600">
                             {activity.avatar}
                           </AvatarFallback>
                         </Avatar>
                         <div className="flex-1">
                           <p className="text-sm text-gray-900">
                             <span className="font-medium">{activity.user}</span>{" "}
                             <span className="text-gray-600">{activity.action}</span>
                           </p>
                           <div className="flex items-center gap-1.5 mt-0.5">
                             <Clock className="w-3 h-3 text-gray-400" />
                             <span className="text-xs text-gray-500">{activity.time}</span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </CardContent>
               </Card>
            </div>

          </div> // End of space-y-6
        );
    }
  };


  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden"> {/* Use lighter bg */}
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-200">
          {/* Re-use Logo component if available, otherwise basic text */}
          <h1 className="text-xl font-semibold text-gray-800">CourseConnect</h1>
          <p className="text-sm text-gray-500 mt-1">{classData?.name || "Class Dashboard"}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon; // Get the component type
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md scale-[1.02]" // Orange theme active state
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {/* Render the icon component */}
                {React.isValidElement(Icon) ? React.cloneElement(Icon) : <Icon className="w-5 h-5" />}
                <span className="flex-1 text-left">{item.label}</span>
                {/* Optional: Add badge logic if needed later */}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} CourseConnect
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
         {/* Use padding consistent with dashboard */}
         <div className="p-6 lg:p-8">
            {renderContent()}
         </div>
      </main>
    </div>
  );
}