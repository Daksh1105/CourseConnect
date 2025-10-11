// src/pages/FacultyDashboard.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function FacultyDashboard() {
  const { classId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [topTags, setTopTags] = useState([]);
  const [unanswered, setUnanswered] = useState([]);

  useEffect(() => {
    if (!classId) return;
    const qRef = collection(db, "classes", classId, "questions");
    const q = query(qRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(arr);
      const onlyUn = arr.filter(x => !x.acceptedAnswerId);
      setUnanswered(onlyUn);

      // compute tag counts
      const counts = {};
      arr.forEach(item => {
        (item.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      });
      const sorted = Object.entries(counts).map(([tag, count]) => ({ tag, count }))
        .sort((a,b) => b.count - a.count);
      setTopTags(sorted.slice(0, 10));
    });
    return () => unsub();
  }, [classId]);

  return (
    <div>
      <h3>Faculty Dashboard</h3>

      <div style={{ marginBottom: 18 }}>
        <h4>Unanswered Questions ({unanswered.length})</h4>
        <ul>
          {unanswered.map(q => <li key={q.id}><strong>{q.title}</strong> — {q.body}</li>)}
        </ul>
      </div>

      <div>
        <h4>Top Tags</h4>
        {topTags.length ? (
          <ol>
            {topTags.map(t => <li key={t.tag}>{t.tag} — {t.count}</li>)}
          </ol>
        ) : <div>No tags yet</div>}
      </div>
    </div>
  );
}
