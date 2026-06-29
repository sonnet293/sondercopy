// js/character.js
import { auth, db, OWNER_UID } from "./firebase.js";
import { uploadImage } from "./supabase.js";

import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CARD_COUNT = 8;
const docRef = doc(db, "characterCards", "main");

let cardsData = makeEmptyCards();
let isOwner = false;
let currentEditIndex = null;
let selectedFile = null;
let photoRemoved = false;

function makeEmptyCards() {
  return Array.from({ length: CARD_COUNT }, () => ({ name: "", imageUrl: "" }));
}

const gallery = document.getElementById("gallery");
const editModal = document.getElementById("editModal");
const previewImg = document.getElementById("previewImg");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const fileInput = document.getElementById("fileInput");
const nameInput = document.getElementById("nameInput");
const modalError = document.getElementById("modalError");
const removePhotoBtn = document.getElementById("removePhotoBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn")

function buildGallery() {
  for (let i = 0; i < CARD_COUNT; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = String(i);
    card.innerHTML = `
      <div class="photo-frame is-empty">
          <img alt="" class="photo-img" />
      </div>
      <p class="card-name is-empty">NAME</p>`;

      const photoFrame = card.querySelector(".photo-frame");

      photoFrame.addEventListener("click", () => {
        if (!isOwner) return;
        openEditModal(i);
      });

      gallery.appendChild(card);
  }
}

function renderCards() {
  const cards = gallery.querySelectorAll(".card");
  cards.forEach((card, i) => {
    const data = cardsData[i] || { name: "", imageUrl: "" };
    const photoFrame = card.querySelector(".photo-frame");
    const img = card.querySelector(".photo-img");
    const nameEl = card.querySelector(".card-name");

    if (data.imageUrl) {
      img.src = data.imageUrl;
      img.alt = data.name || "";
      photoFrame.classList.remove("is-empty");
    } else {
      img.src = "";
      photoFrame.classList.add("is-empty");
    }

    if (data.name) {
      nameEl.textContent = data.name;
      nameEl.classList.remove("is-empty");
    } else {
      nameEl.textContent = "NAME";
      nameEl.classList.add("is-empty");
    }
  });
}

onSnapshot(
  docRef,
  (snap) => {
    if (snap.exists() && Array.isArray(snap.data().cards)) {
      const saved = snap.data().cards;
      cardsData = makeEmptyCards().map((empty, i) => ({ ...empty, ...saved[i] }));
    } else {
      cardsData = makeEmptyCards();
    }
    renderCards();
  },
  (err) => {
    console.error("카드 불러오기 실패:", err);
  }
);

function updateAuthUI() {
  document.body.classList.toggle("is-owner", isOwner);
}

onAuthStateChanged(auth, (user) => {
  isOwner = !!user && user.uid === OWNER_UID;
  updateAuthUI();
});

// 편집 모달
function openEditModal(index) {
  currentEditIndex = index;
  selectedFile = null;
  photoRemoved = false;
  fileInput.value = "";
  modalError.hidden = true;

  const data = cardsData[index] || { name: "", imageUrl: "" };
  nameInput.value = data.name || "";
  setPreview(data.imageUrl || "");

  editModal.hidden = false;
}

function closeEditModal() {
  editModal.hidden = true;
  currentEditIndex = null;
  selectedFile = null;
}

function setPreview(url) {
  if (url) {
    previewImg.src = url;
    previewImg.hidden = false;
    previewPlaceholder.hidden = true;
  } else {
    previewImg.src = "";
    previewImg.hidden = true;
    previewPlaceholder.hidden = false;
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  selectedFile = file;
  photoRemoved = false;
  setPreview(URL.createObjectURL(file));
});

removePhotoBtn.addEventListener("click", () => {
  selectedFile = null;
  photoRemoved = true;
  fileInput.value = "";
  setPreview("");
});

cancelBtn.addEventListener("click", closeEditModal);

editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

saveBtn.addEventListener("click", async () => {
  if (currentEditIndex === null) return;

  modalError.hidden = true;
  saveBtn.disabled = true;
  cancelBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = "저장 중..."

  try {
    let imageUrl = cardsData[currentEditIndex].imageUrl || "";

    if (selectedFile) {
      imageUrl = await uploadImage(selectedFile, selectedFile.name);
    } else if (photoRemoved) {
      imageUrl = "";
    }

    const newCards = cardsData.map((c, i) => i === currentEditIndex ? { name: nameInput.value.trim(), imageUrl } : c
  );

  await setDoc(docRef, { cards: newCards }, { merge: true });
  closeEditModal();
  } catch (err) {
    console.error("저장 실패:", err);
    modalError.textContent = "저장 실패: " + err.message;
    modalError.hidden = false;
  } finally {
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
});

buildGallery();