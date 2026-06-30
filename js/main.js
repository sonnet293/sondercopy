// js/main.js
import { db } from "./firebase.js";
import { loadFonts } from "./fonts.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

loadFonts();

const listEl = document.getElementById("main-recent-posts");

async function loadRecentPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(12));
    const snap = await getDocs(q);

    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => {
        const vis = p.visibility ?? (p.isSecret ? "secret" : "public");
        return vis === "public";
      })
      .slice(0, 4);

    listEl.innerHTML = "";

    if (posts.length === 0) {
      listEl.innerHTML = '<li class="rp-empty">아직 작성된 글이 없어요.</li>';
      return;
    }

    posts.forEach(post => {
      const li = document.createElement("li");
      li.className = "rp-item";
      li.innerHTML = `<a href="backup.html">${post.title}</a>`;
      listEl.appendChild(li);
    });
  } catch {
    listEl.innerHTML = '<li class="rp-empty">불러오기에 실패했어요.</li>';
  }
}

loadRecentPosts();
