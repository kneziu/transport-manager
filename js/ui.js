
const SUBS = [
  ["vehicles", "Lista aut"],
  ["drivers", "Kierowcy"],
  ["daily", "Daily check"],
  ["calendar", "Terminarz"],
  ["pmi", "Szkody / PMI"],
  ["brakes", "Brake test"],
  ["tacho", "Tachograf"],
  ["money", "Pieniądze"],
  ["docs", "Dokumenty"]
];

const SUB_IDS = new Set(SUBS.map(([id]) => id));

const ui = {
  period: "week",
  cursor: todayISO(),
  filter: "all",
  highlight: "",
  checkDate: todayISO(),
  docDriver: "",
  docVehicle: ""
};

const lastSub = {};

function parseRoute() {
  const parts = (location.hash || "#/home").replace(/^#/, "").split("/").filter(Boolean);
  if (parts[0] === "me") return { name: "me" };
  if (parts[0] === "c" && parts[1]) {
    const sub = SUB_IDS.has(parts[2]) ? parts[2] : "vehicles";
    return { name: "company", companyId: decodeURIComponent(parts[1]), sub };
  }
  return { name: "home" };
}

function rememberRoute(route) {
  if (route.name === "company") lastSub[route.companyId] = route.sub;
}

function companyHref(id) {
  return `#/c/${encodeURIComponent(id)}/${lastSub[id] || "vehicles"}`;
}
