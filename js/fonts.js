// js/fonts.js — 공유 폰트 유틸 (write.js / backup.js 양쪽에서 사용)
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// url/fontFaceCSS 중 실제 CSS 코드인지 판별
function isCSSCode(str) {
  return str && (str.includes("@font-face") || str.includes("@import"));
}

// 폰트 CSS를 <head>에 주입 (어느 페이지에서나 호출 가능)
export function injectFontCSS({ label, cssName, url, fontFaceCSS, fontFamily, type }) {
  // type이 잘못 저장됐더라도 url 필드에 CSS 코드가 들어온 경우 방어 처리
  const cssContent = fontFaceCSS || (isCSSCode(url) ? url : null);
  const isWebfont = type === "webfont" || !!cssContent;

  if (isWebfont) {
    if (!document.querySelector(`style[data-font-face="${cssName}"]`)) {
      const style = document.createElement("style");
      style.dataset.fontFace = cssName;
      style.textContent = cssContent;
      document.head.appendChild(style);
    }
  } else if (url) {
    if (!document.querySelector(`link[data-font="${cssName}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.font = cssName;
      document.head.appendChild(link);
    }
  }

  if (!document.querySelector(`style[data-font-style="${cssName}"]`)) {
    // webfont는 @font-face에서 추출한 fontFamily를 사용해야 브라우저가 폰트를 찾을 수 있음
    // 없으면 label로 폴백 (Google Fonts, 기존 저장 데이터 호환)
    const familyName = fontFamily || label;
    const style = document.createElement("style");
    style.dataset.fontStyle = cssName;
    style.textContent = `.ql-font-${cssName} { font-family: '${familyName}', sans-serif !important; }`;
    document.head.appendChild(style);
  }
}

// Firestore fonts 컬렉션 전체 로드 후 CSS 주입
// onEach: 각 폰트 데이터로 추가 작업이 필요한 경우 (write.js의 Quill 등록 등)
export async function loadFonts(onEach) {
  const snap = await getDocs(collection(db, "fonts"));
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    injectFontCSS(data);
    if (onEach) onEach(data);
  });
}

// Firestore에 폰트 저장 — url 필드에 CSS 코드가 들어온 경우 자동 교정
export async function saveFont(fontData) {
  let data = { ...fontData };
  if (isCSSCode(data.url)) {
    data = { label: data.label, cssName: data.cssName, type: "webfont", fontFaceCSS: data.url };
  }
  await setDoc(doc(db, "fonts", data.cssName), data);
}
