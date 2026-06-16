import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDpFqHGLiZ6gJaf-K8Qa3dYMr9Bmq7gdLQ",
  authDomain: "usms-seite.firebaseapp.com",
  projectId: "usms-seite",
  storageBucket: "usms-seite.firebasestorage.app",
  messagingSenderId: "697887473009",
  appId: "1:697887473009:web:54674a34ea9982dbdf0ad0"
};

export const DISCORD_CLIENT_ID = "1516560370389483610";
export const REDIRECT_URI = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/") + "callback.html";
export const ADMIN_IDS = [
  "1088404945323167745",
  "974749925239828520",
  "1403712702609625153",
  "1263820208569847871",
  "1309587082028519545",
  "1317575088983244871"
];

export const AUSBILDUNGEN = [
  { id: "grundausbildung",   label: "GRUNDAUSBILDUNG" },
  { id: "waffenschulung",    label: "WAFFENSCHULUNG" },
  { id: "ortskunde",         label: "ORTSKUNDE" },
  { id: "personenschutz",    label: "PERSONENSCHUTZ" },
  { id: "overwatch",         label: "OVERWATCH" },
  { id: "tv_transport",      label: "TV TRANSPORT" },
  { id: "beanbag",           label: "BEANBAG-LIZENZ" },
  { id: "mp5",               label: "MP5-LIZENZ" },
  { id: "personalabteilung", label: "PERSONALABTEILUNG" },
  { id: "ausbildungsabt",    label: "AUSBILDUNGSABTEILUNG" },
];

export const WEITERBILDUNGEN = [
  { id: "wb1",   label: "WB 1" },
  { id: "wb2",   label: "WB 2" },
  { id: "wb3",   label: "WB 3" },
  { id: "wbend", label: "WB END" },
];

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

export async function getDiscordUser(token) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: "Bearer " + token }
  });
  if (!res.ok) throw new Error("Token ungültig");
  return res.json();
}

export function discordLoginURL() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: "identify"
  });
  return "https://discord.com/api/oauth2/authorize?" + params.toString();
}