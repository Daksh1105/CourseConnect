import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";

/*
  Leaderboard.jsx

  - URL: /class/:classId/leaderboard
  - Reads members from: classes/{classId}/members
  - Displays: rank, display name, points
  - Highlights current user
  - Search by name, simple pagination, Export CSV
*/

export default function Leaderboard() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [classDoc, setClassDoc] = useState(null);

  const [members, setMembers] = useState([]); // full list
  const [filtered, setFiltered] = useState([]); // filtered by search
  const [search, setSearch] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    loadAll().finally(() => setLoading(false));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function loadAll() {
    setLoading(true);
    try {
      // load class metadata (optional)
      const cRef = doc(db, "classes", classId);
      const cSnap = await getDoc(cRef);
      if (cSnap.exists()) setClassDoc({ id: cSnap.id, ...(cSnap.data() || {}) });

      // load members
      const mSnap = await getDocs(collection(db, "classes", classId, "members"));
      const arr = mSnap.docs.map((d) => {
        const data = d.data() || {};
        // build a clean display name (prefer name, else email local-part)
        let display = data.name || data.email || "";
        if (!display && data.email) display = data.email.split("@")[0];
        // strip leading numbering artifacts like "1. alice"
        display = String(display).replace(/^\s*\d+[\.\)]\s*/g, "");
        if (display.includes("@")) display = display.split("@")[0];
        return {
          uid: d.id,
          display,
          nameRaw: data.name || null,
          email: data.email || null,
          points: data.points || 0,
          joinedAt: data.joinedAt || null,
        };
      });

      // sort by points desc then name asc
      arr.sort((a, b) => {
        const pa = a.points || 0;
        const pb = b.points || 0;
        if (pa !== pb) return pb - pa;
        return a.display.localeCompare(b.display);
      });

      setMembers(arr);
      setFiltered(arr);
      setPage(1);
    } catch (err) {
      console.error("loadAll leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  // search handler
  useEffect(() => {
    if (!search) {
      setFiltered(members);
      setPage(1);
      return;
    }
    const q = String(search).trim().toLowerCase();
    const f = members.filter((m) => (m.display || "").toLowerCase().includes(q));
    setFiltered(f);
    setPage(1);
  }, [search, members]);

  // pagination helpers
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  // export CSV
  function exportCSV() {
    const rows = [["Rank", "Name", "Points", "Email", "UID"]];
    members.forEach((m, i) => {
      rows.push([i + 1, m.display, m.points, m.email || "", m.uid]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${classDoc?.classCode || classId}_leaderboard.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // quick jump to user rank
  function scrollToUser() {
    if (!user) return;
    const idx = members.findIndex((m) => m.uid === user.uid);
    if (idx === -1) {
      alert("You are not on this leaderboard (not a class member).");
      return;
    }
    const newPage = Math.floor(idx / PER_PAGE) + 1;
    setPage(newPage);
    // slight delay to let list render
    setTimeout(() => {
      const el = document.getElementById(`member-row-${members[idx].uid}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0 }}>{classDoc?.classTitle || classDoc?.name || "Class Leaderboard"}</h1>
            <div style={{ color: "#6b7280", fontSize: 13 }}>{classDoc?.classCode ? `Code: ${classDoc.classCode}` : ""}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => navigate(-1)} style={buttonStyle}>Back</button>
            <button onClick={exportCSV} style={{ ...buttonStyle, background: "#6b21a8", color: "#fff" }}>Export CSV</button>
            <button onClick={loadAll} style={buttonStyle}>Refresh</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 260 }}
            />
            <button onClick={scrollToUser} style={buttonStyle}>Jump to me</button>
          </div>

          <div style={{ color: "#6b7280" }}>
            Showing <strong>{filtered.length}</strong> member{filtered.length !== 1 ? "s" : ""} • Page {page}/{totalPages}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 8px 30px rgba(15,23,42,0.06)" }}>
          {loading ? (
            <div style={{ padding: 24 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, color: "#6b7280" }}>No members found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eef2f6" }}>
                  <th style={{ padding: "12px 8px", width: 80 }}>Rank</th>
                  <th style={{ padding: "12px 8px" }}>Student</th>
                  <th style={{ padding: "12px 8px", width: 140 }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((m, idx) => {
                  const globalIndex = (page - 1) * PER_PAGE + idx;
                  const isMe = user && m.uid === user.uid;
                  return (
                    <tr
                      id={`member-row-${m.uid}`}
                      key={m.uid}
                      style={{
                        background: isMe ? "linear-gradient(90deg, #ecfdf5, #ffffff)" : "transparent",
                        fontWeight: isMe ? 700 : 500,
                      }}
                    >
                      <td style={{ padding: "12px 8px", verticalAlign: "middle" }}>{globalIndex + 1}</td>
                      <td style={{ padding: "12px 8px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 999, background: "#f3f4f6", display: "flex",
                            alignItems: "center", justifyContent: "center", color: "#374151", fontWeight: 700
                          }}>
                            {m.display ? m.display.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={{ fontSize: 15 }}>{m.display}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{m.email ? maskEmail(m.email) : m.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", verticalAlign: "middle" }}>
                        <div style={{ fontSize: 15 }}>{m.points}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div style={{ color: "#6b7280" }}>
            {filtered.length > 0 && `Showing ${Math.min(filtered.length, (page-1)*PER_PAGE+1)} - ${Math.min(filtered.length, page*PER_PAGE)} of ${filtered.length}`}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={goPrev} disabled={page <= 1} style={{ ...buttonStyle, opacity: page <= 1 ? 0.6 : 1 }}>Prev</button>
            <button onClick={goNext} disabled={page >= totalPages} style={{ ...buttonStyle, opacity: page >= totalPages ? 0.6 : 1 }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* small helpers */
const buttonStyle = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
};

function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!local) return email;
  if (local.length <= 2) return `**@${domain}`;
  const visible = Math.min(3, local.length - 2);
  return `${local.slice(0, visible)}***@${domain}`;
}
