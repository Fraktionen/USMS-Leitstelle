import { db, ADMIN_IDS, AUSBILDUNGEN, WEITERBILDUNGEN, getDiscordUser, discordLoginURL } from "./firebase-config.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const RANK_MAP = [
  { name: "Director Of USMS",           dns: [1],            cls: "director" },
  { name: "Assistant Director of USMS", dns: [2],            cls: "director" },
  { name: "Chief Of Staff",             dns: [3],            cls: "chief"    },
  { name: "Assistant Chief of Staff",   dns: [4, 5],         cls: "chief"    },
  { name: "Supervisory U.S. Marshal",   dns: range(5, 9),    cls: "chief"    },
  { name: "Captain First Class",        dns: range(10, 16),  cls: "captain"  },
  { name: "Captain",                    dns: range(17, 25),  cls: "captain"  },
  { name: "Lieutenant First Class",      dns: range(25, 27),  cls: "lieutenant" },
  { name: "Lieutenant",                  dns: range(27, 30),  cls: "lieutenant" },
  { name: "Sergeant First Class",       dns: range(30, 35),  cls: "sergeant" },
  { name: "Sergeant",                   dns: range(31, 42),  cls: "sergeant" },
  { name: "Corporal",                   dns: range(42, 50),  cls: "corporal" },
  { name: "Deputy First Class Marshal", dns: range(50, 58),  cls: "deputy"   },
  { name: "Deputy Marshal",             dns: range(58, 75),  cls: "deputy"   },
  { name: "Rekrut Marshal",             dns: range(75, 120), cls: "rekrut"   },
];

function range(s, e) { const a=[]; for(let i=s;i<=e;i++) a.push(i); return a; }
function getRankInfo(dn) { for(const r of RANK_MAP) if(r.dns.includes(dn)) return r; return {name:"Unbekannt",cls:"rekrut"}; }

let employees = {}, currentUser = null, editDN = null, ausbildungDN = null, notizDN = null, logEntries = [];

function isAdmin() { return currentUser && ADMIN_IDS.includes(currentUser.id); }

// ── LOG ──────────────────────────────────────────────────────
async function writeLog(action, details) {
  if (!currentUser) return;
  await addDoc(collection(db, "logs"), {
    action, details, adminName: currentUser.username, adminId: currentUser.id,
    timestamp: serverTimestamp(),
    timestampLocal: new Date().toLocaleString("de-DE", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})
  });
}

// ── DISCORD ──────────────────────────────────────────────────
document.getElementById("discordBtn").addEventListener("click", () => {
  if (currentUser) { currentUser = null; sessionStorage.removeItem("discord_token"); updateLoginUI(); return; }
  window.location.href = discordLoginURL();
});
const savedToken = sessionStorage.getItem("discord_token");
if (savedToken) getDiscordUser(savedToken).then(u => { currentUser = u; sessionStorage.setItem("discord_token",savedToken); updateLoginUI(); }).catch(() => { sessionStorage.removeItem("discord_token"); });

function updateLoginUI() {
  const dot=document.getElementById("loginDot"), text=document.getElementById("loginText"),
        btn=document.getElementById("discordBtn"), addBtn=document.getElementById("addBtn"),
        actHead=document.getElementById("actionsHead"), hint=document.getElementById("noEditHint"),
        logBtn=document.getElementById("logBtn"), motmSet=document.getElementById("motmSetBar");
  if (currentUser) {
    dot.classList.remove("off");
    text.textContent = `Eingeloggt: ${currentUser.username} (${currentUser.id})${isAdmin()?" ✓ Admin":" — kein Admin-Zugriff"}`;
    btn.textContent = "Ausloggen";
    if (isAdmin()) {
      addBtn.classList.remove("hidden"); actHead.classList.remove("hidden");
      hint.classList.add("hidden"); logBtn.classList.remove("hidden");
      motmSet.classList.remove("hidden");
    }
  } else {
    dot.classList.add("off"); text.textContent = "Nicht eingeloggt — nur Lesezugriff";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> Mit Discord einloggen`;
    addBtn.classList.add("hidden"); actHead.classList.add("hidden");
    hint.classList.remove("hidden"); logBtn.classList.add("hidden");
    motmSet.classList.add("hidden");
  }
  renderTable();
}

// ── FIREBASE ─────────────────────────────────────────────────
onSnapshot(collection(db, "employees"), (snap) => {
  employees = {};
  snap.forEach(d => { employees[parseInt(d.id)] = d.data(); });
  renderTable(); loadMOTM();
});
onSnapshot(query(collection(db, "logs"), orderBy("timestamp","desc")), (snap) => {
  logEntries = []; snap.forEach(d => logEntries.push(d.data()));
});
onSnapshot(doc(db, "settings", "motm"), (d) => {
  if (d.exists()) renderMOTM(d.data());
});

// ── TABELLE ───────────────────────────────────────────────────
function renderTable() {
  const search=document.getElementById("searchInput").value.toLowerCase();
  const rankF=document.getElementById("rankFilter").value;
  const body=document.getElementById("tableBody");
  let rows="", filled=0, free=0;

  for (let dn=1; dn<=120; dn++) {
    const emp=employees[dn], ri=getRankInfo(dn);
    if (emp) {
      if (search && !emp.name.toLowerCase().includes(search) && !String(dn).includes(search)) continue;
      if (rankF && emp.rank!==rankF) continue;
      filled++;
      const dateStr=emp.date||"—";
      const ausb=emp.ausbildungen||{}, wb=emp.weiterbildungen||{};
      const badges=[
        ...AUSBILDUNGEN.filter(a=>ausb[a.id]).map(a=>`<span class="ausb-badge">${a.label}</span>`),
        ...WEITERBILDUNGEN.filter(w=>wb[w.id]).map(w=>`<span class="wb-badge">${w.label}</span>`)
      ].join("");
      rows+=`<tr>
        <td><span class="dn-badge">${String(dn).padStart(2,"0")}</span></td>
        <td><span class="name-cell">${emp.name}</span>${badges?`<div class="badge-row">${badges}</div>`:""}</td>
        <td><span class="rank-badge ${ri.cls}">${emp.rank}</span></td>
        <td><span class="date-cell">${dateStr}</span></td>
        <td><span class="patrol-btn">Patrol</span></td>
        ${isAdmin()?`<td><div class="action-btns">
          <button class="ausb-btn" onclick="openAusbildung(${dn})" title="Ausbildungen">🎓</button>
          <button class="notiz-btn" onclick="openNotiz(${dn})" title="Notizen">🗒️</button>
          <button class="edit-btn" onclick="openEdit(${dn})" title="Bearbeiten">✏️</button>
          <button class="del-btn" onclick="deleteEntry(${dn})" title="Löschen">🗑️</button>
        </div></td>`:""}
      </tr>`;
    } else {
      if (search||rankF) { free++; continue; }
      free++;
      rows+=`<tr>
        <td><span class="dn-badge empty">${String(dn).padStart(2,"0")}</span></td>
        <td colspan="3"><span class="empty-name">— Nicht besetzt —</span></td>
        <td></td>
        ${isAdmin()?`<td><div class="action-btns"><button class="edit-btn" onclick="openAdd(${dn})">➕</button></div></td>`:""}
      </tr>`;
    }
  }
  body.innerHTML = rows||`<tr><td colspan="6" style="padding:32px;text-align:center;color:#374151">Keine Einträge gefunden</td></tr>`;
  document.getElementById("hFilled").textContent=filled;
  document.getElementById("hFree").textContent=free;
}

// ── MITARBEITER MODAL ─────────────────────────────────────────
window.openAdd = (dn) => {
  if(!isAdmin()) return; editDN=null;
  document.getElementById("modalTitle").textContent="Mitarbeiter hinzufügen";
  document.getElementById("fDN").value=dn||"";
  document.getElementById("fName").value="";
  document.getElementById("fRank").value="Rekrut Marshal";
  document.getElementById("fDate").value=new Date().toISOString().split("T")[0];
  document.getElementById("fDiscord").value="";
  document.getElementById("modal").classList.remove("hidden");
};
window.openEdit = (dn) => {
  if(!isAdmin()) return; editDN=dn;
  const emp=employees[dn]; if(!emp) return;
  document.getElementById("modalTitle").textContent="Mitarbeiter bearbeiten";
  document.getElementById("fDN").value=dn;
  document.getElementById("fName").value=emp.name;
  document.getElementById("fRank").value=emp.rank;
  if(emp.date&&emp.date!=="—"){const p=emp.date.split(".");if(p.length===3) document.getElementById("fDate").value=`${p[2]}-${p[1]}-${p[0]}`;}
  document.getElementById("fDiscord").value=emp.discordId||"";
  document.getElementById("modal").classList.remove("hidden");
};
window.closeModal = () => document.getElementById("modal").classList.add("hidden");
window.saveEntry = async () => {
  if(!isAdmin()) return;
  const dn=parseInt(document.getElementById("fDN").value);
  const name=document.getElementById("fName").value.trim();
  const rank=document.getElementById("fRank").value;
  const dateVal=document.getElementById("fDate").value;
  const discord=document.getElementById("fDiscord").value.trim();
  if(!dn||dn<1||dn>120){alert("Bitte DN 1–120 eingeben.");return;}
  if(!name){alert("Name eingeben.");return;}
  let dateStr="—";
  if(dateVal){const[y,m,d]=dateVal.split("-");dateStr=`${d}.${m}.${y}`;}
  const isNew=!employees[dn], oldEmp=employees[dn]||{};
  const data={name,rank,date:dateStr};
  if(discord) data.discordId=discord;
  if(oldEmp.ausbildungen) data.ausbildungen=oldEmp.ausbildungen;
  if(oldEmp.weiterbildungen) data.weiterbildungen=oldEmp.weiterbildungen;
  if(oldEmp.notizen) data.notizen=oldEmp.notizen;
  await setDoc(doc(db,"employees",String(dn)),data);
  if(isNew) await writeLog("EINGESTELLT",`DN ${String(dn).padStart(2,"0")} — ${name} als ${rank} eingestellt`);
  else {
    const ch=[];
    if(oldEmp.name!==name) ch.push(`Name: "${oldEmp.name}" → "${name}"`);
    if(oldEmp.rank!==rank) ch.push(`Rang: "${oldEmp.rank}" → "${rank}"`);
    if(ch.length) await writeLog("BEARBEITET",`DN ${String(dn).padStart(2,"0")} — ${name}: ${ch.join(" | ")}`);
  }
  closeModal();
};
window.deleteEntry = async (dn) => {
  if(!isAdmin()) return;
  const emp=employees[dn];
  if(!confirm(`DN ${String(dn).padStart(2,"0")} — ${emp?.name} wirklich entfernen?`)) return;
  await writeLog("ENTLASSEN",`DN ${String(dn).padStart(2,"0")} — ${emp?.name} (${emp?.rank}) entlassen`);
  await deleteDoc(doc(db,"employees",String(dn)));
};

// ── AUSBILDUNGS MODAL ─────────────────────────────────────────
window.openAusbildung = (dn) => {
  if(!isAdmin()) return; ausbildungDN=dn;
  const emp=employees[dn], ausb=emp.ausbildungen||{}, wb=emp.weiterbildungen||{};
  document.getElementById("ausbTitle").textContent=`Ausbildungen — ${emp.name} (DN ${String(dn).padStart(2,"0")})`;
  document.getElementById("ausbList").innerHTML=AUSBILDUNGEN.map(a=>`
    <label class="ausb-check ${ausb[a.id]?"checked":""}">
      <input type="checkbox" data-id="${a.id}" data-type="ausb" ${ausb[a.id]?"checked":""}>
      <span class="check-box"></span><span class="check-label">${a.label}</span>
    </label>`).join("");
  document.getElementById("wbList").innerHTML=WEITERBILDUNGEN.map(w=>`
    <label class="ausb-check wb ${wb[w.id]?"checked":""}">
      <input type="checkbox" data-id="${w.id}" data-type="wb" ${wb[w.id]?"checked":""}>
      <span class="check-box"></span><span class="check-label">${w.label}</span>
    </label>`).join("");
  document.querySelectorAll("#ausbList input,#wbList input").forEach(cb=>{
    cb.addEventListener("change",e=>e.target.closest("label").classList.toggle("checked",e.target.checked));
  });
  document.getElementById("ausbModal").classList.remove("hidden");
};
window.closeAusbModal = () => document.getElementById("ausbModal").classList.add("hidden");
window.saveAusbildungen = async () => {
  if(!isAdmin()||!ausbildungDN) return;
  const emp=employees[ausbildungDN];
  const oldAusb=emp.ausbildungen||{}, oldWb=emp.weiterbildungen||{};
  const newAusb={}, newWb={};
  document.querySelectorAll("#ausbList input").forEach(cb=>newAusb[cb.dataset.id]=cb.checked);
  document.querySelectorAll("#wbList input").forEach(cb=>newWb[cb.dataset.id]=cb.checked);
  const ch=[];
  AUSBILDUNGEN.forEach(a=>{if(!!oldAusb[a.id]!==!!newAusb[a.id]) ch.push(`${a.label}: ${newAusb[a.id]?"✓ erteilt":"✗ entzogen"}`);});
  WEITERBILDUNGEN.forEach(w=>{if(!!oldWb[w.id]!==!!newWb[w.id]) ch.push(`${w.label}: ${newWb[w.id]?"✓ erteilt":"✗ entzogen"}`);});
  await setDoc(doc(db,"employees",String(ausbildungDN)),{...emp,ausbildungen:newAusb,weiterbildungen:newWb});
  if(ch.length) await writeLog("AUSBILDUNG",`DN ${String(ausbildungDN).padStart(2,"00")} — ${emp.name}: ${ch.join(" | ")}`);
  closeAusbModal();
};

// ── NOTIZEN MODAL ─────────────────────────────────────────────
window.openNotiz = (dn) => {
  if(!isAdmin()) return; notizDN=dn;
  const emp=employees[dn];
  document.getElementById("notizTitle").textContent=`🗒️ Notizen — ${emp.name}`;
  renderNotizen(emp.notizen||[]);
  document.getElementById("notizInput").value="";
  document.getElementById("notizModal").classList.remove("hidden");
};
window.closeNotizModal = () => document.getElementById("notizModal").classList.add("hidden");
function renderNotizen(notizen) {
  const list=document.getElementById("notizList");
  if(!notizen.length){list.innerHTML=`<div style="color:var(--text3);font-size:13px;padding:8px 0">Noch keine Notizen</div>`;return;}
  list.innerHTML=notizen.map((n,i)=>`
    <div class="notiz-item">
      <div class="notiz-meta">${n.adminName} · ${n.date}</div>
      <div class="notiz-text">${n.text}</div>
      ${isAdmin()?`<button class="del-btn" style="margin-top:6px;font-size:11px;padding:3px 8px" onclick="deleteNotiz(${i})">🗑️ Löschen</button>`:""}
    </div>`).join("");
}
window.saveNotiz = async () => {
  if(!isAdmin()||!notizDN) return;
  const text=document.getElementById("notizInput").value.trim();
  if(!text) return;
  const emp=employees[notizDN];
  const notizen=[...(emp.notizen||[]),{text,adminName:currentUser.username,date:new Date().toLocaleString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}];
  await setDoc(doc(db,"employees",String(notizDN)),{...emp,notizen});
  await writeLog("NOTIZ",`DN ${String(notizDN).padStart(2,"00")} — ${emp.name}: Notiz hinzugefügt`);
  document.getElementById("notizInput").value="";
  renderNotizen(notizen);
};
window.deleteNotiz = async (idx) => {
  if(!isAdmin()||!notizDN) return;
  const emp=employees[notizDN];
  const notizen=(emp.notizen||[]).filter((_,i)=>i!==idx);
  await setDoc(doc(db,"employees",String(notizDN)),{...emp,notizen});
  renderNotizen(notizen);
};

// ── MOTM ─────────────────────────────────────────────────────
function loadMOTM() {}
function renderMOTM(data) {
  const bar=document.getElementById("motmBar");
  if(!data||!data.dn){bar.style.display="none";return;}
  const emp=employees[data.dn];
  if(!emp){bar.style.display="none";return;}
  bar.style.display="";
  document.getElementById("motmName").textContent=emp.name;
  document.getElementById("motmRank").textContent=emp.rank;
  document.getElementById("motmDN").textContent=`DN ${String(data.dn).padStart(2,"00")}`;
  if(isAdmin()) document.getElementById("motmEditBtn").classList.remove("hidden");
}
document.getElementById("motmSetBtn").addEventListener("click",()=>document.getElementById("motmModal").classList.remove("hidden"));
document.getElementById("motmEditBtn")?.addEventListener("click",()=>document.getElementById("motmModal").classList.remove("hidden"));
window.closeMotmModal = () => document.getElementById("motmModal").classList.add("hidden");
document.getElementById("motmDNInput").addEventListener("input",()=>{
  const dn=parseInt(document.getElementById("motmDNInput").value);
  const prev=document.getElementById("motmPreview");
  if(employees[dn]) prev.textContent=`→ ${employees[dn].name} (${employees[dn].rank})`;
  else prev.textContent=dn?"Kein Mitarbeiter mit dieser DN":"";
});
window.saveMotm = async () => {
  if(!isAdmin()) return;
  const dn=parseInt(document.getElementById("motmDNInput").value);
  if(!employees[dn]){alert("Kein Mitarbeiter mit dieser DN");return;}
  await setDoc(doc(db,"settings","motm"),{dn,name:employees[dn].name,rank:employees[dn].rank});
  await writeLog("MOTM",`Mitarbeiter des Monats gesetzt: ${employees[dn].name} (DN ${String(dn).padStart(2,"00")})`);
  closeMotmModal();
};

// ── LOG MODAL ─────────────────────────────────────────────────
document.getElementById("logBtn").addEventListener("click",()=>{renderLog();document.getElementById("logModal").classList.remove("hidden");});
window.closeLogModal = () => document.getElementById("logModal").classList.add("hidden");
function renderLog() {
  const body=document.getElementById("logBody");
  if(!logEntries.length){body.innerHTML=`<tr><td colspan="4" style="padding:24px;text-align:center;color:#4d6080">Noch keine Einträge</td></tr>`;return;}
  const colors={EINGESTELLT:"#4ade80",ENTLASSEN:"#f87171",BEARBEITET:"#fbbf24",AUSBILDUNG:"#60a5fa",MOTM:"#c4b5fd",NOTIZ:"#94a3b8"};
  body.innerHTML=logEntries.map(e=>`<tr style="border-bottom:1px solid #0d1018">
    <td style="padding:10px 16px;color:#64748b;white-space:nowrap;font-size:12px">${e.timestampLocal||"—"}</td>
    <td style="padding:10px 16px"><span style="color:${colors[e.action]||"#94a3b8"};font-weight:700;font-size:11px;letter-spacing:0.05em">${e.action}</span></td>
    <td style="padding:10px 16px;color:#93c5fd;font-size:12px">${e.adminName}</td>
    <td style="padding:10px 16px;color:#e2e8f0;font-size:13px">${e.details}</td>
  </tr>`).join("");
}
window.exportLogPDF = () => {
  const win=window.open("","_blank");
  const now=new Date().toLocaleString("de-DE");
  const colors={EINGESTELLT:"#166534",ENTLASSEN:"#991b1b",BEARBEITET:"#92400e",AUSBILDUNG:"#1e3a8a",MOTM:"#4a1d96",NOTIZ:"#374151"};
  const rows=logEntries.map(e=>`<tr><td>${e.timestampLocal||"—"}</td><td style="color:${colors[e.action]||"#333"};font-weight:700">${e.action}</td><td>${e.adminName}</td><td>${e.details}</td></tr>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>USMS Audit Log</title>
  <style>body{font-family:Arial,sans-serif;padding:32px;color:#1a1a2e}h1{font-size:22px;margin-bottom:4px}.sub{color:#666;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:12px}thead{background:#1a2744;color:white}th{padding:10px 12px;text-align:left}td{padding:9px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even){background:#f8fafc}.footer{margin-top:24px;font-size:11px;color:#999;text-align:right}</style>
  </head><body><h1>🏛️ USMS Senora City — Audit Log</h1><div class="sub">Exportiert am ${now} · ${logEntries.length} Einträge</div>
  <table><thead><tr><th>Zeitstempel</th><th>Aktion</th><th>Admin</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">Automatisch generiert · USMS Personaldatenbank</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};

document.getElementById("searchInput").addEventListener("input",renderTable);
document.getElementById("rankFilter").addEventListener("change",renderTable);
document.getElementById("addBtn").addEventListener("click",()=>openAdd());
updateLoginUI();
