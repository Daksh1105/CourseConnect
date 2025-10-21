import React, { useEffect, useState } from "react";
import { db, storage, auth } from "../firebase"; // your Firebase config
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  increment,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, ArrowUp } from "lucide-react";

export default function ResourcesPage() {
  const [resources, setResources] = useState({
    syllabus: [],
    ppts: [],
    assignments: [],
    books: [],
    pyqs: [],
    materials: [],
  });
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Fetch auth user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, "students", u.uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);
      }
    });
    fetchResources();
    return () => unsubscribe();
  }, []);

  // Fetch all resource categories
  const fetchResources = async () => {
    const categories = ["syllabus", "ppts", "assignments", "books", "pyqs", "materials"];
    const newResources = {};
    for (const cat of categories) {
      const snapshot = await getDocs(collection(db, "resources", "classA", cat));
      newResources[cat] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    setResources(newResources);
  };

  // Upload by student (to "materials")
  const handleStudentUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return alert("Fill all fields!");
    const fileRef = ref(storage, `materials/${uploadFile.name}`);
    await uploadBytes(fileRef, uploadFile);
    const fileURL = await getDownloadURL(fileRef);

    await addDoc(collection(db, "resources", "classA", "materials"), {
      title: uploadTitle,
      fileURL,
      uploadedBy: user.uid,
      uploadedByName: user.displayName || "Anonymous",
      upvotes: 0,
    });

    setUploadFile(null);
    setUploadTitle("");
    fetchResources();
  };

  // Upload by faculty (to any other category)
  const handleFacultyUpload = async (category) => {
    if (!uploadFile || !uploadTitle.trim()) return alert("Fill all fields!");
    const fileRef = ref(storage, `${category}/${uploadFile.name}`);
    await uploadBytes(fileRef, uploadFile);
    const fileURL = await getDownloadURL(fileRef);

    await addDoc(collection(db, "resources", "classA", category), {
      title: uploadTitle,
      fileURL,
      uploadedBy: user.uid,
      uploadedByName: user.displayName || "Faculty",
    });

    setUploadFile(null);
    setUploadTitle("");
    fetchResources();
  };

  // Handle upvote (no self-upvote)
  const handleUpvote = async (materialId, uploadedBy) => {
    if (uploadedBy === user.uid) return alert("You can’t upvote your own material!");
    const docRef = doc(db, "resources", "classA", "materials", materialId);
    await updateDoc(docRef, { upvotes: increment(1) });

    // Update class points of uploader
    const uploaderRef = doc(db, "students", uploadedBy);
    await updateDoc(uploaderRef, { classPoints: increment(5) });

    fetchResources();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">📚 Class Resources</h1>

      {/* -------- Faculty/Static Sections -------- */}
      {["syllabus", "ppts", "assignments", "books", "pyqs"].map((cat) => (
        <Card key={cat} className="mb-6 shadow-md border-t-4 border-gray-300">
          <CardContent>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold capitalize">{cat}</h2>

              {/* Upload visible only to faculty */}
              {userRole === "faculty" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Title for ${cat}`}
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="border p-1 rounded-md text-sm"
                  />
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="border p-1 rounded-md text-sm"
                  />
                  <Button
                    onClick={() => handleFacultyUpload(cat)}
                    className="flex items-center gap-2"
                  >
                    <Upload size={16} /> Upload
                  </Button>
                </div>
              )}
            </div>

            <ul className="list-disc ml-6">
              {resources[cat]?.length > 0 ? (
                resources[cat].map((res) => (
                  <li key={res.id}>
                    <a
                      href={res.fileURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {res.title}
                    </a>
                  </li>
                ))
              ) : (
                <p className="text-gray-500">No {cat} uploaded yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* -------- Student Uploaded Section -------- */}
      <Card className="shadow-lg border-t-4 border-blue-500">
        <CardContent>
          <h2 className="text-2xl font-semibold mb-4">📤 Student Uploaded Material</h2>

          {/* Student Upload Form */}
          {userRole === "student" && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Enter title..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="border p-2 rounded-md flex-1"
              />
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="border p-2 rounded-md flex-1"
              />
              <Button onClick={handleStudentUpload} className="flex items-center gap-2">
                <Upload size={18} /> Upload
              </Button>
            </div>
          )}

          {/* Uploaded materials */}
          {resources.materials?.length > 0 ? (
            resources.materials.map((m) => (
              <div
                key={m.id}
                className="flex justify-between items-center p-3 border rounded-lg mb-2 bg-white hover:shadow"
              >
                <div>
                  <a
                    href={m.fileURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-700"
                  >
                    {m.title}
                  </a>
                  <p className="text-sm text-gray-500">
                    Uploaded by {m.uploadedByName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpvote(m.id, m.uploadedBy)}
                    className="flex items-center gap-1 border px-3 py-1 rounded-md hover:bg-gray-100"
                  >
                    <ArrowUp size={16} /> {m.upvotes}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No student materials yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
