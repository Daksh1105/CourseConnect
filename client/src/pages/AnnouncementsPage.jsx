import React, { useEffect, useState } from "react";
import { db, auth, storage } from "../firebase"; // your Firebase setup
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Upload } from "lucide-react";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);

  // Fetch user & role
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, "students", u.uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);
      }
    });
    fetchAnnouncements();
    return () => unsubscribe();
  }, []);

  // Fetch announcements
  const fetchAnnouncements = async () => {
    const snapshot = await getDocs(collection(db, "announcements", "classA", "posts"));
    const data = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
    setAnnouncements(data);
  };

  // Handle faculty announcement post
  const handlePost = async () => {
    if (!title.trim() || !message.trim()) return alert("Please fill all fields!");

    let fileURL = null;
    if (file) {
      const fileRef = ref(storage, `announcements/${file.name}`);
      await uploadBytes(fileRef, file);
      fileURL = await getDownloadURL(fileRef);
    }

    await addDoc(collection(db, "announcements", "classA", "posts"), {
      title,
      message,
      fileURL,
      postedBy: user.displayName || "Faculty",
      timestamp: serverTimestamp(),
    });

    setTitle("");
    setMessage("");
    setFile(null);
    fetchAnnouncements();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center flex justify-center items-center gap-2">
        <Megaphone size={28} /> Class Announcements
      </h1>

      {/* Faculty Announcement Form */}
      {userRole === "faculty" && (
        <Card className="shadow-md border-t-4 border-blue-500 mb-6">
          <CardContent>
            <h2 className="text-xl font-semibold mb-3">📢 Post New Announcement</h2>
            <input
              type="text"
              placeholder="Enter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 rounded-md w-full mb-3"
            />
            <textarea
              placeholder="Write your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border p-2 rounded-md w-full mb-3 h-24"
            ></textarea>

            <div className="flex gap-2 mb-3">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="border p-2 rounded-md w-full"
              />
              <Button onClick={handlePost} className="flex items-center gap-2">
                <Upload size={18} /> Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display Announcements */}
      {announcements.length > 0 ? (
        announcements.map((a) => (
          <Card key={a.id} className="mb-4 shadow-sm border border-gray-200">
            <CardContent>
              <div className="flex justify-between">
                <h2 className="text-lg font-semibold text-blue-700">{a.title}</h2>
                <span className="text-sm text-gray-500">
                  {a.timestamp?.toDate
                    ? new Date(a.timestamp.toDate()).toLocaleString()
                    : ""}
                </span>
              </div>
              <p className="mt-2 text-gray-700 whitespace-pre-line">{a.message}</p>
              {a.fileURL && (
                <a
                  href={a.fileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline mt-2 block"
                >
                  View Attachment
                </a>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Posted by {a.postedBy || "Faculty"}
              </p>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-gray-500 text-center mt-8">No announcements yet.</p>
      )}
    </div>
  );
}
