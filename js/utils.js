function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function todayISO() {
  return toISO(new Date());
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isISO(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function addDaysISO(iso, days) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function diffDays(from, to) {
  return Math.round((fromISO(to) - fromISO(from)) / 86400000);
}

function startOfWeek(iso) {
  const day = fromISO(iso).getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDaysISO(iso, delta);
}

function monthMatrix(iso) {
  const date = fromISO(iso);
  const first = toISO(new Date(date.getFullYear(), date.getMonth(), 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
}

function formatPL(iso) {
  if (!isISO(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const WEEKDAYS = ["Ndz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

function weekday(iso) {
  return WEEKDAYS[fromISO(iso).getDay()];
}

function longDate(iso) {
  return fromISO(iso).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function prettyRange(start, end) {
  if (start === end) return longDate(start);
  const a = fromISO(start);
  const b = fromISO(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    const rest = a.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }).replace(/^\d+\s/, "");
    return `${a.getDate()}–${b.getDate()} ${rest}`;
  }
  const opt = { day: "numeric", month: "short", year: "numeric" };
  return `${a.toLocaleDateString("pl-PL", opt)} – ${b.toLocaleDateString("pl-PL", opt)}`;
}

function gbp(amount) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(amount) || 0);
}

const WALKAROUND = [
  ["tyres", "Opony, koła i nakrętki"],
  ["lights", "Światła i kierunkowskazy"],
  ["glass", "Szyby, lusterka, wycieraczki"],
  ["brakes", "Hamulce i powietrze"],
  ["leaks", "Wycieki oleju, paliwa i powietrza"],
  ["body", "Nadwozie i mocowanie ładunku"],
  ["plates", "Tablice i oznaczenia"],
  ["tacho", "Tachograf i karta kierowcy"],
  ["horn", "Klakson"],
  ["fluids", "Poziomy oleju i płynów"]
];

const STATUS_LABEL = {
  active: "W ruchu",
  waiting: "Oczekuje",
  service: "W serwisie",
  workshop: "Warsztat",
  sold: "Sprzedany"
};

function fileToDataUrl(file, maxWidth = 1400) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Plik jest większy niż 8 MB."));
      return;
    }
    if (!file.type.startsWith("image/")) {
      if (file.size > 900 * 1024) {
        reject(new Error("PDF może mieć najwyżej 900 KB. Zdjęcie zostanie zmniejszone automatycznie."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
      reader.onload = () => resolve({ dataUrl: reader.result, mime: file.type || "application/octet-stream", name: file.name });
      reader.readAsDataURL(file);
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.72), mime: "image/jpeg", name: file.name.replace(/\.\w+$/, "") + ".jpg" });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się odczytać zdjęcia."));
    };
    image.src = url;
  });
}
