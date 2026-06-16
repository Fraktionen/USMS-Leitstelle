import { db, ADMIN_IDS, getDiscordUser, discordLoginURL } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
const KAT_ICONS = { info: "ℹ️", wichtig: "⚠️", event: "🎯", änderung: "📝" };
const KAT_COLORS = { info: "#0c2340", wichtig: "#2a1a04", event: "#0c2818", änderung: "#1e1535" };
const KAT_BORDER = { info: "#1e4a8f", wichtig: "#92400e", event: "#166534", änderung: "#5b21b6" };

function isAdmin() { return currentUser && ADMIN_IDS.includes(currentUser.id); }

document.getElementById("discordBtn").addEventListener("click", () => {
  if (currentUser) { currentUser = null; sessionStorage.removeItem("discord_token"); updateUI(); return; }
  window.location.href = discordLoginURL();
});

const token = sessionStorage.getItem("discord_token");
if (token) getDiscordUser(token).then(u => { currentUser = u; updateUI(); }).catch(() => sessionStorage.removeItem("discord_token"));

function updateUI() {
  const dot = document.getElementById("loginDot");
  const text = document.getElementById("loginText");
  const btn = document.getElementById("discordBtn");
  const toolbar = document.getElementById("sbToolbar");
  if (currentUser) {
    dot.classList.remove("off");
    text.textContent = `Eingeloggt: ${currentUser.username}`;
    btn.textContent = "Ausloggen";
    if (isAdmin()) toolbar.classList.remove("hidden");
  } else {
    dot.classList.add("off");
    text.textContent = "Nicht eingeloggt";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Mit Discord einloggen`;
    toolbar.classList.add("hidden");
  }
}

onSnapshot(query(collection(db, "announcements"), orderBy("timestamp", "desc")), (snap) => {
  const list = document.getElementById("sbList");
  if (snap.empty) {
    list.innerHTML = `<div class="sb-empty">📌 Noch keine Ankündigungen</div>`;
    return;
  }
  list.innerHTML = snap.docs.map(d => {
    const a = d.data();
    const kat = a.kategorie || "info";
    return `<div class="sb-card" style="border-left-color:${KAT_BORDER[kat]};background:${KAT_COLORS[kat]}">
      <div class="sb-card-header">
        <div class="sb-card-title">${KAT_ICONS[kat]} ${a.titel}</div>
        <div class="sb-card-meta">
          <span>${a.adminName}</span>
          <span>${a.timestampLocal || ""}</span>
          ${isAdmin() ? `<button class="del-btn" onclick="deleteSB('${d.id}')">🗑️</button>` : ""}
        </div>
      </div>
      <div class="sb-card-content">${a.inhalt.replace(/\n/g,"<br>")}</div>
    </div>`;
  }).join("");
});

window.openSBModal = () => document.getElementById("sbModal").classList.remove("hidden");
window.closeSBModal = () => document.getElementById("sbModal").classList.add("hidden");

window.saveSB = async () => {
  if (!isAdmin()) return;
  const titel = document.getElementById("sbTitle").value.trim();
  const inhalt = document.getElementById("sbContent").value.trim();
  const kategorie = document.getElementById("sbKat").value;
  if (!titel || !inhalt) { alert("Titel und Inhalt ausfüllen!"); return; }
  await addDoc(collection(db, "announcements"), {
    titel, inhalt, kategorie,
    adminName: currentUser.username,
    adminId: currentUser.id,
    timestamp: serverTimestamp(),
    timestampLocal: new Date().toLocaleString("de-DE", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" })
  });
  document.getElementById("sbTitle").value = "";
  document.getElementById("sbContent").value = "";
  closeSBModal();
};

window.deleteSB = async (id) => {
  if (!isAdmin() || !confirm("Ankündigung löschen?")) return;
  await deleteDoc(doc(db, "announcements", id));
};

updateUI();