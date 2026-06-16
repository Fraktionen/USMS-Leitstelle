import { db, ADMIN_IDS, AUSBILDUNGEN, WEITERBILDUNGEN, getDiscordUser, discordLoginURL } from "./firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let employees = {};

const RANK_CLS = {
  "Director Of USMS":"director","Assistant Director of USMS":"director",
  "Chief Of Staff":"chief","Assistant Chief of Staff":"chief","Supervisory U.S. Marshal":"chief",
  "Captain First Class":"captain","Captain":"captain",
  "Sergeant First Class":"sergeant","Sergeant":"sergeant",
  "Corporal":"corporal",
  "Deputy First Class Marshal":"deputy","Deputy Marshal":"deputy",
  "Rekrut Marshal":"rekrut"
};

document.getElementById("discordBtn").addEventListener("click", () => {
  if (currentUser) { currentUser = null; sessionStorage.removeItem("discord_token"); updateUI(); return; }
  window.location.href = discordLoginURL();
});

const token = sessionStorage.getItem("discord_token");
if (token) {
  getDiscordUser(token).then(u => { currentUser = u; updateUI(); }).catch(() => { sessionStorage.removeItem("discord_token"); updateUI(); });
} else { updateUI(); }

onSnapshot(collection(db, "employees"), (snap) => {
  employees = {};
  snap.forEach(d => { employees[parseInt(d.id)] = d.data(); });
  if (currentUser) renderProfil();
});

function updateUI() {
  const dot = document.getElementById("loginDot");
  const text = document.getElementById("loginText");
  const btn = document.getElementById("discordBtn");
  if (currentUser) {
    dot.classList.remove("off");
    text.textContent = `Eingeloggt: ${currentUser.username}`;
    btn.textContent = "Ausloggen";
    renderProfil();
  } else {
    dot.classList.add("off");
    text.textContent = "Nicht eingeloggt";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Mit Discord einloggen`;
    document.getElementById("profilLoading").classList.remove("hidden");
    document.getElementById("profilCard").classList.add("hidden");
    document.getElementById("profilNotFound").classList.add("hidden");
  }
}

function renderProfil() {
  if (!currentUser) return;
  const emp = Object.entries(employees).find(([, e]) => e.discordId === currentUser.id);
  if (!emp) {
    document.getElementById("profilLoading").classList.add("hidden");
    document.getElementById("profilCard").classList.add("hidden");
    document.getElementById("profilNotFound").classList.remove("hidden");
    return;
  }
  const [dn, data] = emp;
  const cls = RANK_CLS[data.rank] || "rekrut";
  const avatarUrl = currentUser.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  document.getElementById("profilAvatar").src = avatarUrl;
  document.getElementById("profilName").textContent = data.name;
  document.getElementById("profilTag").textContent = `@${currentUser.username}`;
  document.getElementById("profilRankBadge").textContent = data.rank;
  document.getElementById("profilRankBadge").className = `rank-badge ${cls}`;
  document.getElementById("profilDNBadge").textContent = `DN ${String(dn).padStart(2,"0")}`;
  document.getElementById("profilDate").textContent = data.date || "—";
  document.getElementById("profilDN").textContent = String(dn).padStart(2,"0");
  document.getElementById("profilRank").textContent = data.rank;
  document.getElementById("profilDiscordId").textContent = currentUser.id;

  const ausb = data.ausbildungen || {};
  const wb = data.weiterbildungen || {};

  document.getElementById("profilAusb").innerHTML = AUSBILDUNGEN.map(a => `
    <div class="profil-ausb-item ${ausb[a.id] ? 'done' : 'todo'}">
      <span class="profil-check">${ausb[a.id] ? "✓" : "○"}</span>
      <span>${a.label}</span>
    </div>`).join("");

  document.getElementById("profilWB").innerHTML = WEITERBILDUNGEN.map(w => `
    <div class="profil-ausb-item ${wb[w.id] ? 'done' : 'todo'}">
      <span class="profil-check">${wb[w.id] ? "✓" : "○"}</span>
      <span>${w.label}</span>
    </div>`).join("");

  document.getElementById("profilLoading").classList.add("hidden");
  document.getElementById("profilNotFound").classList.add("hidden");
  document.getElementById("profilCard").classList.remove("hidden");
}

updateUI();