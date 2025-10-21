import React, { useState } from "react";
import { Home, Megaphone, MessageSquare, BookOpen, Trophy } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import QnaPage from "./QnaPage";
import ResourcesPage from "./ResourcesPage";
import AnnouncementsPage from "./AnnouncementsPage";
import LeaderboardPage from "./LeaderboardPage"; // ✅ New Leaderboard component

export default function ClassBoard() {
  const [activePage, setActivePage] = useState("home");

  const renderContent = () => {
    switch (activePage) {
      case "home":
        return (
          <Card className="shadow-md">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Class Dashboard</h2>
              <p className="text-gray-500">Welcome to your class workspace 👋</p>
            </CardHeader>
            <CardContent className="text-gray-700 space-y-3">
              <p>
                Use the sidebar to navigate to announcements, QnA discussions, and shared resources.
              </p>
              <p>
                You can also check your class Leaderboard to see the top contributors ranked by points.
              </p>
            </CardContent>
          </Card>
        );

      case "announcements":
        return <AnnouncementsPage />;

      case "qna":
        return <QnaPage />;

      case "resources":
        return <ResourcesPage />;

      case "leaderboard":
        return <LeaderboardPage />;

      default:
        return null;
    }
  };

  const menuItems = [
    { id: "home", label: "Home", icon: <Home className="w-5 h-5" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="w-5 h-5" /> },
    { id: "qna", label: "Q&A", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "resources", label: "Resources", icon: <BookOpen className="w-5 h-5" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-5 h-5" /> }, // ✅ Added Leaderboard
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-inter">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold text-indigo-600">CourseConnect</h1>
          <p className="text-xs text-gray-500">Class Dashboard</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition ${
                activePage === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t text-center text-xs text-gray-500">
          © 2025 CourseConnect
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">{renderContent()}</main>
    </div>
  );
}
