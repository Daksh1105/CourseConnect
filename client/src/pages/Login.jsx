// src/pages/Login.jsx
import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (isSignUp) {
        // create account
        const resp = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", resp.user.uid), {
          name,
          email,
          role: "student",   // default role
          points: 0,
          joinedAt: new Date()
        });
      } else {
        // sign in
        await signInWithEmailAndPassword(auth, email, pass);
      }
      nav("/dashboard");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <h3>{isSignUp ? "Sign up" : "Login"}</h3>
      <form onSubmit={handleSubmit}>
        {isSignUp && (
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <div>
          <button type="submit">{isSignUp ? "Sign Up" : "Login"}</button>
          <button
            type="button"
            onClick={() => setIsSignUp((s) => !s)}
            style={{ marginLeft: 8 }}
          >
            {isSignUp ? "Have an account? Login" : "No account? Sign up"}
          </button>
        </div>
      </form>
    </div>
  );
}
