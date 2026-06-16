import { db, getDiscordUser, discordLoginURL, AUSBILDUNGEN, WEITERBILDUNGEN } from "./firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

document.getElementById("discordBtn").addEventListener("click", () => {
  if (currentUser) { currentUser = null; sessionStorage.removeItem("discord_token"); updateUI(); return; }
  window.location.href = discordLoginURL();
});
const token = sessionStorage.getItem("discord_token");
if (token) getDiscordUser(token).then(u => { currentUser = u; updateUI(); }).catch(() => {});

function updateUI() {
  const dot = document.getElementById("loginDot");
  const text = document.getElementById("loginText");
  if (currentUser) { dot.classList.remove("off"); text.textContent = `Eingeloggt: ${currentUser.username}`; }
  else { dot.classList.add("off"); text.textContent = "Nicht eingeloggt"; }
}

const RANK_NAMES = [
  "Director Of USMS","Assistant Director of USMS","Chief Of Staff","Assistant Chief of Staff",
  "Supervisory U.S. Marshal","Captain First Class","Captain","Sergeant First Class",
  "Sergeant","Corporal","Deputy First Class Marshal","Deputy Marshal","Rekrut Marshal"
];
const RANK_COLORS = [
  "#c4b5fd","#a78bfa","#60a5fa","#38bdf8","#34d399","#4ade80","#86efac",
  "#fbbf24","#f97316","#f87171","#7dd3fc","#93c5fd","#9ca3af"
];

let rankChart = null;
let ausbChart = null;

onSnapshot(collection(db, "employees"), (snap) => {
  const employees = {};
  snap.forEach(d => { employees[parseInt(d.id)] = d.data(); });
  renderStats(employees);
});

function renderStats(employees) {
  const list = Object.values(employees);
  const total = list.length;
  const filled = total;
  const free = 120 - total;

  // Stat Cards
  document.getElementById("statsCards").innerHTML = `
    <div class="stats-card"><div class="stats-card-num">${filled}</div><div class="stats-card-label">Aktive Mitarbeiter</div></div>
    <div class="stats-card"><div class="stats-card-num">${free}</div><div class="stats-card-label">Freie Stellen</div></div>
    <div class="stats-card"><div class="stats-card-num">120</div><div class="stats-card-label">Gesamtstellen</div></div>
    <div class="stats-card"><div class="stats-card-num">${Math.round(filled/120*100)}%</div><div class="stats-card-label">Auslastung</div></div>
  `;

  // Rang Chart
  const rankCounts = {};
  RANK_NAMES.forEach(r => rankCounts[r] = 0);
  list.forEach(e => { if (rankCounts[e.rank] !== undefined) rankCounts[e.rank]++; });
  const rankLabels = RANK_NAMES.filter(r => rankCounts[r] > 0);
  const rankData   = rankLabels.map(r => rankCounts[r]);
  const rankColorsFiltered = RANK_NAMES.map((r,i) => ({ r, c: RANK_COLORS[i] })).filter(x => rankCounts[x.r] > 0).map(x => x.c);

  if (rankChart) rankChart.destroy();
  rankChart = new Chart(document.getElementById("rankChart"), {
    type: "bar",
    data: { labels: rankLabels.map(l => l.length > 18 ? l.substring(0,18)+"…" : l), datasets: [{
      data: rankData, backgroundColor: rankColorsFiltered, borderRadius: 4, borderSkipped: false
    }]},
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "#1e2a3a" } },
        y: { ticks: { color: "#64748b", stepSize: 1 }, grid: { color: "#1e2a3a" }, beginAtZero: true }
      }
    }
  });

  // Ausbildungs Chart
  const ausbCounts = AUSBILDUNGEN.map(a => ({ label: a.label, count: list.filter(e => e.ausbildungen?.[a.id]).length }));
  if (ausbChart) ausbChart.destroy();
  ausbChart = new Chart(document.getElementById("ausbChart"), {
    type: "bar",
    data: { labels: ausbCounts.map(a => a.label), datasets: [{
      data: ausbCounts.map(a => a.count), backgroundColor: "#2a6bb5", borderRadius: 4, borderSkipped: false
    }]},
    options: {
      indexAxis: "y", responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#64748b", stepSize: 1 }, grid: { color: "#1e2a3a" }, beginAtZero: true },
        y: { ticks: { color: "#64748b", font: { size: 11 } }, grid: { color: "#1e2a3a" } }
      }
    }
  });
}

updateUI();