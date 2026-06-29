import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
  loginForm.style.display = "block";
  signupForm.style.display = "none";
  document.getElementById("login-result").textContent = "";
});

signupTab.addEventListener("click", () => {
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.style.display = "block";
  loginForm.style.display = "none";
  document.getElementById("signup-result").textContent = "";
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const result   = document.getElementById("login-result");

  if (!email || !password) {
    result.textContent = "이메일과 비밀번호를 입력해주세요.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    result.style.color = "#4caf50";
    result.textContent = "로그인 성공!";
    location.href = "character.html";
  } catch (error) {
    result.style.color = "";
    result.textContent = getErrorMessage(error.code);
    console.error(error);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email           = document.getElementById("signup-email").value.trim();
  const password        = document.getElementById("signup-password").value;
  const passwordConfirm = document.getElementById("signup-password-confirm").value;
  const result          = document.getElementById("signup-result");

  if (!email || !password) {
    result.textContent = "이메일과 비밀번호를 입력해주세요.";
    return;
  }
  if (password !== passwordConfirm) {
    result.textContent = "비밀번호가 일치하지 않습니다.";
    return;
  }
  if (password.length < 6) {
    result.textContent = "비밀번호는 6자 이상이어야 합니다.";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Firestore에 사용자 문서 생성 (role 없음 — 주인이 직접 role: friend 추가)
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      createdAt: serverTimestamp(),
    });
    result.style.color = "#4caf50";
    result.textContent = "회원가입 성공!";
    setTimeout(() => { location.href = "character.html"; }, 800);
  } catch (error) {
    result.style.color = "";
    result.textContent = getErrorMessage(error.code);
    console.error(error);
  }
});

function getErrorMessage(code) {
  switch (code) {
    case "auth/user-not-found":       return "존재하지 않는 이메일입니다.";
    case "auth/wrong-password":       return "비밀번호가 틀렸습니다.";
    case "auth/invalid-email":        return "올바르지 않은 이메일 형식입니다.";
    case "auth/email-already-in-use": return "이미 사용 중인 이메일입니다.";
    case "auth/weak-password":        return "비밀번호가 너무 약합니다.";
    case "auth/invalid-credential":   return "이메일 또는 비밀번호가 올바르지 않습니다.";
    default:                          return "오류가 발생했습니다. 다시 시도해주세요.";
  }
}
