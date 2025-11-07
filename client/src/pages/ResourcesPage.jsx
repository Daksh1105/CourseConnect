// src/pages/ResourcesPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { db, auth, storage } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
  query,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

// --- lucide-react Imports ---
import {
  Library,
  Book,
  Presentation,
  ClipboardList,
  GraduationCap,
  Users,
  Search,
  Tag,
  Upload,
  FileText,
  ThumbsUp,
  Download,
  FileUp,
} from "lucide-react";

// --- Helper maps ---
const categoryIcons = {
  syllabus: <Book className="w-5 h-5 text-sky-600" />,
  ppts: <Presentation className="w-5 h-5 text-orange-600" />,
  assignments: <ClipboardList className="w-5 h-5 text-red-600" />,
  books: <Library className="w-5 h-5 text-green-600" />,
  pyqs: <GraduationCap className="w-5 h-5 text-purple-600" />,
};

const studentTags = ["notes", "assignments", "books", "pyqs"];

// ===================================================================
// === File Upload Button Component ==================================
// ===================================================================
function FileUploadButton({ onFileSelect, file }) {
  const fileInputRef = useRef(null);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => onFileSelect(e.target.files[0] || null)}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current.click()}
        className="w-full sm:w-auto"
      >
        <FileUp className="w-4 h-4 mr-2" />
        Choose File
      </Button>
      <span className="text-sm text-gray-500 truncate max-w-[200px]">
        {file ? file.name : "No file chosen"}
      </span>
    </div>
  );
}

// ===================================================================
// === Main Page =====================================================
// ===================================================================
export default function ResourcesPage() {
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [studentMaterials, setStudentMaterials] = useState([]);
  const [facultyMaterials, setFacultyMaterials] = useState({
    syllabus: [],
    ppts: [],
    assignments: [],
    books: [],
    pyqs: [],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const [materialTitle, setMaterialTitle] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const categories = ["syllabus", "ppts", "assignments", "books", "pyqs"];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.uid);
      setLoading(true);
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserRole(userSnap.data().role);
        await fetchAllMaterials();
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Error fetching data.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const fetchAllMaterials = async () => {
    try {
      const studentColRef = collection(
        db,
        "resources",
        "classA",
        "studentMaterials"
      );
      const studentSnapshot = await getDocs(
        query(studentColRef, orderBy("upvotes", "desc"))
      );
      const studentData = studentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStudentMaterials(studentData);

      const facultyPromises = categories.map((cat) => {
        const catColRef = collection(db, "resources", "classA", cat);
        return getDocs(query(catColRef, orderBy("uploadedAt", "desc")));
      });
      const facultySnapshots = await Promise.all(facultyPromises);
      const newFacultyMaterials = {};
      facultySnapshots.forEach((snap, i) => {
        const category = categories[i];
        newFacultyMaterials[category] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      });
      setFacultyMaterials(newFacultyMaterials);
    } catch (err) {
      console.error("Error fetching materials:", err);
    }
  };

  // 🔹 Upload file (faculty only for main sections)
  const uploadResource = async (category) => {
    if (!file) return alert("Please select a file to upload.");
    if (userRole !== "faculty") return alert("Only faculty can upload to this section.");

    setUploading(true);
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
      await fetchAllMaterials();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading file!");
    } finally {
      setUploading(false);
    }
  };

  // 🔹 Upload student material
  const uploadStudentMaterial = async () => {
    if (!file || !materialTitle) return alert("Please enter title and select a file.");

    setUploading(true);
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
      await fetchAllMaterials();
    } catch (err) {
      console.error("Error uploading material:", err);
      alert("Failed to upload material.");
    } finally {
      setUploading(false);
    }
  };

  // 🔹 Handle upvote logic
  const handleUpvote = async (materialId, uploaderId) => {
    if (uploaderId === userId) return alert("You cannot upvote your own material!");

    try {
      const matRef = doc(db, "resources", "classA", "studentMaterials", materialId);
      await updateDoc(matRef, { upvotes: increment(1) });

      const uploaderRef = doc(db, "users", uploaderId);
      await updateDoc(uploaderRef, { points: increment(20) });

      setStudentMaterials((prev) =>
        prev.map((m) => (m.id === materialId ? { ...m, upvotes: m.upvotes + 1 } : m))
      );
    } catch (err) {
      console.error("Error upvoting:", err);
      alert("Failed to upvote.");
    }
  };

  const filteredMaterials = studentMaterials.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedTags.length === 0 || selectedTags.some((tag) => m.tags?.includes(tag)))
  );

  if (loading) return <p className="text-center mt-10">Loading your permissions...</p>;
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;

  const FileListItem = ({ file }) => (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
        <span className="font-medium text-gray-800">{file.title}</span>
      </div>
      <Button asChild variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          <Download className="w-4 h-4 mr-2" />
          Download
        </a>
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      {/* ==== PAGE HEADER ==== */}
      <div className="flex items-center gap-3 border-b pb-3">
        <Library className="w-8 h-8 text-orange-600" />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Class Resources</h1>
      </div>

      {/* ==== STUDENT UPLOAD ==== */}
      {userRole === "student" && (
        <Card className="shadow-lg border-orange-100 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-600" />
              Upload Your Study Material
            </CardTitle>
            <CardDescription>Share helpful materials with classmates and earn points!</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Enter title (e.g. 'Mid-Term 1 Notes')"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
            />
            <Input
              placeholder="Add tags (e.g. 'notes, chapter-3, easy')"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <div className="md:col-span-2">
              <FileUploadButton onFileSelect={setFile} file={file} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={() => uploadStudentMaterial()} disabled={uploading} className="bg-orange-600 hover:bg-orange-700">
              {uploading ? "Uploading..." : "Upload & Share"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ==== FACULTY MATERIALS ==== */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Official Faculty Materials</CardTitle>
          <CardDescription>Course materials provided by your faculty members.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {categories.map((cat) => (
              <AccordionItem value={cat} key={cat}>
                <AccordionTrigger className="capitalize font-medium text-lg">
                  <div className="flex items-center gap-3">
                    {categoryIcons[cat]}
                    <span>{cat}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  {userRole === "faculty" && (
                    <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                      <h4 className="font-medium">Upload to {cat}</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <FileUploadButton onFileSelect={setFile} file={file} />
                        <Button onClick={() => uploadResource(cat)} disabled={uploading} className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto">
                          {uploading ? "..." : "Upload"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {facultyMaterials[cat].length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No {cat} uploaded yet.</p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {facultyMaterials[cat].map((file) => (
                        <FileListItem key={file.id} file={file} />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* ==== STUDENT MATERIALS ==== */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-600" />
            Student Uploaded Materials
          </CardTitle>
          <CardDescription>Browse, search, and upvote materials shared by students.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search + Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* ===== FIXED: use flex row so icon and input are vertically aligned ===== */}
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-500 pointer-events-none" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Search student materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5 text-gray-700">
                <Tag className="w-4 h-4 text-gray-500" />
                Filter by tag
              </label>
              <ToggleGroup type="multiple" variant="outline" value={selectedTags} onValueChange={(tags) => setSelectedTags(tags)} className="flex flex-wrap gap-2">
                {studentTags.map((tag) => (
                  <ToggleGroupItem key={tag} value={tag} className="capitalize data-[state=on]:bg-orange-100 data-[state=on]:text-orange-700">
                    {tag}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {filteredMaterials.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No student materials found matching your criteria.</p>
            ) : (
              filteredMaterials.map((mat) => (
                <Card key={mat.id} className="border rounded-lg shadow-none">
                  <CardContent className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex flex-col h-auto p-2 group hover:bg-orange-50 hover:border-orange-200"
                        onClick={() => handleUpvote(mat.id, mat.uploadedBy)}
                      >
                        <ThumbsUp className="w-5 h-5 text-gray-500 group-hover:text-orange-600" />
                        <span className="font-bold text-sm text-gray-700 group-hover:text-orange-700">{mat.upvotes}</span>
                      </Button>
                      <div>
                        <h3 className="font-medium text-lg">{mat.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {mat.tags?.map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="ghost" className="text-orange-600 hover:text-orange-700">
                      <a href={mat.url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
