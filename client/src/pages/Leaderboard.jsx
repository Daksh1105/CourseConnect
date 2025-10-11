// src/pages/Leaderboard.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default function Leaderboard({ classId }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      // simplest: query all users and sort by points (for small demo)
      const q = query(collection(db, "users"), orderBy("points", "desc"));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(arr);
    })();
  }, [classId]);

  return (
    <div>
      <h4>Leaderboard</h4>
      <ol>
        {members.slice(0, 10).map(u => (
          <li key={u.id}>{u.name || u.email} — {u.points || 0} pts</li>
        ))}
      </ol>
    </div>
  );
}
