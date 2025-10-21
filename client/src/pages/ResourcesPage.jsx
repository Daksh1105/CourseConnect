import React, { useEffect, useState } from "react";
import { db, auth, storage } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ResourcesPage() {
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const categories = ["syllabus", "ppts", "assignments", "books", "pyqs"];

  // 🔹 Fetch role from users collection
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setLoading(true);
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
          setUserId(user.uid);
        } else {
          console.warn("User document not found in Firestore!");
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError("Error fetching user permissions.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 🔹 Fetch student materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const colRef = collection(db, "resources", "classA", "studentMaterials");
        const snapshot = await getDocs(colRef);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMaterials(data);
      } catch (err) {
        console.error("Error fetching materials:", err);
      }
    };
    fetchMaterials();
  }, []);

  // 🔹 Upload file (faculty only for main sections)
  const uploadResource = async (category) => {
    if (!file) return alert("Please select a file to upload.");
    if (userRole !== "faculty")
      return alert("Only faculty can upload to this section.");

    try {
      const fileRef = ref(storage, `resources/${category}/${file.name}`);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, "resources", "classA", category), {
        title: file.name,
        url: fileUrl,
        uploadedBy: userId,
        uploadedAt: Date.now(),
      });

      alert(`${category} uploaded successfully!`);
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading file!");
    }
  };

  // 🔹 Upload student material
  const uploadStudentMaterial = async () => {
    if (!file || !materialTitle)
      return alert("Please enter title and select a file.");

    try {
      const fileRef = ref(storage, `studentMaterials/${file.name}`);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, "resources", "classA", "studentMaterials"), {
        title: materialTitle,
        url: fileUrl,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        upvotes: 0,
        tags: tags ? tags.split(",").map((t) => t.trim().toLowerCase()) : [],
      });

      alert("Material uploaded successfully!");
      setMaterialTitle("");
      setTags("");
      setFile(null);
    } catch (err) {
      console.error("Error uploading material:", err);
      alert("Failed to upload material.");
    }
  };

  // 🔹 Handle upvote logic
  const handleUpvote = async (materialId, uploaderId) => {
    if (uploaderId === userId)
      return alert("You cannot upvote your own material!");

    try {
      const matRef = doc(db, "resources", "classA", "studentMaterials", materialId);
      await updateDoc(matRef, { upvotes: increment(1) });

      const uploaderRef = doc(db, "users", uploaderId);
      await updateDoc(uploaderRef, { points: increment(20) });

      setMaterials((prev) =>
        prev.map((m) =>
          m.id === materialId ? { ...m, upvotes: m.upvotes + 1 } : m
        )
      );
    } catch (err) {
      console.error("Error upvoting:", err);
      alert("Failed to upvote.");
    }
  };

  // 🔍 Search + Tag Filter
  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedTags.length === 0 ||
        selectedTags.some((tag) => m.tags?.includes(tag)))
  );

  if (loading) return <p className="text-center mt-10">Loading your permissions...</p>;
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        📚 Class Resources
      </h1>

      {/* ================= Faculty Sections ================= */}
      {categories.map((cat) => (
        <Card key={cat} className="mb-6">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2 capitalize">{cat}</h2>

            {userRole === "faculty" && (
              <div className="mb-3 flex gap-2 items-center">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <Button onClick={() => uploadResource(cat)}>Upload</Button>
              </div>
            )}

            <p className="text-gray-500">
              No {cat} uploaded yet.
            </p>
          </CardContent>
        </Card>
      ))}

      {/* ================= Student Uploaded Materials ================= */}
      <Card>
        <CardContent>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🧑‍🎓 Student Uploaded Material
          </h2>

          {/* Student Upload Section */}
          {userRole === "student" && (
            <div className="mb-6 space-y-2">
              <Input
                type="text"
                placeholder="Enter title"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
              />
              <Input
                type="text"
                placeholder="Add tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <Button onClick={uploadStudentMaterial}>Upload Material</Button>
            </div>
          )}

        {/* Search & Filter Section */}
<div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6">
  {/* 🔍 Search Bar */}
  <div className="w-full sm:w-2/3">
    <Input
      type="text"
      placeholder="🔍 Search uploaded materials..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
    />
  </div>

  {/* 🏷️ Filter by Tag */}
  <div className="w-full sm:w-1/3">
    <label className="block text-sm text-gray-600 mb-1">Filter by tag:</label>
    <select
      multiple
      className="border rounded-lg p-2 w-full focus:ring-2 focus:ring-indigo-400 outline-none"
      onChange={(e) =>
        setSelectedTags([...e.target.selectedOptions].map((o) => o.value))
      }
    >
      <option value="notes">Notes</option>
      <option value="assignments">Assignments</option>
      <option value="books">Books</option>
      <option value="pyqs">PYQs</option>
    </select>
    <p className="text-xs text-gray-500 mt-1">
      (Hold <b>Ctrl</b> or <b>Cmd</b> to select multiple)
    </p>
  </div>
</div>


          {/* Display Student Materials */}
          {filteredMaterials.length === 0 ? (
            <p className="text-gray-500">No student materials found.</p>
          ) : (
            <div className="grid gap-3">
              {filteredMaterials.map((mat) => (
                <Card key={mat.id}>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{mat.title}</h3>
                      <p className="text-sm text-gray-500">
                        {mat.tags?.join(", ")}
                      </p>
                      <a
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline text-sm"
                      >
                        View File
                      </a>
                    </div>
                    <div className="flex flex-col items-center">
                      <Button
                        size="sm"
                        onClick={() => handleUpvote(mat.id, mat.uploadedBy)}
                      >
                        👍 {mat.upvotes}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
