// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJ1qgfTNUZvT9LaOYvcSwIR7LetUnJsKA",
  authDomain: "comm-dc0a2.firebaseapp.com",
  projectId: "comm-dc0a2",
  storageBucket: "comm-dc0a2.firebasestorage.app",
  messagingSenderId: "771834365200",
  appId: "1:771834365200:web:48edbf509254c07b189195"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 갠홈 주인 UID 입력하시면 됩니다!
export const OWNER_UID = "OI2PY5O6LLRTCtQB05HXDyc9z8W2";