import { db, ADMIN_IDS, AUSBILDUNGEN, WEITERBILDUNGEN, getDiscordUser, discordLoginURL } from "./firebase-config.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let employees = {};
let akteDN = null;

const RANK_CLS = {
  "Director Of USMS":"director","Assistant Director of USMS":"director",
  "Chief Of Staff":"chief","Assistant Chief of Staff":"chief","Supervisory U.S. Marshal":"chief",
  "Captain First Class":"captain","Captain":"captain",
  "Lieutenant First Class":"lieutenant","Lieutenant":"lieutenant",
  "Sergeant First Class":"sergeant","Sergeant":"sergeant",
  "Corporal":"corporal",
  "Deputy First Class Marshal":"deputy","Deputy Marshal":"deputy",
  "Rekrut Marshal":"rekrut"
};

const STATUS_COLORS = {
  aktiv: { bg: "#0c2818", border: "#166534", color: "#4ade80", label: "Aktiv" },
  inaktiv: { bg: "#1a1505", border: "#854d0e", color: "#fbbf24", label: "Inaktiv" },
  suspendiert: { bg: "#250f0f", border: "#991b1b", color: "#f87171", label: "Suspendiert" },
  beurlaubt: { bg: "#0c2340", border: "#1e4a8f", color: "#60a5fa", label: "Beurlaubt" },
};

function isAdmin() { return currentUser && ADMIN_IDS.includes(currentUser.id); }

// ── DISCORD ──────────────────────────────────────────────────
document.getElementById("discordBtn").addEventListener("click", () => {
  if (currentUser) { currentUser = null; sessionStorage.removeItem("discord_token"); updateUI(); return; }
  window.location.href = discordLoginURL();
});
const token = sessionStorage.getItem("discord_token");
if (token) getDiscordUser(token).then(u => { currentUser = u; updateUI(); }).catch(() => { sessionStorage.removeItem("discord_token"); updateUI(); });
else updateUI();

function updateUI() {
  const dot = document.getElementById("loginDot");
  const text = document.getElementById("loginText");
  const btn = document.getElementById("discordBtn");
  if (currentUser) {
    dot.classList.remove("off");
    text.textContent = `Eingeloggt: ${currentUser.username}${isAdmin() ? " ✓ Admin" : ""}`;
    btn.textContent = "Ausloggen";
    if (isAdmin()) {
      document.getElementById("noAccess").classList.add("hidden");
      document.getElementById("aktenWrap").classList.remove("hidden");
    } else {
      document.getElementById("noAccess").classList.remove("hidden");
      document.getElementById("aktenWrap").classList.add("hidden");
    }
  } else {
    dot.classList.add("off");
    text.textContent = "Nicht eingeloggt";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Mit Discord einloggen`;
    document.getElementById("noAccess").classList.remove("hidden");
    document.getElementById("aktenWrap").classList.add("hidden");
  }
}

// ── FIREBASE ─────────────────────────────────────────────────
onSnapshot(collection(db, "employees"), (snap) => {
  employees = {};
  snap.forEach(d => { employees[parseInt(d.id)] = d.data(); });
  renderAkten();
  updateStats();
});

async function writeLog(action, details) {
  if (!currentUser) return;
  await addDoc(collection(db, "logs"), {
    action, details, adminName: currentUser.username, adminId: currentUser.id,
    timestamp: serverTimestamp(),
    timestampLocal: new Date().toLocaleString("de-DE", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})
  });
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
  const list = Object.values(employees);
  document.getElementById("hAktiv").textContent = list.filter(e => !e.status || e.status === "aktiv").length;
  document.getElementById("hInaktiv").textContent = list.filter(e => e.status === "inaktiv").length;
  document.getElementById("hSuspendiert").textContent = list.filter(e => e.status === "suspendiert").length;
}

// ── AKTEN GRID ────────────────────────────────────────────────
function renderAkten() {
  const search = document.getElementById("aktenSearch").value.toLowerCase();
  const statusF = document.getElementById("statusFilter").value;
  const grid = document.getElementById("aktenGrid");

  const entries = Object.entries(employees)
    .filter(([dn, emp]) => {
      if (search && !emp.name.toLowerCase().includes(search) && !String(dn).includes(search)) return false;
      const s = emp.status || "aktiv";
      if (statusF && s !== statusF) return false;
      return true;
    })
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  if (!entries.length) {
    grid.innerHTML = `<div style="text-align:center;color:var(--text3);padding:48px;grid-column:1/-1">Keine Einträge gefunden</div>`;
    return;
  }

  grid.innerHTML = entries.map(([dn, emp]) => {
    const status = emp.status || "aktiv";
    const sc = STATUS_COLORS[status] || STATUS_COLORS.aktiv;
    const cls = RANK_CLS[emp.rank] || "rekrut";
    const notizCount = (emp.notizen || []).length;
    const ausbCount = Object.values(emp.ausbildungen || {}).filter(Boolean).length;
    const wbCount = Object.values(emp.weiterbildungen || {}).filter(Boolean).length;
    return `
      <div class="akte-card" onclick="openAkte(${dn})">
        <div class="akte-card-top">
          <span class="dn-badge">${String(dn).padStart(2,"0")}</span>
          <span class="status-pill-small" style="background:${sc.bg};border-color:${sc.border};color:${sc.color}">${sc.label}</span>
        </div>
        <div class="akte-card-name">${emp.name}</div>
        <div style="margin:6px 0"><span class="rank-badge ${cls}" style="font-size:11px">${emp.rank}</span></div>
        <div class="akte-card-meta">
          <span>📅 ${emp.date || "—"}</span>
          <span>🎓 ${ausbCount} Ausb.</span>
          <span>📈 ${wbCount} WB</span>
          ${notizCount ? `<span>🗒️ ${notizCount} Notizen</span>` : ""}
        </div>
      </div>`;
  }).join("");
}

document.getElementById("aktenSearch").addEventListener("input", renderAkten);
document.getElementById("statusFilter").addEventListener("change", renderAkten);

// ── AKTE ÖFFNEN ───────────────────────────────────────────────
window.openAkte = function(dn) {
  akteDN = dn;
  const emp = employees[dn];
  if (!emp) return;

  document.getElementById("akteTitle").textContent = `🗂️ ${emp.name} — DN ${String(dn).padStart(2,"00")}`;

  // Status Buttons highlighten
  const status = emp.status || "aktiv";
  document.querySelectorAll(".status-btn").forEach(b => b.classList.remove("active-status"));
  document.querySelector(`.status-btn.${status}`)?.classList.add("active-status");

  // Info
  document.getElementById("akteInfo").innerHTML = `
    <div class="akte-info-box"><div class="akte-info-label">Dienstnummer</div><div class="akte-info-val">DN ${String(dn).padStart(2,"00")}</div></div>
    <div class="akte-info-box"><div class="akte-info-label">Rang</div><div class="akte-info-val">${emp.rank}</div></div>
    <div class="akte-info-box"><div class="akte-info-label">Eingestellt am</div><div class="akte-info-val">${emp.date || "—"}</div></div>
    <div class="akte-info-box"><div class="akte-info-label">Status</div><div class="akte-info-val" style="color:${STATUS_COLORS[status]?.color}">${STATUS_COLORS[status]?.label || "Aktiv"}</div></div>
    <div class="akte-info-box"><div class="akte-info-label">Discord ID</div><div class="akte-info-val">${emp.discordId || "—"}</div></div>
  `;

  // Ausbildungen
  const ausb = emp.ausbildungen || {};
  const wb = emp.weiterbildungen || {};
  const ausbDone = AUSBILDUNGEN.filter(a => ausb[a.id]);
  const ausbTodo = AUSBILDUNGEN.filter(a => !ausb[a.id]);
  const wbDone = WEITERBILDUNGEN.filter(w => wb[w.id]);

  document.getElementById("akteAusb").innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${ausbDone.map(a => `<span class="ausb-badge">✓ ${a.label}</span>`).join("")}
      ${ausbTodo.map(a => `<span style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);font-size:10px;padding:2px 7px;border-radius:3px;letter-spacing:0.04em">○ ${a.label}</span>`).join("")}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${WEITERBILDUNGEN.map(w => `<span class="${wb[w.id] ? 'wb-badge' : ''}" style="${!wb[w.id] ? 'background:var(--bg3);border:1px solid var(--border);color:var(--text3);font-size:10px;padding:2px 7px;border-radius:3px' : ''}">${wb[w.id] ? "✓" : "○"} ${w.label}</span>`).join("")}
    </div>
  `;

  // Notizen
  renderAkteNotizen(emp.notizen || []);
  document.getElementById("akteNotizInput").value = "";
  document.getElementById("akteModal").classList.remove("hidden");
};

function renderAkteNotizen(notizen) {
  const el = document.getElementById("akteNotizen");
  if (!notizen.length) { el.innerHTML = `<div style="color:var(--text3);font-size:13px">Noch keine Notizen</div>`; return; }
  el.innerHTML = notizen.map((n, i) => `
    <div class="notiz-item">
      <div class="notiz-meta">${n.adminName} · ${n.date}</div>
      <div class="notiz-text">${n.text}</div>
      <button class="del-btn" style="margin-top:6px;font-size:11px;padding:3px 8px" onclick="deleteAkteNotiz(${i})">🗑️</button>
    </div>`).join("");
}

window.closeAkteModal = function() {
  document.getElementById("akteModal").classList.add("hidden");
};

window.setStatus = async function(status) {
  if (!isAdmin() || !akteDN) return;
  const emp = employees[akteDN];
  const old = emp.status || "aktiv";
  if (old === status) return;
  await setDoc(doc(db, "employees", String(akteDN)), { ...emp, status });
  await writeLog("STATUS", `DN ${String(akteDN).padStart(2,"00")} — ${emp.name}: Status "${STATUS_COLORS[old]?.label}" → "${STATUS_COLORS[status]?.label}"`);
  document.querySelectorAll(".status-btn").forEach(b => b.classList.remove("active-status"));
  document.querySelector(`.status-btn.${status}`)?.classList.add("active-status");
  document.querySelector(`#akteInfo .akte-info-box:nth-child(4) .akte-info-val`).textContent = STATUS_COLORS[status]?.label;
  document.querySelector(`#akteInfo .akte-info-box:nth-child(4) .akte-info-val`).style.color = STATUS_COLORS[status]?.color;
};

window.saveAkteNotiz = async function() {
  if (!isAdmin() || !akteDN) return;
  const text = document.getElementById("akteNotizInput").value.trim();
  if (!text) return;
  const emp = employees[akteDN];
  const notizen = [...(emp.notizen || []), {
    text, adminName: currentUser.username,
    date: new Date().toLocaleString("de-DE", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
  }];
  await setDoc(doc(db, "employees", String(akteDN)), { ...emp, notizen });
  await writeLog("NOTIZ", `DN ${String(akteDN).padStart(2,"00")} — ${emp.name}: Notiz hinzugefügt`);
  document.getElementById("akteNotizInput").value = "";
  renderAkteNotizen(notizen);
};

window.deleteAkteNotiz = async function(idx) {
  if (!isAdmin() || !akteDN) return;
  const emp = employees[akteDN];
  const notizen = (emp.notizen || []).filter((_, i) => i !== idx);
  await setDoc(doc(db, "employees", String(akteDN)), { ...emp, notizen });
  renderAkteNotizen(notizen);
};

// ── LÖSCHEN MIT GRUND ─────────────────────────────────────────
window.openDeleteModal = function() {
  document.getElementById("deleteReason").value = "";
  document.getElementById("deleteModal").classList.remove("hidden");
};
window.closeDeleteModal = function() {
  document.getElementById("deleteModal").classList.add("hidden");
};
window.confirmDelete = async function() {
  const reason = document.getElementById("deleteReason").value.trim();
  if (!reason) { alert("Bitte einen Grund angeben!"); return; }
  if (!akteDN) return;
  const emp = employees[akteDN];
  await writeLog("ENTLASSEN", `DN ${String(akteDN).padStart(2,"00")} — ${emp.name} (${emp.rank}) entlassen. Grund: ${reason}`);
  await deleteDoc(doc(db, "employees", String(akteDN)));
  closeDeleteModal();
  closeAkteModal();
};

// ── ZEUGNIS PDF ───────────────────────────────────────────────
window.exportZeugnis = function() {
  if (!akteDN) return;
  const emp = employees[akteDN];
  const dn = String(akteDN).padStart(2, "00");
  const ausb = emp.ausbildungen || {};
  const wb = emp.weiterbildungen || {};
  const status = emp.status || "aktiv";
  const sc = STATUS_COLORS[status];
  const now = new Date().toLocaleDateString("de-DE", {day:"2-digit",month:"2-digit",year:"numeric"});

  const ausbRows = AUSBILDUNGEN.map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaf0">${a.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaf0;text-align:center">
        ${ausb[a.id]
          ? '<span style="color:#166534;font-weight:700;font-size:16px">✓</span>'
          : '<span style="color:#9ca3af">○</span>'}
      </td>
    </tr>`).join("");

  const wbRows = WEITERBILDUNGEN.map(w => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaf0">${w.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8eaf0;text-align:center">
        ${wb[w.id]
          ? '<span style="color:#166534;font-weight:700;font-size:16px">✓</span>'
          : '<span style="color:#9ca3af">○</span>'}
      </td>
    </tr>`).join("");

  const notizRows = (emp.notizen || []).map(n => `
    <div style="background:#f8fafc;border-left:3px solid #1d4ed8;padding:10px 14px;border-radius:4px;margin-bottom:8px">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">${n.adminName} · ${n.date}</div>
      <div style="font-size:13px;color:#1e293b">${n.text}</div>
    </div>`).join("") || '<p style="color:#9ca3af;font-size:13px">Keine Notizen</p>';

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>USMS Zeugnis — ${emp.name}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family: Arial, sans-serif; background: #fff; color: #1e293b; }
  .page { max-width: 794px; margin: 0 auto; padding: 48px; }
  .header { background: linear-gradient(135deg, #0a1628 0%, #1d4ed8 50%, #c9a84c 100%); padding: 40px 48px; color: white; display: flex; align-items: center; gap: 28px; }
  .logo-circle { width: 90px; height: 90px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 3px solid rgba(201,168,76,0.8); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #c9a84c; flex-shrink:0; }
  .header-text h1 { font-size: 28px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
  .header-text p { font-size: 13px; opacity: 0.8; letter-spacing: 1px; }
  .doc-title { background: #1d4ed8; color: white; text-align: center; padding: 14px; font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; }
  .body { padding: 36px 0; }
  .name-block { text-align: center; padding: 28px; background: linear-gradient(135deg, #f0f4ff, #fefdf0); border: 2px solid #c9a84c; border-radius: 12px; margin-bottom: 32px; }
  .name-block .dn { font-size: 13px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .name-block .name { font-size: 36px; font-weight: 900; color: #0a1628; letter-spacing: 1px; margin-bottom: 8px; }
  .name-block .rank { font-size: 16px; color: #1d4ed8; font-weight: 600; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #1d4ed8; padding-bottom: 6px; margin-bottom: 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
  .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-val { font-size: 15px; font-weight: 600; color: #1e293b; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead { background: #0a1628; color: white; }
  thead th { padding: 10px 12px; text-align: left; font-weight: 600; letter-spacing: 1px; }
  .gold-line { height: 3px; background: linear-gradient(90deg, #c9a84c, #e8c46a, #c9a84c); margin: 28px 0; }
  .footer { border-top: 2px solid #e2e8f0; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-line { width: 200px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; height: 40px; }
  .sig-label { font-size: 11px; color: #64748b; text-align: center; }
  .watermark { text-align: center; margin-top: 20px; font-size: 11px; color: #cbd5e1; letter-spacing: 2px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo-circle">USMS</div>
    <div class="header-text">
      <h1>U.S. MARSHALS SERVICE</h1>
      <p>SENORA CITY · OFFIZIELLE PERSONALAKTE</p>
    </div>
  </div>
  <div class="doc-title">DIENSTZEUGNIS</div>

  <div class="body">
    <div class="name-block">
      <div class="dn">DIENSTNUMMER ${dn}</div>
      <div class="name">${emp.name}</div>
      <div class="rank">${emp.rank}</div>
    </div>

    <div class="section">
      <div class="section-title">Dienstinformationen</div>
      <div class="info-grid">
        <div class="info-box"><div class="info-label">Vollständiger Name</div><div class="info-val">${emp.name}</div></div>
        <div class="info-box"><div class="info-label">Dienstnummer</div><div class="info-val">DN ${dn}</div></div>
        <div class="info-box"><div class="info-label">Rang</div><div class="info-val">${emp.rank}</div></div>
        <div class="info-box"><div class="info-label">Einstellungsdatum</div><div class="info-val">${emp.date || "—"}</div></div>
        <div class="info-box"><div class="info-label">Dienststatus</div><div class="info-val"><span class="status-badge" style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border}">${sc.label}</span></div></div>
        <div class="info-box"><div class="info-label">Ausgestellt am</div><div class="info-val">${now}</div></div>
      </div>
    </div>

    <div class="gold-line"></div>

    <div class="section">
      <div class="section-title">Ausbildungen & Lizenzen</div>
      <table>
        <thead><tr><th>Ausbildung</th><th style="width:100px;text-align:center">Status</th></tr></thead>
        <tbody>${ausbRows}</tbody>
      </table>
    </div>

    <div class="section" style="margin-top:24px">
      <div class="section-title">Weiterbildungen</div>
      <table>
        <thead><tr><th>Weiterbildung</th><th style="width:100px;text-align:center">Status</th></tr></thead>
        <tbody>${wbRows}</tbody>
      </table>
    </div>

    <div class="gold-line"></div>

    <div class="footer">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Unterschrift Ausstellender</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:#64748b">Dokumentnummer</div>
        <div style="font-size:13px;font-weight:700;color:#1e293b">USMS-${dn}-${Date.now().toString(36).toUpperCase()}</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Unterschrift Mitarbeiter</div>
      </div>
    </div>

    <div class="watermark">U.S. MARSHALS SERVICE · SENORA CITY · OFFIZIELLES DOKUMENT</div>
  </div>
</div>
<script>window.onload=()=>window.print()<\/script>
</body></html>`);
  win.document.close();
};

updateUI();
