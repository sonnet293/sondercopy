// js/write.js
import { auth, db, OWNER_UID } from "./firebase.js";
import { uploadImage } from "./supabase.js";
import { injectFontCSS, loadFonts, saveFont } from "./fonts.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const Font = Quill.import("formats/font");
Font.whitelist = ["serif", "monospace", "pretendard"];
Quill.register(Font, true);

const Size = Quill.import("attributors/style/size");
Size.whitelist = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];
Quill.register(Size, true);

const quill = new Quill("#editor", {
    theme: "snow",
    placeholder: "내용 입력",
    modules: {
        toolbar: { container: "#toolbar", handlers: { image: imageHandler } }, // TODO: handler 추가
    },
});

let currentUser = null;
let cropperInstance = null;
let pendingImageFile = null;
let colorTarget = "color";
let currentR = 0, currentG = 0, currentB = 0;
let thumbnailBlob = null;

// 인증 관련
const editorSection = document.getElementById("editor-section");
const toastEl = document.getElementById("toast");

// 크롭
const cropModal = document.getElementById("crop-modal");
const cropImage = document.getElementById("crop-image");
const cropConfirmBtn = document.getElementById("crop-confirm");
const cropCancelBtn = document.getElementById("crop-cancel");

// 색상 패널
const colorPanel = document.getElementById("color-panel");
const colorPanelTitle = document.getElementById("color-panel-title");
const colorPanelClose = document.getElementById("color-panel-close");
const textColorBtn = document.getElementById("text-color-btn");
const bgColorBtn = document.getElementById("bg-color-btn");
const sliderR = document.getElementById("slider-r");
const sliderG = document.getElementById("slider-g");
const sliderB = document.getElementById("slider-b");
const numR = document.getElementById("num-r");
const numG = document.getElementById("num-g");
const numB = document.getElementById("num-b");
const hexInput = document.getElementById("hex-input");
const colorPreview = document.getElementById("color-preview");
const colorApplyBtn = document.getElementById("color-apply-btn");
const textColorIndicator = document.getElementById("text-color-indicator");
const bgColorIndicator = document.getElementById("bg-color-indicator");

// 폰트 추가
const addFontBtn = document.getElementById("add-font-btn");
const fontModal = document.getElementById("font-modal");
const fontModalClose = document.getElementById("font-modal-close");
const fontModalCancel = document.getElementById("font-modal-cancel");
const fontModalConfirm = document.getElementById("font-modal-confirm");
const fontLabelInput = document.getElementById("font-label-input");
const fontUrlInput = document.getElementById("font-url-input");

// 썸네일
const thumbnailArea = document.getElementById("thumbnail-area");
const thumbnailInput = document.getElementById("thumbnail-input");
const thumbnailPreview = document.getElementById("thumbnail-preview");
const thumbnailPlaceholder = document.getElementById("thumbnail-placeholder");
const thumbnailRemove = document.getElementById("thumbnail-remove");


onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const isOwner = user && user.uid === OWNER_UID;
  editorSection.style.display = isOwner? "block" : "none";
});

thumbnailArea.addEventListener("click", (e) => {
  if (e.target === thumbnailRemove) return;
  thumbnailInput.click();
});

thumbnailInput.addEventListener("change", () => {
  const file = thumbnailInput.files[0];
  if (!file) return;
  thumbnailBlob = file;
  const url = URL.createObjectURL(file);
  thumbnailPreview.src = url;
  thumbnailPreview.style.display = "block";
  thumbnailPlaceholder.style.display = "none";
  thumbnailRemove.style.display = "flex";
});

thumbnailRemove.addEventListener("click", (e) => {
  e.stopPropagation();
  thumbnailBlob = null;
  thumbnailInput.value = "";
  thumbnailPreview.src = "";
  thumbnailPreview.style.display = "none";
  thumbnailPlaceholder.style.display = "flex";
  thumbnailRemove.style.display = "none";
});

// 비밀글 선택 시 비밀번호 인풋 표시
const secretPwWrap = document.getElementById("secret-pw-wrap");
const secretPassword = document.getElementById("secret-password");

document.querySelectorAll('input[name="visibility"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const isSecret = radio.value === "secret";
    secretPwWrap.style.display = isSecret ? "block" : "none";
    if (!isSecret) secretPassword.value = "";
  });
});

// 게시하기
document.getElementById("reset-btn").addEventListener("click", () => {
  document.getElementById("post-title").value = "";
  quill.setContents([]);
  thumbnailBlob = null;
  thumbnailInput.value = "";
  thumbnailPreview.src = "";
  thumbnailPreview.style.display = "none";
  thumbnailPlaceholder.style.display = "flex";
  thumbnailRemove.style.display = "none";
  document.querySelector('input[name="visibility"][value="public"]').checked = true;
  secretPwWrap.style.display = "none";
  secretPassword.value = "";
});

document.getElementById("submit-btn").addEventListener("click", async () => {
  if (!currentUser) return showToast("로그인이 필요합니다.", true);
  const title = document.getElementById("post-title").value.trim();
  if (!title) return showToast("제목을 입력해주세요.", true);
  if (quill.getText().trim().length === 0) return showToast("내용을 입력해주세요.", true);

  const visibility = document.querySelector('input[name="visibility"]:checked')?.value ?? "public";
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "저장 중...";

  try {
    let thumbnailUrl = null;
    if (thumbnailBlob) {
      thumbnailUrl = await uploadImage(thumbnailBlob, "thumbnail.jpg");
    }

    const pw = visibility === "secret" ? (secretPassword.value.trim() || null) : null;

    await addDoc(collection(db, "posts"), {
      title,
      content: JSON.stringify(quill.getContents()),
      contentHtml: quill.root.innerHTML,
      visibility,
      ...(pw ? { secretPassword: pw } : {}),
      thumbnailUrl,
      createdAt: serverTimestamp(),
      uid: currentUser.uid,
    });

    showToast("게시 완료!");
    setTimeout(() => { location.href = "backup.html"; }, 900);
  } catch (err) {
    showToast("게시 실패: " + err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "게시하기";
  }
});

// 크로퍼
function imageHandler() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.click();
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    pendingImageFile = file;
    openCropModal(file);
  });
}

function openCropModal(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    cropImage.src = e.target.result;
    cropModal.classList.add("active");
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
    cropperInstance = new Cropper(cropImage, {
      viewMode: 1, autoCropArea: 0.9,
      movable: true, zoomable: true, rotatable: false, scalable: false,
    });
  };
  reader.readAsDataURL(file);
}

cropConfirmBtn.addEventListener("click", async () => {
  if (!cropperInstance) return;
  cropConfirmBtn.disabled = true;
  cropConfirmBtn.textContent = "업로드 중...";
  try {
    const canvas = cropperInstance.getCroppedCanvas({ maxWidth: 1600, maxHeight: 1600 });
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, pendingImageFile.type || "image/jpeg", 0.88)
  );
  const ext = (pendingImageFile.name.split(".").pop() || "jpg").toLowerCase();
  const publicUrl = await uploadImage(blob, `image.${ext}`);
  const range = quill.getSelection(true);
  quill.insertEmbed(range.index, "image", publicUrl);
  quill.setSelection(range.index + 1);
  closeCropModal();
  showToast("이미지 업로드 완료");
  } catch (err) {
    showToast("이미지 업로드 실패: " + err.message, true);
  } finally {
    cropConfirmBtn.disabled = false;
    cropConfirmBtn.textContent = "적용";
  }
});

cropCancelBtn.addEventListener("click", closeCropModal);
cropModal.addEventListener("click", (e) => {
  if (e.target === cropModal) closeCropModal();
});

function closeCropModal() {
  cropModal.classList.remove("active");
  if (cropperInstance) {
    cropperInstance.destroy(); cropperInstance = null;
  }
  pendingImageFile = null;
}

// 색상 패널
// 초기 색상 지정 가능합니다(아래 헥스코드 변경)
const PRESETS = [
  "#000000", "#495057", "#868e96", "#ced4da",
  "#dee2e6", "#ffffff", "#f03e3e", "#e67700",
  "#f59f00", "#37b24d", "#1c7ed6", "#7048e8", 
  "#d6336c", "#ff6b6b", "#ffa94d", "#ffd43b",
  "#69db7c", "#4dabf7", "#9775fa", "#f783ac",
];

function buildPresets() {
  const wrap = document.getElementById("color-presets");
  wrap.innerHTML = "";
  PRESETS.forEach((hex) => {
    const btn = document.createElement("button");
    btn.className = "preset-swatch";
    btn.style.background = hex;
    btn.title = hex;
    if (hex === "#ffffff") btn.style.border = "1.5px solid #ddd";
    btn.addEventListener("click", () => applyHex(hex.slice(1)));
    wrap.appendChild(btn);
  });
}
buildPresets();

function openColorPanel(target, anchorEl) {
  colorTarget = target;
  colorPanelTitle.textContent = target === "color" ? "글자 색" : "배경 색";
  const format = quill.getFormat();
  const current = format[target] || (target === "color" ? "#000000" : "#ffffff");
  applyHex(current.replace("#",""), false);
  const rect = anchorEl.getBoundingClientRect();
  colorPanel.style.top = (rect.bottom + 6 + window.scrollY) + "px";
  colorPanel.style.left = Math.min(rect.left, window.innerWidth - 300) + "px";
  colorPanel.classList.add("active");
}

function closeColorPanel() {
  colorPanel.classList.remove("active");
}

textColorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  colorPanel.classList.contains("active") && colorTarget === "color"
   ? closeColorPanel() : openColorPanel("color", textColorBtn);
});

bgColorBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  colorPanel.classList.contains("active") && colorTarget === "background"
    ? closeColorPanel() : openColorPanel("background", bgColorBtn);
});

colorPanelClose.addEventListener("click", closeColorPanel);
document.addEventListener("click", (e) => {
  if (!colorPanel.contains(e.target) && e.target !== textColorBtn && e.target !== bgColorBtn)
    closeColorPanel();
});

function syncFromRGB() {
  currentR = parseInt(sliderR.value);
  currentG = parseInt(sliderG.value);
  currentB = parseInt(sliderB.value);
  numR.value = currentR;
  numG.value = currentG;
  numB.value = currentB;
  const hex = rgbToHex(currentR,currentG,currentB);
  hexInput.value = hex;
  colorPreview.style.background = `${hex}`;
  updateSliderTracks();
}

function syncFromHex(hex) {
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return;
  currentR = r;
  currentG = g;
  currentB = b;
  sliderR.value = r;
  sliderG.value = g;
  sliderB.value = b;
  numR.value = r;
  numG.value = g;
  numB.value = b;
  colorPreview.style.background = `#${hex}`;
  updateSliderTracks();
}

function applyHex(hex, updateHexInput = true) {
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length !== 6) return;
  syncFromHex(hex);
  if (updateHexInput) hexInput.value = hex;
}

function rgbToHex(r,g,b) {
  return [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
}

function updateSliderTracks() {
  sliderR.style.setProperty("--val", `${(currentR/255)*100}%`);
  sliderG.style.setProperty("--val", `${(currentG/255)*100}%`);
  sliderB.style.setProperty("--val", `${(currentB/255)*100}%`);
}

[sliderR,sliderG,sliderB].forEach(s => s.addEventListener("input", syncFromRGB));
[[numR,sliderR],[numG,sliderG],[numB,sliderB]].forEach(([num,slider]) => {
  num.addEventListener("input", () => {
    let v = Math.max(0, Math.min(255, parseInt(num.value)||0));
    num.value = v; slider.value = v; syncFromRGB();
  });
});
hexInput.addEventListener("input", () => {
  const hex = hexInput.value.replace(/[^0-9a-fA-F]/g,"");
  hexInput.value = hex;
  if (hex.length===6) applyHex(hex, false);
});
colorApplyBtn.addEventListener("click", () => {
  const hex = `#${rgbToHex(currentR,currentG,currentB)}`;
  quill.format(colorTarget, hex);
  if (colorTarget==="color") textColorIndicator.setAttribute("fill", hex);
  else bgColorIndicator.setAttribute("fill", hex);
  closeColorPanel();
});

updateSliderTracks();
syncFromRGB();

// 폰트 추가 — CSS 주입(fonts.js) + Quill 등록 + 툴바 picker 업데이트
function applyCustomFont(fontData) {
  const { label, cssName } = fontData;

  injectFontCSS(fontData);

  // Quill 1.x Toolbar.update()는 formats["font"] 값에 맞는 <option>을 숨겨진 <select>에서 찾아
  // select.value를 갱신하고 Picker.update()가 그 selectedIndex로 라벨 data-label을 세팅함.
  // <option>이 없으면 select.value = '' → Picker가 index 0(기본)을 선택 → 항상 "기본"으로 표시됨.
  const fontSelect = document.querySelector("select.ql-font");
  if (fontSelect && !fontSelect.querySelector(`option[value="${cssName}"]`)) {
    const opt = document.createElement("option");
    opt.value = cssName;
    opt.textContent = label;
    fontSelect.appendChild(opt);
  }

  const fontFormat = Quill.import("formats/font");
  if (!fontFormat.whitelist.includes(cssName)) {
    fontFormat.whitelist.push(cssName);
    Quill.register(fontFormat, true);
  }

  // Quill Picker는 각 item에 개별 click 핸들러를 붙임 (이벤트 위임 아님)
  // 동적으로 추가할 때도 동일하게 핸들러를 직접 붙여야 선택이 동작함
  const fontPicker = document.querySelector(".ql-picker.ql-font");
  const pickerOptions = fontPicker?.querySelector(".ql-picker-options");
  if (pickerOptions && !pickerOptions.querySelector(`[data-value="${cssName}"]`)) {
    const item = document.createElement("span");
    item.className = "ql-picker-item";
    item.setAttribute("tabindex", "0");
    item.dataset.value = cssName;
    item.dataset.label = label;

    // mousedown에서 preventDefault → 에디터 selection 유지
    item.addEventListener("mousedown", (e) => e.preventDefault());
    item.addEventListener("click", () => {
      quill.format("font", cssName);
      // Quill 내장 picker의 selectItem()은 클릭 시 data-label을 라벨에 직접 세팅함.
      // 커스텀 아이템은 selectItem()을 거치지 않으므로 동일하게 직접 처리.
      pickerOptions.querySelectorAll(".ql-picker-item").forEach(i => i.classList.remove("ql-selected"));
      item.classList.add("ql-selected");
      const pickerLabel = fontPicker.querySelector(".ql-picker-label");
      if (pickerLabel) pickerLabel.setAttribute("data-label", label);
      fontPicker.classList.remove("ql-expanded");
    });

    pickerOptions.appendChild(item);
  }
}

// Firestore에서 저장된 폰트 불러오기
loadFonts(applyCustomFont);

// 라벨에서 cssName 자동 생성
// 한글 폰트명도 처리 — 영문이 없으면 순번 사용
function makeCssName(label) {
  const slug = label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (slug) return slug;
  return "font-" + Date.now();
}

// @font-face CSS에서 font-family 값 추출
function extractFontFamily(css) {
  const match = css.match(/font-family\s*:\s*['"]?([^'";,\n]+?)['"]?\s*;/i);
  return match ? match[1].trim() : null;
}

// Google Fonts URL(또는 @import 구문)에서 font-family 이름 추출
// 예: https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400 → "Noto Sans KR"
// 예: @import url('https://...?family=Noto+Sans+KR') → "Noto Sans KR"
function extractFontFamilyFromUrl(input) {
  const urlMatch = input.match(/https?:\/\/[^\s'")\n]+/);
  if (!urlMatch) return null;
  try {
    const u = new URL(urlMatch[0]);
    const family = u.searchParams.get("family");
    if (family) return family.split(":")[0].split(",")[0].replace(/\+/g, " ").trim();
  } catch {}
  return null;
}

  

// ── 탭 전환 ──
let currentFontTab = "google";
const fontTabBtns  = document.querySelectorAll(".font-tab");
const fontTabGoogle  = document.getElementById("font-tab-google");
const fontTabWebfont = document.getElementById("font-tab-webfont");
const fontLabelWebfont = document.getElementById("font-label-webfont");
const fontFaceInput    = document.getElementById("font-face-input");

fontTabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFontTab = btn.dataset.tab;
    fontTabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    fontTabGoogle.style.display  = currentFontTab === "google"  ? "block" : "none";
    fontTabWebfont.style.display = currentFontTab === "webfont" ? "block" : "none";
  });
});

// ── 모달 열기/닫기 ──
addFontBtn.addEventListener("click", () => {
  fontLabelInput.value = ""; fontUrlInput.value = "";
  fontLabelWebfont.value = ""; fontFaceInput.value = "";
  // 탭 초기화
  currentFontTab = "google";
  fontTabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === "google"));
  fontTabGoogle.style.display = "block"; fontTabWebfont.style.display = "none";
  fontModal.classList.add("active");
});

[fontModalClose, fontModalCancel].forEach(btn =>
  btn.addEventListener("click", () => fontModal.classList.remove("active"))
);
fontModal.addEventListener("click", (e) => { if (e.target === fontModal) fontModal.classList.remove("active"); });

// ── 추가 확인 ──
fontModalConfirm.addEventListener("click", async () => {
  fontModalConfirm.disabled = true;
  try {
    if (currentFontTab === "google") {
      const label = fontLabelInput.value.trim();
      const url   = fontUrlInput.value.trim();
      if (!label) return showToast("폰트 이름을 입력해주세요.", true);
      if (!url)   return showToast("Google Fonts URL을 입력해주세요.", true);
      const cssName = makeCssName(label);
      const fontFamily = extractFontFamilyFromUrl(url) || label;
      const fontData = { type: "google", label, cssName, fontFamily, url };
      applyCustomFont(fontData);
      await saveFont(fontData);
      fontModal.classList.remove("active");
      showToast(`'${label}' 폰트가 추가됐어요 ✓`);

    } else {
      const label       = fontLabelWebfont.value.trim();
      const fontFaceCSS = fontFaceInput.value.trim();
      if (!label)       return showToast("폰트 이름을 입력해주세요.", true);
      if (!fontFaceCSS) return showToast("@font-face 코드를 붙여넣어 주세요.", true);
      if (!fontFaceCSS.includes("@font-face") && !fontFaceCSS.includes("@import")) {
        return showToast("올바른 @font-face 또는 @import 코드를 입력해주세요.", true);
      }
      const cssName = makeCssName(label);
      const fontFamily = extractFontFamily(fontFaceCSS) || label;
      const fontData = { type: "webfont", label, cssName, fontFamily, fontFaceCSS };
      applyCustomFont(fontData);
      await saveFont(fontData);
      fontModal.classList.remove("active");
      showToast(`'${label}' 폰트가 추가됐어요 ✓`);
    }
  } catch (err) {
    showToast("폰트 저장 실패: " + err.message, true);
  } finally {
    fontModalConfirm.disabled = false;
  }
});







let toastTimer;
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2500);
}