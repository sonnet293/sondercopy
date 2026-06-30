// js/guestbook.js
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
const messageList = document.getElementById("messages-list");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const toast = document.getElementById("toast");

const replyModal = document.getElementById("reply-modal");
const modalClose = document.getElementById("modal-close");
const modalCancel = document.getElementById("modal-cancel");
const modalSend = document.getElementById("modal-send");
const modalQuote = document.getElementById("modal-quote");
const replyInput = document.getElementById("reply-input");

let currentUser = null;
let isOwner = false;
let replyTarget = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isOwner = user?.uid === OWNER_UID;
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = messageInput.value.trim();
  const name = nameInput.value.trim() || 'Guest';

  if (!text) { showToast('메시지를 입력해주세요.', true); return; }

  sendBtn.disabled = true;

  try {
    await addDoc(collection(db, 'guestbook'), {
      name,
      message: text,
      uid: currentUser?.uid || null,
      isOwner: isOwner,
      reply: null,
      timestamp: serverTimestamp()
    });

    messageInput.value = '';
    nameInput.value = '';
  } catch (e) {
    showToast('전송 실패: ' + e.message, true);
  } finally {
    sendBtn.disabled = false;
  }
}

const q = query(collection(db, 'guestbook'), orderBy('timestamp', 'desc'));

onSnapshot(q, snapshot => {
  loadingState.style.display = 'none';

  if (snapshot.empty) {
    emptyState.style.display = 'flex';
    messageList.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';

  const existingIds = new Set(
    [...messageList.querySelectorAll('[data-id]')].map(el => el.dataset.id)
  );

  snapshot.docChanges().forEach(change => {
    const docId = change.doc.id;
    const data = change.doc.data();

    if (change.type === 'added' && !existingIds.has(docId)) {
      const el = createMessageEl(docId, data);
      const ref = messageList.children[change.newIndex] || null;
      messageList.insertBefore(el, ref);
      scrollToTop();
    }

    if (change.type === 'modified') {
      const existing = messageList.querySelector(`[data-id="${docId}"]`);
      if (existing) existing.replaceWith(createMessageEl(docId, data));
    }

    if (change.type === 'removed') {
      const existing = messageList.querySelector(`[data-id="${docId}"]`);
      if (existing) {
        existing.style.cssText += 'opacity:0;transform:translateY(-4px);transition:0.2s ease';
        setTimeout(() => existing.remove(), 200);
      }
    }
  });
});

function createMessageEl(docId, data) {
  const isOwnerMsg = data.isOwner === true || data.uid === OWNER_UID;
  const group = document.createElement('div');
  group.className = `msg-group ${isOwnerMsg ? 'msg-group--owner' : 'msg-group--guest'}`;
  group.dataset.id = docId;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  if (isOwnerMsg) {
    const badge = document.createElement('span');
    badge.className = 'msg-badge';
    badge.textContent = 'OWNER';
    meta.appendChild(badge);
  }
  const nameEl = document.createElement('span');
  nameEl.className = 'msg-name';
  nameEl.textContent = data.name || 'Guest';
  meta.appendChild(nameEl);

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = data.message;

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(data.timestamp);

  group.appendChild(meta);
  group.appendChild(bubble);
  group.appendChild(time);

  // OWNER 권한
  if (isOwner) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    if (!isOwnerMsg) {
      const replyBtn = document.createElement('button');
      replyBtn.className = 'action-btn';
      replyBtn.textContent = '답장';
      replyBtn.addEventListener('click', () => openReplyModal(docId, data));
      actions.appendChild(replyBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', () => deleteMessage(docId));
    actions.appendChild(deleteBtn);
    group.appendChild(actions);
  }

  // 답장
  if (data.reply) {
    const replyGroup = document.createElement('div');
    replyGroup.className = 'msg-reply-group';

    const connector = document.createElement('div');
    connector.className = 'msg-reply-connector';

    const replyWrapper = document.createElement('div');
    replyWrapper.className = 'msg-group msg-group--owner';

    const replyMeta = document.createElement('div');
    replyMeta.className = 'msg-meta';
    const replyBadge = document.createElement('span');
    replyBadge.className = 'msg-badge';
    replyBadge.textContent = 'OWNER';
    const replyName = document.createElement('span');
    replyName.className = 'msg-name';
    replyName.textContent = data.reply.name || '린';
    replyMeta.appendChild(replyBadge);
    replyMeta.appendChild(replyName);

    const replyBubble = document.createElement('div');
    replyBubble.className = 'msg-bubble';
    replyBubble.textContent = data.reply.message;

    const replyTime = document.createElement('div');
    replyTime.className = 'msg-time';
    replyTime.textContent = formatTime(data.reply.timestamp);

    replyWrapper.appendChild(replyMeta);
    replyWrapper.appendChild(replyBubble);
    replyWrapper.appendChild(replyTime);

    if (isOwner) {
      const replyActions = document.createElement('div');
      replyActions.className = 'msg-actions';
      const delReplyBtn = document.createElement('button');
      delReplyBtn.className = 'action-btn action-btn--delete';
      delReplyBtn.textContent = '삭제';
      delReplyBtn.addEventListener('click', () => deleteReply(docId));
      replyActions.appendChild(delReplyBtn);
      replyWrapper.appendChild(replyActions);
    }

    replyGroup.appendChild(connector);
    replyGroup.appendChild(replyWrapper);
    group.appendChild(replyGroup);
  }

  return group;
}

// 모달
function openReplyModal(docId, data) {
  replyTarget = { docId, message: data.message, name: data.name || 'Guest' };
  modalQuote.textContent = `${replyTarget.name}: ${replyTarget.message}`;
  replyInput.value = '';
  replyModal.style.display = 'flex';
  setTimeout(() => replyInput.focus(), 100);
}

function closeReplyModal() {
  replyModal.style.display = 'none';
  replyTarget = null;
}

modalClose.addEventListener('click', closeReplyModal);
modalCancel.addEventListener('click', closeReplyModal);

modalSend.addEventListener('click', async () => {
  const text = replyInput.value.trim();
  if (!text) { showToast('답장을 입력해주세요.', true); return; }
  if (!replyTarget) return;

  modalSend.disabled = true;

  try {
    await updateDoc(doc(db, 'guestbook', replyTarget.docId), {
      reply: {
        message: text,
        name: '린',
        timestamp: new Date().toISOString()
      }
    });
    closeReplyModal();
  } catch (e) {
    showToast('전송 실패: ' + e.message, true);
  } finally {
    modalSend.disabled = false;
  }
});

async function deleteMessage(docId) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await deleteDoc(doc(db, 'guestbook', docId));
  } catch (e) {
    showToast('삭제 실패: ' + e.message, true);
  }
}

async function deleteReply(docId) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await updateDoc(doc(db, 'guestbook', docId), { reply: null });
  } catch (e) {
    showToast('삭제 실패: ' + e.message, true);
  }
}

function scrollToTop() {
  const chatContainer = document.getElementById('chat-container');
  chatContainer.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatTime(ts) {
  if (!ts) return '';
  let date;
  if (ts?.toDate) date = ts.toDate();
  else if (typeof ts === 'string') date = new Date(ts);
  else return '';

  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

// 토스트
let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = 'toast show' + (isError ? ' toast--error' : '');
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2500);
}