import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDW63Zwu1F16lHJCs39A63qkR9n9hqEMvU",
  authDomain: "courseconnect-1fe16.firebaseapp.com",
  projectId: "courseconnect-1fe16",
  storageBucket: "courseconnect-1fe16.firebasestorage.app",
  messagingSenderId: "1028323421033",
  appId: "1:1028323421033:web:cfc3c02ed972d1e3336bf8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
