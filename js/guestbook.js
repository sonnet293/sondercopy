// js/guestbook/js
import { auth, db, OWNER_UID } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const nameInput = document.getElementById("name-input");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const messageList = document.getElementById("message-list");
const emptyState = document.getElementById("empty-state");
const toast = document.getElementById("toast");

let currentUser = null;
let isOwner = false;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isOwner = user?.uid === OWNER_UID;
});

sendBtn.addEventListener("click", sendMessage);

async function sendMessage() {
  const text = messageInput.value.trim();
  const name = nameInput.value.trim() || "Guest";
  if (!text) { showToast("메시지를 입력해주세요", true); return; }
  sendBtn.disabled = true;
  try {
    await addDoc(colloection(db, "guestbook"), {
      name,
      message: text,
      uid: currentUser?.uid || null,
      isOwner: isOwner,
      reply: null,
      timestamp: serverTimestamp()
    });

    messageInput.value = "";
    nameInput.value = "";
  } catch (e) {
    showToast("전송 실패: " + e.message, true);
  } finally {
    sendBtn.disabled = false;
  }
}

const q = query(colloection(db, "guestbook"), orderBy("timestamp", "desc"));













let toastTimer;
function showToast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2500);
}