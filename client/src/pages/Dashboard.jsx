// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";

export default function Dashboard() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [myClasses, setMyClasses] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, "classes"),
        where("createdBy", "==", auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyClasses(arr);
    };
    load();
  }, []);

  async function createClass() {
    if (!auth.currentUser) return alert("Please login first");
    const classCode = nanoid(6);
    const docRef = await addDoc(collection(db, "classes"), {
      title,
      code: classCode,
      createdBy: auth.currentUser.uid,
      createdAt: new Date()
    });
    await setDoc(doc(db, `classes/${docRef.id}/members`, auth.currentUser.uid), {
      role: "faculty",
      joinedAt: new Date()
    });
    setMyClasses((prev) => [
      { id: docRef.id, title, code: classCode },
      ...prev
    ]);
    setTitle("");
  }

  async function joinClass() {
    if (!auth.currentUser) return alert("Please login first");
    const q = query(collection(db, "classes"), where("code", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return alert("Invalid code");
    const classDoc = snap.docs[0];
    const classId = classDoc.id;
    await setDoc(doc(db, `classes/${classId}/members`, auth.currentUser.uid), {
      role: "student",
      joinedAt: new Date()
    });
    setCode("");
    nav(`/class/${classId}`);
  }

  return (
    <div>
      <h3>Dashboard</h3>
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Create class title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button onClick={createClass}>Create Class</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Enter class code to join"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button onClick={joinClass}>Join Class</button>
      </div>

      <h4>My Classes</h4>
      <ul>
        {myClasses.map((c) => (
          <li key={c.id}>
            {c.title} (code: {c.code}) —{" "}
            <button onClick={() => nav(`/class/${c.id}`)}>Open</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
