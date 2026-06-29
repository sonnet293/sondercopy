// js/backup.js
import { db } from "./firebase.js";
import { loadFonts } from "./fonts.js";

// 방문자에게도 커스텀 폰트가 렌더링되도록 CSS 주입
loadFonts();
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const postList = document.getElementById("post-list");
const skeletonList = document.getElementById("skeleton-list");
const emptyState = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");

let allPosts = [];
let pendingPost = null;

function formatDate(ts) {
    if (!ts) return "";   
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}