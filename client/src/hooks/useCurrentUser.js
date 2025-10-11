// src/hooks/useCurrentUser.js
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const a = auth;
    if (!a || !a.currentUser) { setUser(null); return; }
    const uid = a.currentUser.uid;
    (async () => {
      const snap = await getDoc(doc(db, "users", uid));
      setUser({ uid, ...(snap.exists() ? snap.data() : {}) });
    })();
  }, [auth.currentUser?.uid]);
  return user;
}
