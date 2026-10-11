
const KEY = "tm.v1";
const PALETTE = ["#1a6b63", "#b45309", "#1d4e89", "#6d28a8", "#9f1239", "#3f6212", "#0f766e", "#9a3412"];
const ARRAYS = ["vehicles", "drivers", "checks", "damages", "reservations", "brakes", "exclusions", "notes", "money", "documents"];

let state = normalize(read());
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function str(value) {
  return typeof value === "string" ? value : "";
}

function dataUrl(value, prefix = "data:") {
  const text = str(value);
  return text.startsWith(prefix) ? text : "";
}

function bool(value) {
  return value === true;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeVehicle(vehicle) {
  return {
    id: str(vehicle.id) || uid("v"),
    reg: str(vehicle.reg),
    status: str(vehicle.status) || "active",
    olDate: str(vehicle.olDate),
    motDate: str(vehicle.motDate),
    nextMot: str(vehicle.nextMot),
    preparing: bool(vehicle.preparing),
    windowStart: str(vehicle.windowStart),
    windowEnd: str(vehicle.windowEnd),
    taxDate: str(vehicle.taxDate),
    tachoCal: str(vehicle.tachoCal),
    tachoExpiry: str(vehicle.tachoExpiry),
    tachoNote: str(vehicle.tachoNote),
    notes: str(vehicle.notes),
    pmi: list(vehicle.pmi).map((row) => ({
      id: str(row.id) || uid("p"),
      date: str(row.date),
      done: bool(row.done),
      note: str(row.note),
      active: bool(row.active)
    }))
  };
}

function normalizeDriver(driver) {
  return {
    id: str(driver.id) || uid("d"),
    name: str(driver.name),
    phone: str(driver.phone),
    licenceExpiry: str(driver.licenceExpiry),
    cardExpiry: str(driver.cardExpiry),
    otherLabel: str(driver.otherLabel),
    otherDate: str(driver.otherDate),
    notes: str(driver.notes)
  };
}

function normalizeLoose(record, fields) {
  const next = { id: str(record.id) || uid("r") };
  for (const field of fields) next[field] = str(record[field]);
  return next;
}

function normalizeCompany(company) {
  const next = {
    id: str(company.id) || uid("c"),
    name: str(company.name) || "Firma",
    color: /^#[0-9a-fA-F]{6}$/.test(company.color || "") ? company.color : "#1a6b63"
  };
  for (const key of ARRAYS) next[key] = [];
  next.vehicles = list(company.vehicles).map(normalizeVehicle);
  next.drivers = list(company.drivers).map(normalizeDriver);
  next.checks = list(company.checks).map((check) => ({
    id: str(check.id) || uid("chk"),
    vehicleId: str(check.vehicleId),
    date: str(check.date),
    driverName: str(check.driverName),
    notes: str(check.notes),
    items: check.items && typeof check.items === "object" ? Object.fromEntries(
      Object.entries(check.items).map(([key, value]) => [str(key), value === "defect" ? "defect" : "ok"])
    ) : {}
  }));
  next.damages = list(company.damages).map((row) => ({
    ...normalizeLoose(row, ["vehicleId", "date", "description", "status"]),
    photo: dataUrl(row.photo, "data:image/")
  }));
  next.reservations = list(company.reservations).map((row) => normalizeLoose(row, ["vehicleId", "date", "kind", "place", "note"]));
  next.brakes = list(company.brakes).map((row) => normalizeLoose(row, ["vehicleId", "date", "result", "method", "reading", "notes"]));
  next.exclusions = list(company.exclusions).map((row) => normalizeLoose(row, ["vehicleId", "start", "end", "reason"]));
  next.notes = list(company.notes).map((row) => normalizeLoose(row, ["vehicleId", "date", "text"]));
  next.money = list(company.money).map((row) => ({
    ...normalizeLoose(row, ["vehicleId", "date", "category", "note"]),
    amount: String(Number(row.amount) || 0)
  }));
  next.documents = list(company.documents).map((row) => ({
    ...normalizeLoose(row, ["name", "category", "vehicleId", "driverId", "mime"]),
    dataUrl: dataUrl(row.dataUrl)
  }));
  return next;
}

function normalizeTraining(training) {
  return {
    id: str(training.id) || uid("t"),
    title: str(training.title),
    body: str(training.body),
    questions: list(training.questions).map((question) => ({
      id: str(question.id) || uid("q"),
      text: str(question.text)
    })).filter((question) => question.text),
    shares: list(training.shares).map((share) => ({
      id: str(share.id) || uid("s"),
      companyId: str(share.companyId),
      driverId: str(share.driverId)
    })),
    signatures: list(training.signatures).map((signature) => ({
      id: str(signature.id) || uid("sig"),
      companyId: str(signature.companyId),
      driverId: str(signature.driverId),
      name: str(signature.name),
      signedAt: str(signature.signedAt),
      signature: dataUrl(signature.signature, "data:image/"),
      answers: signature.answers && typeof signature.answers === "object"
        ? Object.fromEntries(Object.entries(signature.answers).map(([key, value]) => [str(key), value === "no" ? "no" : "yes"]))
        : {}
    }))
  };
}

function normalize(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.companies)) return createSeed();
  return {
    version: 1,
    companies: data.companies.map(normalizeCompany),
    trainings: list(data.trainings).map(normalizeTraining)
  };
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function notify() {
  listeners.forEach((fn) => fn());
}

function getState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next) {
  const previous = state;
  state = next;
  try {
    persist();
  } catch {
    state = previous;
    throw new Error("quota");
  }
  notify();
}

function update(mutator) {
  const draft = structuredClone(state);
  mutator(draft);
  try {
    commit(draft);
    return true;
  } catch (error) {
    if (error.message === "quota") {
      toast("Brak miejsca w przeglądarce. Usuń część zdjęć albo wyeksportuj kopię.");
      return false;
    }
    throw error;
  }
}

function resetData() {
  commit(createSeed());
}

function replaceData(data) {
  commit(normalize(data));
}

function blankCompany(name) {
  const used = new Set(getState().companies.map((company) => company.color));
  const color = PALETTE.find((item) => !used.has(item)) || PALETTE[getState().companies.length % PALETTE.length];
  return normalizeCompany({ id: uid("c"), name, color });
}

function findCompany(id) {
  return state.companies.find((company) => company.id === id) || null;
}
