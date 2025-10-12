// src/pages/ClassBoard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import firebaseApp, { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment,
  setDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/*
  ClassBoard:
  - shows current user's class points
  - upvotes increase/decrease answer author's member.points
  - faculty analytics panel shows top contributors (names only)
  - students cannot answer their own questions
  - users cannot upvote their own answers (added)
*/

export default function ClassBoard() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // users/{uid}
  const [classDoc, setClassDoc] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [memberDoc, setMemberDoc] = useState(null);
  const [membersMap, setMembersMap] = useState({});

  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ title: "", body: "" });

  const [fileToUpload, setFileToUpload] = useState(null);
  const [resources, setResources] = useState([]);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPoints, setCurrentPoints] = useState(0);

  const [analytics, setAnalytics] = useState({
    totalQuestions: 0,
    totalAnswers: 0,
    totalResources: 0,
    topContributors: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setUser(u);

      const userRef = doc(db, "users", u.uid);
      const userSnap = await getDoc(userRef);
      setUserProfile(userSnap.exists() ? userSnap.data() : null);

      const cRef = doc(db, "classes", classId);
      const cSnap = await getDoc(cRef);
      if (!cSnap.exists()) {
        alert("Class not found");
        navigate(-1);
        return;
      }
      setClassDoc({ id: cSnap.id, ...cSnap.data() });

      const memberRef = doc(db, "classes", classId, "members", u.uid);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        alert("You are not a member of this class.");
        navigate(-1);
        return;
      }
      setIsMember(true);
      setMemberDoc({ id: memberSnap.id || u.uid, ...memberSnap.data() });

      await loadMembersSummary();
      await fetchMemberPoints(u.uid);
      await fetchQuestions();
      await fetchResources();
      await computeAnalytics();

      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function loadMembersSummary() {
    try {
      const mSnap = await getDocs(collection(db, "classes", classId, "members"));
      const map = {};
      mSnap.docs.forEach((d) => (map[d.id] = d.data()));
      setMembersMap(map);
    } catch (e) {
      console.error("loadMembersSummary:", e);
    }
  }

  async function fetchMemberPoints(uid) {
    try {
      const memberRef = doc(db, "classes", classId, "members", uid);
      const mSnap = await getDoc(memberRef);
      if (mSnap.exists()) {
        const data = mSnap.data();
        setCurrentPoints(data.points || 0);
        setMemberDoc({ id: mSnap.id, ...data });
      } else {
        setCurrentPoints(0);
      }
    } catch (e) {
      console.error("fetchMemberPoints:", e);
      setCurrentPoints(0);
    }
  }

  async function fetchQuestions() {
    try {
      const q = query(
        collection(db, "questions"),
        where("classId", "==", classId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setQuestions(
        snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, answers: data.answers || [] };
        })
      );
    } catch (e) {
      console.error("fetchQuestions:", e);
      setQuestions([]);
    }
  }

  async function fetchResources() {
    try {
      const q = query(
        collection(db, "resources"),
        where("classId", "==", classId),
        orderBy("uploadedAt", "desc")
      );
      const snap = await getDocs(q);
      setResources(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("fetchResources:", e);
      setResources([]);
    }
  }

  // compute analytics for faculty with sanitized contributor names
  async function computeAnalytics() {
    try {
      setAnalyticsLoading(true);

      const qSnap = await getDocs(
        query(collection(db, "questions"), where("classId", "==", classId))
      );
      const totalQuestions = qSnap.size;

      let totalAnswers = 0;
      qSnap.docs.forEach((d) => {
        const data = d.data();
        totalAnswers += (data.answers || []).length;
      });

      const rSnap = await getDocs(
        query(collection(db, "resources"), where("classId", "==", classId))
      );
      const totalResources = rSnap.size;

      const mSnap = await getDocs(collection(db, "classes", classId, "members"));
      const contributors = mSnap.docs
        .map((d) => {
          const raw = d.data() || {};
          let display = raw.name || raw.email || "";
          if (!display && raw.email) display = raw.email.split("@")[0];
          if (!display && d.id) display = d.id;
          display = String(display).replace(/^\s*\d+[\.\)]\s*/g, "");
          if (display.includes("@")) display = display.split("@")[0];
          return { uid: d.id, name: display || "Unknown", points: raw.points || 0 };
        })
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);

      setAnalytics({
        totalQuestions,
        totalAnswers,
        totalResources,
        topContributors: contributors,
      });
      setAnalyticsLoading(false);
    } catch (e) {
      console.error("computeAnalytics:", e);
      setAnalyticsLoading(false);
    }
  }

  // Students only: post question
  async function handlePostQuestion(e) {
    e?.preventDefault?.();
    if (!userProfile) return alert("Profile loading...");
    if (userProfile.role !== "student") return alert("Only students can post questions.");
    if (!newQuestion.title.trim() || !newQuestion.body.trim()) return alert("Please provide title and description.");
    setPosting(true);
    try {
      await addDoc(collection(db, "questions"), {
        classId,
        title: newQuestion.title.trim(),
        body: newQuestion.body.trim(),
        author: userProfile.name || user.email,
        authorId: user.uid,
        createdAt: serverTimestamp(),
        answers: [],
        acceptedAnswerId: null,
      });
      setNewQuestion({ title: "", body: "" });
      await fetchQuestions();
      await computeAnalytics();
    } catch (e) {
      console.error("post question:", e);
      alert("Failed to post question.");
    } finally {
      setPosting(false);
    }
  }

  // Add answer (prevent answering your own question)
  async function handleAddAnswer(questionId, answerText) {
    if (!answerText.trim()) return;
    const question = questions.find((q) => q.id === questionId);
    if (!question) return alert("Question not found.");
    if (question.authorId === user.uid) {
      return alert("You cannot answer your own question.");
    }

    const qRef = doc(db, "questions", questionId);
    const answer = {
      id: `${Date.now()}_${user.uid}`,
      body: answerText.trim(),
      author: userProfile?.name || user.email,
      authorId: user.uid,
      createdAt: new Date().toISOString(),
      upvotes: [],
      accepted: false,
    };
    try {
      await updateDoc(qRef, { answers: arrayUnion(answer) });
      await fetchQuestions();
      await computeAnalytics();
    } catch (e) {
      console.error("add answer:", e);
      alert("Failed to add answer.");
    }
  }

  // Toggle upvote and update points -- prevents upvoting your own answer
  async function handleToggleUpvote(questionId, answerId) {
    if (!user) return alert("Login required.");
    try {
      const qRef = doc(db, "questions", questionId);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists()) return;
      const qData = qSnap.data();
      const answers = qData.answers || [];

      // find target answer
      const target = answers.find((a) => a.id === answerId);
      if (!target) return;

      // prevent upvoting your own answer
      if (target.authorId === user.uid) {
        // UI also disables the button, but guard here too
        return alert("You cannot upvote your own answer.");
      }

      let changed = false;
      const newAnswers = answers.map((a) => {
        if (a.id !== answerId) return a;
        const upvotes = a.upvotes || [];
        const has = upvotes.includes(user.uid);
        if (has) {
          a.upvotes = upvotes.filter((u) => u !== user.uid);
        } else {
          a.upvotes = [...upvotes, user.uid];
        }
        changed = true;
        return a;
      });
      if (!changed) return;

      await updateDoc(qRef, { answers: newAnswers });

      const answer = newAnswers.find((a) => a.id === answerId);
      if (answer) {
        const authorUid = answer.authorId;
        const memberRef = doc(db, "classes", classId, "members", authorUid);

        const currentlyHas = (answer.upvotes || []).includes(user.uid);
        if (currentlyHas) {
          await updateDoc(memberRef, { points: increment(1) }).catch(async (err) => {
            console.error("increment error:", err);
            await setDefaultMemberPoints(memberRef, 1);
          });
        } else {
          await updateDoc(memberRef, { points: increment(-1) }).catch(async (err) => {
            console.error("decrement error:", err);
            await setDefaultMemberPoints(memberRef, 0, true);
          });
        }

        await loadMembersSummary();
        await computeAnalytics();
        await fetchMemberPoints(authorUid);
        if (user?.uid) await fetchMemberPoints(user.uid);
      }

      await fetchQuestions();
    } catch (e) {
      console.error("toggleUpvote error:", e);
      alert("Failed to update upvote.");
    }
  }

  async function setDefaultMemberPoints(memberRef, value = 0, ensureNonNegative = false) {
    try {
      const docSnap = await getDoc(memberRef);
      if (!docSnap.exists()) {
        await setDoc(memberRef, {
          uid: memberRef.id,
          email: "",
          role: "student",
          points: Math.max(0, value),
          joinedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(memberRef, { points: Math.max(0, value) });
      }
    } catch (e) {
      console.error("setDefaultMemberPoints:", e);
    }
  }

  async function handleAcceptAnswer(questionId, answerId, answerAuthorId) {
    try {
      const ok = window.confirm("Mark this answer as accepted?");
      if (!ok) return;

      const qRef = doc(db, "questions", questionId);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists()) return alert("Question not found.");

      const question = qSnap.data();
      if (question.authorId !== user.uid) {
        alert("Only the author can accept an answer.");
        return;
      }

      await updateDoc(qRef, { acceptedAnswerId: answerId });

      const answers = (question.answers || []).map((a) =>
        a.id === answerId ? { ...a, accepted: true } : { ...a, accepted: false }
      );
      await updateDoc(qRef, { answers });

      const memberRef = doc(db, "classes", classId, "members", answerAuthorId);
      await updateDoc(memberRef, { points: increment(5) }).catch(async (err) => {
        console.error("accept increment error:", err);
        await setDefaultMemberPoints(memberRef, 5);
      });

      await fetchQuestions();
      await loadMembersSummary();
      await computeAnalytics();
      await fetchMemberPoints(answerAuthorId);
    } catch (err) {
      console.error("handleAcceptAnswer:", err);
      alert("Failed to accept answer: " + err.message);
    }
  }

  async function handleUploadResource(e) {
    e?.preventDefault?.();
    if (!fileToUpload) return alert("Select a file first.");
    try {
      setUploading(true);
      const storage = getStorage(firebaseApp);
      const path = `resources/${classId}/${Date.now()}_${fileToUpload.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, fileToUpload);
      const url = await getDownloadURL(ref);
      await addDoc(collection(db, "resources"), {
        classId,
        title: fileToUpload.name,
        fileUrl: url,
        uploadedBy: userProfile?.name || user.email,
        uploadedById: user.uid,
        uploadedAt: serverTimestamp(),
      });
      setFileToUpload(null);
      await fetchResources();
      await computeAnalytics();
      alert("Uploaded!");
    } catch (e) {
      console.error("uploadResource error:", e);
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  if (loading) return <div style={{ padding: 20 }}>Loading class...</div>;

  return (
    <div style={{ minHeight: "100vh", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>{classDoc?.name || "Class Board"}</h1>
          <div style={{ color: "#374151", fontSize: 13 }}>
            {classDoc?.classCode ? `Code: ${classDoc.classCode}` : ""} · {userProfile?.name || user?.email}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Class points</div>
            <div style={{ fontWeight: 700 }}>{currentPoints}</div>
          </div>

          <button onClick={() => navigate(`/class/${classId}/leaderboard`)} style={{ padding: "8px 12px", borderRadius: 6, background: "#6b21a8", color: "#fff" }}>
            Leaderboard
          </button>
          <button onClick={handleLogout} style={{ padding: "8px 12px", borderRadius: 6 }}>Logout</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div>
          {userProfile?.role === "student" ? (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ marginTop: 0 }}>Post a Question</h2>
              <form onSubmit={handlePostQuestion} style={{ display: "grid", gap: 8 }}>
                <input
                  value={newQuestion.title}
                  onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                  placeholder="Question title"
                  style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
                <textarea
                  value={newQuestion.body}
                  onChange={(e) => setNewQuestion({ ...newQuestion, body: e.target.value })}
                  placeholder="Describe your question..."
                  rows={4}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button disabled={posting} type="submit" style={{ padding: "8px 12px", borderRadius: 6, background: "#0ea5a4", color: "#fff" }}>
                    {posting ? "Posting..." : "Post Question"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section>
            <h2>Questions</h2>
            {questions.length === 0 && <div style={{ color: "#6b7280" }}>No questions yet.</div>}
            {questions.map((q) => (
              <div key={q.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{q.title}</div>
                    <div style={{ color: "#6b7280" }}>{q.body}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>by {q.author}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Answers</div>

                  {(q.answers && q.answers.length > 0) ? (
                    q.answers.map((a) => (
                      <div key={a.id} style={{ border: "1px solid #f3f4f6", padding: 8, borderRadius: 6, marginBottom: 8, background: a.accepted ? "#ecfdf5" : "#fff" }}>
                        <div style={{ fontSize: 14 }}>{a.body}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>by {a.author}</div>

                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                          {/* Disable upvote button if the current user is the author of the answer */}
                          <button
                            onClick={() => handleToggleUpvote(q.id, a.id)}
                            disabled={a.authorId === user?.uid}
                            title={a.authorId === user?.uid ? "You cannot upvote your own answer" : undefined}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #e5e7eb",
                              background: (a.upvotes || []).includes(user?.uid) ? "#059669" : "#fff",
                              color: (a.upvotes || []).includes(user?.uid) ? "#fff" : "#111827",
                              cursor: a.authorId === user?.uid ? "not-allowed" : "pointer",
                              opacity: a.authorId === user?.uid ? 0.6 : 1
                            }}
                          >
                            { (a.upvotes || []).includes(user?.uid) ? "Upvoted" : "Upvote" } ({(a.upvotes || []).length})
                          </button>

                          {a.accepted ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✔ Accepted</span>
                          ) : (
                            q.authorId === user?.uid && (
                              <button
                                onClick={() => handleAcceptAnswer(q.id, a.id, a.authorId)}
                                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#eef2ff", cursor: "pointer" }}
                              >
                                Accept
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#6b7280" }}>No answers yet.</div>
                  )}

                  {q.authorId !== user?.uid ? (
                    <AnswerBox questionId={q.id} onSubmit={handleAddAnswer} currentUser={user} />
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
                      You cannot answer your own question.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside style={{ background: "#fff", padding: 12, borderRadius: 8, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}>
          {userProfile?.role === "faculty" && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Class Analytics</h3>
              {analyticsLoading ? (
                <div style={{ color: "#6b7280" }}>Loading analytics...</div>
              ) : (
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Questions: <strong>{analytics.totalQuestions}</strong></div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Answers: <strong>{analytics.totalAnswers}</strong></div>
                  <div style={{ fontSize: 14, marginBottom: 8 }}>Resources: <strong>{analytics.totalResources}</strong></div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Top contributors</div>
                    {analytics.topContributors.length === 0 && <div style={{ color: "#6b7280" }}>No contributors yet.</div>}
                    <ol style={{ paddingLeft: 16 }}>
                      {analytics.topContributors.map((c, i) => (
                        <li key={c.uid} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                          <div>{i + 1}. {c.name}</div>
                          <div style={{ color: "#6b7280" }}>{c.points} pts</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <button onClick={computeAnalytics} style={{ padding: "6px 10px", borderRadius: 6, background: "#0ea5a4", color: "#fff" }}>Refresh Analytics</button>
              </div>
            </div>
          )}

          <h3 style={{ marginTop: 0 }}>Resources</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} />
            <button onClick={handleUploadResource} disabled={uploading} style={{ padding: "8px 10px", background: "#4f46e5", color: "#fff", borderRadius: 6 }}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {resources.length === 0 && <div style={{ color: "#6b7280" }}>No resources uploaded yet.</div>}
          {resources.map(r => (
            <div key={r.id} style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>by {r.uploadedBy}</div>
              <div style={{ marginTop: 6 }}>
                <a href={r.fileUrl} target="_blank" rel="noreferrer">Download</a>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

/* Answer box component */
function AnswerBox({ questionId, onSubmit, currentUser }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!currentUser) return alert("Please login to answer.");
        if (!text.trim()) return alert("Answer cannot be empty.");
        onSubmit(questionId, text);
        setText("");
      }}
      style={{ marginTop: 8 }}
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your answer..." style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }} rows={3} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button type="submit" style={{ padding: "6px 10px", borderRadius: 6, background: "#111827", color: "#fff" }}>Post Answer</button>
      </div>
    </form>
  );
}
