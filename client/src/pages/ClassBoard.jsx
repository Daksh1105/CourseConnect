// src/pages/ClassBoard.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  increment,
  getDoc
} from "firebase/firestore";
import useCurrentUser from "../hooks/useCurrentUser";

export default function ClassBoard() {
  const { classId } = useParams();
  const currentUser = useCurrentUser();

  const [qTitle, setQTitle] = useState("");
  const [qBody, setQBody] = useState("");
  const [questions, setQuestions] = useState([]);
  const [localAnswers, setLocalAnswers] = useState({});

  // subscribe to questions in this class
  useEffect(() => {
    if (!classId) return;
    const questionsRef = collection(db, "classes", classId, "questions");
    const q = query(questionsRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(arr);
    });
    return () => unsub();
  }, [classId]);

  // subscribe to answers per class (listen to all answers under questions of this class)
  // we'll query answers per-question when rendering to keep it simple and small-scale
  // (for demo this approach is OK)

  async function postQuestion() {
    if (!auth.currentUser) return alert("Please login first");
    if (!qTitle.trim()) return alert("Enter a title");
    const questionsRef = collection(db, "classes", classId, "questions");
    await addDoc(questionsRef, {
      title: qTitle,
      body: qBody || "",
      authorId: auth.currentUser.uid,
      tags: [],
      createdAt: serverTimestamp(),
      acceptedAnswerId: null,
      answerCount: 0,
      upvotes: 0
    });
    // award +2 points for asking
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { points: increment(2) });
    } catch (e) {
      // ignore if user doc missing in rare case
    }
    setQTitle(""); setQBody("");
  }

  async function postAnswer(questionId, text) {
    if (!auth.currentUser) return alert("Please login first");
    if (!text || !text.trim()) return alert("Write an answer");
    const answersRef = collection(db, "classes", classId, "questions", questionId, "answers");
    await addDoc(answersRef, {
      body: text,
      authorId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      upvotes: 0,
      isAccepted: false
    });
    // increment answer count on question
    const qDoc = doc(db, "classes", classId, "questions", questionId);
    await updateDoc(qDoc, { answerCount: increment(1) });
    // award +3 points to answerer
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { points: increment(3) });
    } catch (e) {}
    setLocalAnswers(prev => ({ ...prev, [questionId]: "" }));
  }

  // accept an answer: allowed if current user is question author or has role 'faculty'
  async function acceptAnswer(questionId, answerId) {
    if (!auth.currentUser) return alert("Please login first");
    // fetch question
    const qDocRef = doc(db, "classes", classId, "questions", questionId);
    const qSnap = await getDoc(qDocRef);
    if (!qSnap.exists()) return alert("Question missing");
    const qData = qSnap.data();
    const uid = auth.currentUser.uid;

    // check permission: question author or faculty in members
    let allowed = false;
    if (qData.authorId === uid) allowed = true;

    if (!allowed) {
      // check user's role in class
      try {
        const memSnap = await getDoc(doc(db, "classes", classId, "members", uid));
        if (memSnap.exists() && memSnap.data().role === "faculty") allowed = true;
      } catch (e) {}
    }
    if (!allowed) return alert("Only question author or faculty can accept an answer");

    // mark accepted
    const ansRef = doc(db, "classes", classId, "questions", questionId, "answers", answerId);
    await updateDoc(ansRef, { isAccepted: true });
    await updateDoc(qDocRef, { acceptedAnswerId: answerId });

    // award +5 to answerer
    const aSnap = await getDoc(ansRef);
    if (aSnap.exists()) {
      const aData = aSnap.data();
      if (aData?.authorId) {
        try {
          await updateDoc(doc(db, "users", aData.authorId), { points: increment(5) });
        } catch (e) {}
      }
    }
  }

  // helper to load answers for a question (realtime per question)
  function AnswersList({ questionId }) {
    const [answers, setAnswers] = useState([]);
    useEffect(() => {
      const ref = collection(db, "classes", classId, "questions", questionId, "answers");
      const q = query(ref, orderBy("createdAt", "asc"));
      const unsub = onSnapshot(q, snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAnswers(arr);
      });
      return () => unsub();
    }, [classId, questionId]);
    return (
      <div>
        {(answers || []).map(a => (
          <div key={a.id} style={{ borderTop: "1px dashed #ddd", paddingTop:6, marginTop:6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{a.authorId}</div>
                <div>{a.body}</div>
                <div style={{ fontSize:12, color:"#666" }}>
                  {a.isAccepted ? <span style={{ color:"green" }}>Accepted ✓</span> : null}
                </div>
              </div>
              <div>
                {!a.isAccepted && currentUser && (
                  // show Accept button only if allowed (acceptAnswer will re-check permission)
                  <button onClick={() => acceptAnswer(questionId, a.id)}>Accept</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3>Class Board</h3>
      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
        <h4>Ask a Question</h4>
        <input placeholder="Title" value={qTitle} onChange={e => setQTitle(e.target.value)} />
        <br />
        <textarea placeholder="Describe your question" value={qBody} onChange={e => setQBody(e.target.value)} />
        <br />
        <button onClick={postQuestion}>Post Question</button>
      </div>

      <h4>Questions</h4>
      {questions.map(q => (
        <div key={q.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 8 }}>
          <strong>{q.title}</strong>
          <p>{q.body}</p>
          <div>Answers: {q.answerCount || 0} — Accepted: {q.acceptedAnswerId ? "Yes" : "No"}</div>

          <AnswersList questionId={q.id} />

          <div style={{ marginTop: 8 }}>
            <input
              placeholder="Write an answer..."
              value={localAnswers[q.id] || ""}
              onChange={e => setLocalAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            />
            <button onClick={() => postAnswer(q.id, localAnswers[q.id])}>Answer</button>
          </div>
        </div>
      ))}
    </div>
  );
}
