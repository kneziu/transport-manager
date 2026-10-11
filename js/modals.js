
let onEscape = null;

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  if (onEscape) document.removeEventListener("keydown", onEscape);
  onEscape = null;
}

function fail(form, message) {
  form.querySelector(".form-error").textContent = message;
  return false;
}

function openModal({ title, body, submitLabel = "Zapisz", onSubmit, bind }) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-overlay">
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Zamknij">×</button></header>
      <form>
        <div class="form-body">${body}</div>
        <p class="form-error"></p>
        <footer><button type="button" class="btn ghost" data-close>Anuluj</button><button type="submit" class="btn">${esc(submitLabel)}</button></footer>
      </form>
    </div>
  </div>`;
  const overlay = root.querySelector(".modal-overlay");
  const form = root.querySelector("form");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close]")) closeModal();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await onSubmit(form);
      if (result !== false) closeModal();
    } catch (error) {
      fail(form, error.message || "Nie udało się zapisać.");
    }
  });
  onEscape = (event) => {
    if (event.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", onEscape);
  bind?.(root, form);
  form.querySelector("input, select, textarea")?.focus();
}

function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

function area(label, name, value = "", placeholder = "") {
  return `<label class="field span-2">${label}<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
}

function pick(label, name, value, options, extra = "") {
  return `<label class="field">${label}<select name="${name}" ${extra}>${options.map(([id, text]) => `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}

function vehicleOptions(company, selected, allowEmpty = false) {
  const rows = company.vehicles.map((vehicle) => [vehicle.id, vehicle.status === "sold" ? `${vehicle.reg} (sprzedany)` : vehicle.reg]);
  return allowEmpty ? [["", "—"], ...rows] : rows;
}

function requireVehicle(company) {
  if (company.vehicles.length) return true;
  toast("Najpierw dodaj auto na liście aut.");
  return false;
}

function openVehicleModal(companyId, vehicleId = "") {
  const company = findCompany(companyId);
  if (!company) return;
  const existing = company.vehicles.find((vehicle) => vehicle.id === vehicleId);
  const draft = existing ? structuredClone(existing) : {
    id: uid("v"),
    reg: "",
    status: "active",
    olDate: "",
    motDate: "",
    nextMot: "",
    preparing: false,
    windowStart: "",
    windowEnd: "",
    taxDate: "",
    tachoCal: "",
    tachoExpiry: "",
    tachoNote: "",
    notes: "",
    pmi: [{ id: uid("p"), date: "", done: false, note: "", active: true }]
  };
  const editing = Boolean(existing);
  const body = () => `<div class="form-grid">
    ${field("Numer rejestracyjny", "reg", draft.reg, "text", "required autocomplete='off'")}
    ${pick("Status", "status", draft.status, Object.entries(STATUS_LABEL))}
    ${field("OL", "olDate", draft.olDate, "date")}
    ${field("MOT", "motDate", draft.motDate, "date")}
    ${field("NEXT MOT", "nextMot", draft.nextMot, "text", "class='span-input' placeholder='01.07–31.08.2028'")}
    <label class="checkline span-2"><input name="preparing" type="checkbox" ${draft.preparing ? "checked" : ""}> Okno MOT — preparing</label>
    ${field("Początek okna", "windowStart", draft.windowStart, "date")}
    ${field("Koniec okna", "windowEnd", draft.windowEnd, "date")}
    ${field("TAX ROAD", "taxDate", draft.taxDate, "date")}
    <span></span>
    ${field("TACHO CALIBRATION", "tachoCal", draft.tachoCal, "date")}
    ${field("DATE OF EXPIRY", "tachoExpiry", draft.tachoExpiry, "date")}
    ${field("Notatka tachografu", "tachoNote", draft.tachoNote, "text", "placeholder='waiting for dealer'")}
    <span></span>
    ${area("Uwagi", "notes", draft.notes)}
    <div class="span-2 pmi-editor">
      <h3>PMI / BT</h3>
      ${draft.pmi.map((row) => `<div class="pmi-row" data-pmi-row data-id="${esc(row.id)}">
        <input type="date" name="pmiDate" value="${esc(row.date)}" aria-label="Data PMI">
        <label class="checkline"><input type="checkbox" name="pmiDone" ${row.done ? "checked" : ""}> Y</label>
        <input type="text" name="pmiNote" value="${esc(row.note)}" placeholder="Notatka" aria-label="Notatka PMI">
        <label class="checkline"><input type="checkbox" name="pmiActive" ${row.active ? "checked" : ""}> Alert</label>
        <button type="button" class="linkish danger" data-local="remove-pmi">Usuń</button>
      </div>`).join("")}
      <button type="button" class="btn ghost small" data-local="add-pmi">Dodaj wiersz PMI</button>
      ${editing ? `<button type="button" class="btn ghost danger" data-local="delete-vehicle">Usuń auto</button>` : ""}
    </div>
  </div>`;
  const sync = (form) => {
    draft.reg = form.reg.value.trim().toUpperCase();
    draft.status = form.status.value;
    draft.olDate = form.olDate.value;
    draft.motDate = form.motDate.value;
    draft.nextMot = form.nextMot.value.trim();
    draft.preparing = form.preparing.checked;
    draft.windowStart = form.windowStart.value;
    draft.windowEnd = form.windowEnd.value;
    draft.taxDate = form.taxDate.value;
    draft.tachoCal = form.tachoCal.value;
    draft.tachoExpiry = form.tachoExpiry.value;
    draft.tachoNote = form.tachoNote.value.trim();
    draft.notes = form.notes.value.trim();
    draft.pmi = [...form.querySelectorAll("[data-pmi-row]")].map((row) => ({
      id: row.dataset.id || uid("p"),
      date: row.querySelector("[name=pmiDate]").value,
      done: row.querySelector("[name=pmiDone]").checked,
      note: row.querySelector("[name=pmiNote]").value.trim(),
      active: row.querySelector("[name=pmiActive]").checked
    }));
  };
  openModal({
    title: editing ? draft.reg || "Auto" : "Nowe auto",
    body: body(),
    bind: (root, form) => {
      const redraw = () => {
        sync(form);
        root.querySelector(".form-body").innerHTML = body();
      };
      root.addEventListener("click", (event) => {
        const target = event.target.closest("[data-local]");
        if (!target) return;
        if (target.dataset.local === "add-pmi") {
          sync(form);
          draft.pmi.push({ id: uid("p"), date: "", done: false, note: "", active: true });
          root.querySelector(".form-body").innerHTML = body();
        }
        if (target.dataset.local === "remove-pmi") {
          const id = target.closest("[data-pmi-row]").dataset.id;
          sync(form);
          draft.pmi = draft.pmi.filter((row) => row.id !== id);
          root.querySelector(".form-body").innerHTML = body();
        }
        if (target.dataset.local === "delete-vehicle") {
          if (!confirm(`Usunąć ${draft.reg || "to auto"}?`)) return;
          const saved = update((state) => {
            const firm = state.companies.find((item) => item.id === companyId);
            firm.vehicles = firm.vehicles.filter((item) => item.id !== draft.id);
          });
          if (saved) {
            closeModal();
            toast("Auto usunięte");
          }
        }
      });
      form.addEventListener("input", () => redraw && null);
    },
    onSubmit: (form) => {
      sync(form);
      if (!draft.reg) return fail(form, "Wpisz numer rejestracyjny.");
      if (company.vehicles.some((vehicle) => vehicle.reg === draft.reg && vehicle.id !== draft.id)) {
        return fail(form, "Takie auto jest już w tej firmie.");
      }
      draft.pmi = draft.pmi.filter((row) => row.date || row.note).map((row) => ({
        ...row,
        active: Boolean(row.active && row.note && !row.date)
      }));
      const saved = update((state) => {
        const firm = state.companies.find((item) => item.id === companyId);
        const index = firm.vehicles.findIndex((item) => item.id === draft.id);
        if (index >= 0) firm.vehicles[index] = draft;
        else firm.vehicles.push(draft);
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openDriverModal(companyId, driverId = "") {
  const company = findCompany(companyId);
  const existing = company?.drivers.find((driver) => driver.id === driverId);
  const draft = existing || { id: uid("d"), name: "", phone: "", licenceExpiry: "", cardExpiry: "", otherLabel: "", otherDate: "", notes: "" };
  openModal({
    title: existing ? "Kierowca" : "Nowy kierowca",
    body: `<div class="form-grid">
      ${field("Imię i nazwisko", "name", draft.name, "text", "required")}
      ${field("Telefon", "phone", draft.phone, "tel")}
      ${field("Prawo jazdy — ważność", "licenceExpiry", draft.licenceExpiry, "date")}
      ${field("Karta tachografu — ważność", "cardExpiry", draft.cardExpiry, "date")}
      ${field("Inna data — nazwa", "otherLabel", draft.otherLabel, "text", "placeholder='CPC, ADR…'")}
      ${field("Inna data", "otherDate", draft.otherDate, "date")}
      ${area("Uwagi", "notes", draft.notes)}
      ${existing ? `<div class="span-2"><button type="button" class="btn ghost danger" data-local="delete-driver">Usuń kierowcę</button></div>` : ""}
    </div>`,
    bind: (root) => {
      root.addEventListener("click", (event) => {
        if (!event.target.closest("[data-local=delete-driver]")) return;
        if (!confirm(`Usunąć kierowcę ${draft.name}?`)) return;
        const saved = update((state) => {
          const firm = state.companies.find((item) => item.id === companyId);
          firm.drivers = firm.drivers.filter((item) => item.id !== draft.id);
        });
        if (saved) {
          closeModal();
          toast("Kierowca usunięty");
        }
      });
    },
    onSubmit: (form) => {
      const name = form.querySelector("[name=name]").value.trim();
      if (!name) return fail(form, "Wpisz imię i nazwisko.");
      const next = {
        ...draft,
        name,
        phone: form.phone.value.trim(),
        licenceExpiry: form.licenceExpiry.value,
        cardExpiry: form.cardExpiry.value,
        otherLabel: form.otherLabel.value.trim(),
        otherDate: form.otherDate.value,
        notes: form.notes.value.trim()
      };
      const saved = update((state) => {
        const firm = state.companies.find((item) => item.id === companyId);
        const index = firm.drivers.findIndex((item) => item.id === next.id);
        if (index >= 0) firm.drivers[index] = next;
        else firm.drivers.push(next);
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openCheckModal(companyId, vehicleId, date) {
  const company = findCompany(companyId);
  const vehicle = company?.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return;
  const existing = company.checks.find((check) => check.vehicleId === vehicleId && check.date === date);
  const items = existing?.items || {};
  openModal({
    title: `Daily check · ${vehicle.reg}`,
    submitLabel: "Zapisz przegląd",
    body: `<p class="quiet">${esc(formatPL(date))}</p>
      <div class="checks">${WALKAROUND.map(([key, label]) => `<fieldset>
        <legend>${label}</legend>
        <label><input type="radio" name="item-${key}" value="ok" ${items[key] === "ok" ? "checked" : ""} required> OK</label>
        <label><input type="radio" name="item-${key}" value="defect" ${items[key] === "defect" ? "checked" : ""}> Usterka</label>
      </fieldset>`).join("")}</div>
      ${field("Kierowca", "driverName", existing?.driverName || "", "text", "required placeholder='Imię i nazwisko'")}
      ${area("Uwagi", "notes", existing?.notes || "", "Opisz usterkę, jeśli jest.")}`,
    onSubmit: (form) => {
      const data = new FormData(form);
      const nextItems = {};
      for (const [key] of WALKAROUND) {
        const value = data.get(`item-${key}`);
        if (value !== "ok" && value !== "defect") return fail(form, "Oznacz każdy punkt: OK albo usterka.");
        nextItems[key] = value;
      }
      const notes = form.notes.value.trim();
      if (Object.values(nextItems).includes("defect") && !notes) return fail(form, "Przy usterce wpisz, co jest nie tak.");
      const check = {
        id: existing?.id || uid("chk"),
        vehicleId,
        date,
        driverName: form.driverName.value.trim(),
        notes,
        items: nextItems
      };
      if (!check.driverName) return fail(form, "Wpisz kierowcę.");
      const saved = update((state) => {
        const firm = state.companies.find((item) => item.id === companyId);
        firm.checks = firm.checks.filter((row) => row.id === check.id || !(row.vehicleId === vehicleId && row.date === date));
        const index = firm.checks.findIndex((row) => row.id === check.id);
        if (index >= 0) firm.checks[index] = check;
        else firm.checks.push(check);
      });
      if (!saved) return false;
      toast(Object.values(nextItems).includes("defect") ? "Zapisane z usterką" : "Daily check zapisany");
    }
  });
}

function upsert(companyId, key, record) {
  return update((state) => {
    const firm = state.companies.find((item) => item.id === companyId);
    const index = firm[key].findIndex((item) => item.id === record.id);
    if (index >= 0) firm[key][index] = record;
    else firm[key].push(record);
  });
}

function openDamageModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  if (!requireVehicle(company)) return;
  const existing = company.damages.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Szkoda" : "Nowa szkoda",
    body: `<div class="form-grid">
      ${pick("Auto", "vehicleId", existing?.vehicleId || company.vehicles[0].id, vehicleOptions(company, existing?.vehicleId))}
      ${field("Data", "date", existing?.date || todayISO(), "date", "required")}
      ${pick("Status", "status", existing?.status || "open", [["open", "Otwarta"], ["repair", "W naprawie"], ["closed", "Zamknięta"]])}
      <span></span>
      ${area("Opis", "description", existing?.description || "")}
      <label class="field span-2">Zdjęcie<input name="photo" type="file" accept="image/*"></label>
      ${existing?.photo ? `<label class="checkline span-2"><input name="dropPhoto" type="checkbox"> Usuń obecne zdjęcie</label><img class="preview" alt="" src="${existing.photo}">` : ""}
    </div>`,
    onSubmit: async (form) => {
      const description = form.description.value.trim();
      if (!description) return fail(form, "Opisz szkodę.");
      let photo = existing?.photo || "";
      if (form.dropPhoto?.checked) photo = "";
      if (form.photo.files[0]) photo = (await fileToDataUrl(form.photo.files[0])).dataUrl;
      const saved = upsert(companyId, "damages", {
        id: existing?.id || uid("dmg"),
        vehicleId: form.vehicleId.value,
        date: form.date.value,
        status: form.status.value,
        description,
        photo
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openReservationModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  if (!requireVehicle(company)) return;
  const existing = company.reservations.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Rezerwacja" : "Nowa rezerwacja",
    body: `<div class="form-grid">
      ${pick("Auto", "vehicleId", existing?.vehicleId || company.vehicles[0].id, vehicleOptions(company))}
      ${field("Data", "date", existing?.date || todayISO(), "date", "required")}
      ${pick("Rodzaj", "kind", existing?.kind || "PMI", [["PMI", "PMI"], ["MOT", "MOT"], ["BT", "Brake test"], ["Serwis", "Serwis"], ["Inne", "Inne"]])}
      ${field("Miejsce", "place", existing?.place || "")}
      ${area("Notatka", "note", existing?.note || "")}
    </div>`,
    onSubmit: (form) => {
      if (!form.date.value) return fail(form, "Wybierz datę.");
      const saved = upsert(companyId, "reservations", {
        id: existing?.id || uid("res"),
        vehicleId: form.vehicleId.value,
        date: form.date.value,
        kind: form.kind.value,
        place: form.place.value.trim(),
        note: form.note.value.trim()
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openBrakeModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  if (!requireVehicle(company)) return;
  const existing = company.brakes.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Brake test" : "Nowy brake test",
    body: `<div class="form-grid">
      ${pick("Auto", "vehicleId", existing?.vehicleId || company.vehicles[0].id, vehicleOptions(company))}
      ${field("Data", "date", existing?.date || todayISO(), "date", "required")}
      ${pick("Wynik", "result", existing?.result || "pass", [["pass", "Pass"], ["fail", "Fail"]])}
      ${pick("Metoda", "method", existing?.method || "rollers", [["rollers", "Rolki"], ["decel", "Decelerometr"]])}
      ${field("Odczyt", "reading", existing?.reading || "", "text", "placeholder='%'")}
      <span></span>
      ${area("Notatka", "notes", existing?.notes || "")}
    </div>`,
    onSubmit: (form) => {
      const saved = upsert(companyId, "brakes", {
        id: existing?.id || uid("bt"),
        vehicleId: form.vehicleId.value,
        date: form.date.value,
        result: form.result.value,
        method: form.method.value,
        reading: form.reading.value.trim(),
        notes: form.notes.value.trim()
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openExclusionModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  if (!requireVehicle(company)) return;
  const existing = company.exclusions.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Wyłączenie" : "Nowe wyłączenie",
    body: `<div class="form-grid">
      ${pick("Auto", "vehicleId", existing?.vehicleId || company.vehicles[0].id, vehicleOptions(company))}
      ${field("Od", "start", existing?.start || todayISO(), "date", "required")}
      ${field("Do", "end", existing?.end || "", "date", "required")}
      <span></span>
      ${area("Powód", "reason", existing?.reason || "")}
    </div>`,
    onSubmit: (form) => {
      if (!form.start.value || !form.end.value) return fail(form, "Podaj obie daty.");
      if (form.end.value < form.start.value) return fail(form, "Data końcowa jest wcześniejsza niż początkowa.");
      const saved = upsert(companyId, "exclusions", {
        id: existing?.id || uid("ex"),
        vehicleId: form.vehicleId.value,
        start: form.start.value,
        end: form.end.value,
        reason: form.reason.value.trim()
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openNoteModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  const existing = company.notes.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Wpis" : "Nowy wpis",
    body: `<div class="form-grid">
      ${field("Data", "date", existing?.date || todayISO(), "date", "required")}
      ${company.vehicles.length ? pick("Auto", "vehicleId", existing?.vehicleId || "", vehicleOptions(company, "", true)) : ""}
      ${area("Treść", "text", existing?.text || "")}
    </div>`,
    onSubmit: (form) => {
      const text = form.text.value.trim();
      if (!text) return fail(form, "Wpisz treść.");
      const saved = upsert(companyId, "notes", {
        id: existing?.id || uid("nt"),
        vehicleId: form.vehicleId?.value || "",
        date: form.date.value,
        text
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openMoneyModal(companyId, recordId = "") {
  const company = findCompany(companyId);
  const existing = company.money.find((row) => row.id === recordId);
  openModal({
    title: existing ? "Wydatek" : "Nowy wydatek",
    body: `<div class="form-grid">
      ${field("Data", "date", existing?.date || todayISO(), "date", "required")}
      ${field("Kwota GBP", "amount", existing?.amount || "", "number", "min='0' step='0.01' required")}
      ${pick("Kategoria", "category", existing?.category || "Inne", [["Podatek", "Podatek"], ["MOT", "MOT"], ["PMI", "PMI"], ["Naprawa", "Naprawa"], ["Paliwo", "Paliwo"], ["Inne", "Inne"]])}
      ${company.vehicles.length ? pick("Auto", "vehicleId", existing?.vehicleId || "", vehicleOptions(company, "", true)) : `<input type="hidden" name="vehicleId" value="">`}
      ${area("Notatka", "note", existing?.note || "")}
    </div>`,
    onSubmit: (form) => {
      const saved = upsert(companyId, "money", {
        id: existing?.id || uid("mn"),
        date: form.date.value,
        amount: String(Number(form.amount.value) || 0),
        category: form.category.value,
        vehicleId: form.vehicleId.value,
        note: form.note.value.trim()
      });
      if (!saved) return false;
      toast("Zapisane");
    }
  });
}

function openDocumentModal(companyId, preset = {}) {
  const company = findCompany(companyId);
  openModal({
    title: "Dokument",
    submitLabel: "Dodaj",
    body: `<div class="form-grid">
      ${field("Nazwa", "name", "", "text", "placeholder='Licencja, naklejka, prawo jazdy'")}
      ${pick("Rodzaj", "category", preset.driverId ? "Prawo jazdy" : "Zdjęcie", [["Zdjęcie", "Zdjęcie"], ["Naklejka", "Naklejka"], ["Ubezpieczenie", "Ubezpieczenie"], ["Licencja", "Licencja"], ["Tachograf", "Tachograf"], ["Prawo jazdy", "Prawo jazdy"], ["Inne", "Inne"]])}
      ${company.vehicles.length ? pick("Auto", "vehicleId", preset.vehicleId || "", vehicleOptions(company, "", true)) : `<input type="hidden" name="vehicleId" value="">`}
      ${company.drivers.length ? pick("Kierowca", "driverId", preset.driverId || "", [["", "—"], ...company.drivers.map((driver) => [driver.id, driver.name])]) : `<input type="hidden" name="driverId" value="${esc(preset.driverId || "")}">`}
      <label class="field span-2">Plik<input name="file" type="file" accept="image/*,.pdf" required></label>
    </div>`,
    onSubmit: async (form) => {
      const file = form.file.files[0];
      if (!file) return fail(form, "Wybierz plik.");
      const stored = await fileToDataUrl(file);
      const saved = upsert(companyId, "documents", {
        id: uid("doc"),
        name: form.querySelector("[name=name]").value.trim() || stored.name,
        category: form.category.value,
        vehicleId: form.vehicleId.value,
        driverId: form.driverId.value,
        mime: stored.mime,
        dataUrl: stored.dataUrl
      });
      if (!saved) return false;
      toast("Dokument dodany");
    }
  });
}

function questionRows(questions) {
  return questions.map((question) => `<div class="q-row" data-q-row data-id="${esc(question.id)}">
    <input type="text" name="qText" value="${esc(question.text)}" placeholder="Pytanie tak / nie" aria-label="Pytanie">
    <button type="button" class="linkish danger" data-local="remove-q">Usuń</button>
  </div>`).join("");
}

function openTrainingModal(trainingId = "") {
  const existing = getState().trainings.find((training) => training.id === trainingId);
  const draft = existing ? structuredClone(existing) : {
    id: uid("t"),
    title: "",
    body: "",
    questions: [{ id: uid("q"), text: "" }],
    shares: [],
    signatures: []
  };
  const companies = getState().companies;
  const selectedCompanies = new Set(draft.shares.filter((share) => !share.driverId).map((share) => share.companyId));
  let selectedDriver = draft.shares.find((share) => share.driverId)?.driverId || "";
  const drivers = companies.flatMap((company) => company.drivers.map((driver) => ({ ...driver, company })));
  const body = () => `<div class="form-grid">
    ${field("Tytuł", "title", draft.title, "text", "required")}
    <span></span>
    ${area("Opis", "body", draft.body)}
    <div class="span-2">
      <h3>Pytania</h3>
      <div class="q-list">${questionRows(draft.questions)}</div>
      <button type="button" class="btn ghost small" data-local="add-q">Dodaj pytanie</button>
    </div>
    <div class="span-2 shares">
      <h3>Udostępnij</h3>
      ${companies.map((company) => `<label class="checkline"><input type="checkbox" name="share-${esc(company.id)}" ${selectedCompanies.has(company.id) ? "checked" : ""}> ${esc(company.name)}</label>`).join("")}
      ${drivers.length ? pick("Konkretny kierowca", "driverId", selectedDriver, [["", "—"], ...drivers.map((driver) => [driver.id, `${driver.company.name} · ${driver.name}`])]) : `<input type="hidden" name="driverId" value="">`}
    </div>
  </div>`;
  const sync = (form) => {
    draft.title = form.title.value.trim();
    draft.body = form.body.value.trim();
    draft.questions = [...form.querySelectorAll("[data-q-row]")].map((row) => ({
      id: row.dataset.id || uid("q"),
      text: row.querySelector("[name=qText]").value.trim()
    }));
    draft.shares = [];
    for (const company of companies) {
      if (form.querySelector(`[name=share-${CSS.escape(company.id)}]`)?.checked) {
        draft.shares.push({ id: uid("s"), companyId: company.id, driverId: "" });
      }
    }
    const driverId = form.driverId?.value || "";
    if (driverId) {
      const company = companies.find((item) => item.drivers.some((driver) => driver.id === driverId));
      if (company) draft.shares.push({ id: uid("s"), companyId: company.id, driverId });
    }
  };
  openModal({
    title: existing ? "Szkolenie" : "Nowe szkolenie",
    body: body(),
    bind: (root, form) => {
      root.addEventListener("click", (event) => {
        const target = event.target.closest("[data-local]");
        if (!target) return;
        sync(form);
        selectedDriver = form.driverId?.value || "";
        if (target.dataset.local === "add-q") draft.questions.push({ id: uid("q"), text: "" });
        if (target.dataset.local === "remove-q") {
          const id = target.closest("[data-q-row]").dataset.id;
          draft.questions = draft.questions.filter((question) => question.id !== id);
        }
        selectedCompanies.clear();
        draft.shares.filter((share) => !share.driverId).forEach((share) => selectedCompanies.add(share.companyId));
        root.querySelector(".form-body").innerHTML = body();
      });
    },
    onSubmit: (form) => {
      sync(form);
      if (!draft.title) return fail(form, "Wpisz tytuł.");
      draft.questions = draft.questions.filter((question) => question.text);
      const saved = update((state) => {
        const index = state.trainings.findIndex((training) => training.id === draft.id);
        const next = { ...draft, signatures: existing?.signatures || [] };
        if (index >= 0) state.trainings[index] = next;
        else state.trainings.push(next);
      });
      if (!saved) return false;
      toast("Szkolenie zapisane");
    }
  });
}

function openSignModal(trainingId) {
  const training = getState().trainings.find((item) => item.id === trainingId);
  if (!training) return;
  const companies = getState().companies.filter((company) => training.shares.some((share) => share.companyId === company.id));
  const shareDrivers = training.shares.filter((share) => share.driverId);
  const options = [["", "Wpiszę imię i nazwisko"]];
  for (const company of companies) {
    const limited = shareDrivers.filter((share) => share.companyId === company.id);
    const drivers = limited.length ? company.drivers.filter((driver) => limited.some((share) => share.driverId === driver.id)) : company.drivers;
    for (const driver of drivers) options.push([driver.id, `${driver.name} · ${company.name}`]);
  }
  let pad = null;
  openModal({
    title: training.title,
    submitLabel: "Podpisz",
    body: `<p>${esc(training.body)}</p>
      ${training.questions.map((question) => `<fieldset class="question">
        <legend>${esc(question.text)}</legend>
        <label><input type="radio" name="q-${esc(question.id)}" value="yes" required> Tak</label>
        <label><input type="radio" name="q-${esc(question.id)}" value="no"> Nie</label>
      </fieldset>`).join("")}
      <div class="form-grid">
        ${options.length > 1 ? pick("Kierowca z listy", "driverId", "", options) : `<input type="hidden" name="driverId" value="">`}
        ${field("Imię i nazwisko", "signer", "", "text", "required")}
      </div>
      <p class="quiet">Podpis potwierdza, że kierowca zapoznał się ze szkoleniem.</p>
      <canvas id="sign-pad" width="640" height="180" aria-label="Podpis"></canvas>
      <button type="button" class="btn ghost small" data-local="clear-sign">Wyczyść podpis</button>`,
    bind: (root, form) => {
      const canvas = root.querySelector("#sign-pad");
      const ctx = canvas.getContext("2d");
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1c2430";
      let drawing = false;
      let dirty = false;
      const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (event.clientX - rect.left) * (canvas.width / rect.width),
          y: (event.clientY - rect.top) * (canvas.height / rect.height)
        };
      };
      canvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        const p = point(event);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drawing) return;
        const p = point(event);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        dirty = true;
      });
      canvas.addEventListener("pointerup", () => { drawing = false; });
      canvas.addEventListener("pointercancel", () => { drawing = false; });
      pad = {
        isDirty: () => dirty,
        clear() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          dirty = false;
        },
        data: () => canvas.toDataURL("image/png")
      };
      root.addEventListener("click", (event) => {
        if (event.target.closest("[data-local=clear-sign]")) pad.clear();
      });
      form.driverId?.addEventListener("change", () => {
        const driver = getState().companies.flatMap((company) => company.drivers).find((item) => item.id === form.driverId.value);
        if (driver) form.signer.value = driver.name;
      });
    },
    onSubmit: (form) => {
      const name = form.signer.value.trim();
      if (!name) return fail(form, "Wpisz imię i nazwisko.");
      if (!pad?.isDirty()) return fail(form, "Złóż podpis w polu na dole.");
      const data = new FormData(form);
      const answers = {};
      for (const question of training.questions) {
        const value = data.get(`q-${question.id}`);
        if (value !== "yes" && value !== "no") return fail(form, "Odpowiedz na wszystkie pytania.");
        answers[question.id] = value;
      }
      let driverId = form.querySelector("[name=driverId]")?.value || "";
      let companyId = "";
      if (!driverId) {
        const match = getState().companies.flatMap((company) => company.drivers.map((driver) => ({ driver, company }))).find((item) => item.driver.name.toLowerCase() === name.toLowerCase());
        if (match) {
          driverId = match.driver.id;
          companyId = match.company.id;
        }
      }
      if (!companyId) {
        companyId = training.shares.find((share) => share.driverId && share.driverId === driverId)?.companyId
          || training.shares.find((share) => !share.driverId)?.companyId
          || training.shares[0]?.companyId
          || "";
      }
      const saved = update((state) => {
        const item = state.trainings.find((row) => row.id === training.id);
        item.signatures.push({
          id: uid("sig"),
          companyId,
          driverId,
          name,
          signedAt: new Date().toISOString(),
          signature: pad.data(),
          answers
        });
      });
      if (!saved) return false;
      toast("Podpis zapisany");
    }
  });
}

function openCompanyModal(companyId = "") {
  const existing = companyId ? findCompany(companyId) : null;
  openModal({
    title: existing ? "Nazwa firmy" : "Nowa firma",
    body: `<div class="form-grid">
      ${field("Nazwa", "name", existing?.name || "", "text", "required")}
      ${existing && getState().companies.length > 1 ? `<div class="span-2"><button type="button" class="btn ghost danger" data-local="delete-company">Usuń firmę</button></div>` : ""}
    </div>`,
    bind: (root) => {
      root.addEventListener("click", (event) => {
        if (!event.target.closest("[data-local=delete-company]") || !existing) return;
        const count = existing.vehicles.length;
        const message = count
          ? `Usunąć ${existing.name} razem z ${count} autami?`
          : `Usunąć ${existing.name}?`;
        if (!confirm(message)) return;
        const saved = update((state) => {
          state.companies = state.companies.filter((company) => company.id !== existing.id);
          state.trainings.forEach((training) => {
            training.shares = training.shares.filter((share) => share.companyId !== existing.id);
          });
        });
        if (saved) {
          closeModal();
          location.hash = "#/home";
          toast("Firma usunięta");
        }
      });
    },
    onSubmit: (form) => {
      const name = form.querySelector("[name=name]").value.trim();
      if (!name) return fail(form, "Wpisz nazwę.");
      if (existing) {
        const saved = update((state) => {
          state.companies.find((company) => company.id === existing.id).name = name;
        });
        if (!saved) return false;
        toast("Nazwa zmieniona");
        return;
      }
      let id = "";
      const saved = update((state) => {
        const used = new Set(state.companies.map((company) => company.color));
        const palette = ["#1a6b63", "#b45309", "#1d4e89", "#6d28a8", "#9f1239", "#3f6212", "#0f766e", "#9a3412"];
        const company = {
          id: uid("c"),
          name,
          color: palette.find((color) => !used.has(color)) || palette[state.companies.length % palette.length],
          vehicles: [],
          drivers: [],
          checks: [],
          damages: [],
          reservations: [],
          brakes: [],
          exclusions: [],
          notes: [],
          money: [],
          documents: []
        };
        id = company.id;
        state.companies.push(company);
      });
      if (!saved) return false;
      location.hash = `#/c/${id}/vehicles`;
      toast("Firma dodana");
    }
  });
}
