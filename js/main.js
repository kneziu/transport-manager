
const KINDS = new Set(["damages", "reservations", "brakes", "exclusions", "notes", "money", "documents", "checks"]);

function render() {
  const state = getState();
  const route = parseRoute();
  rememberRoute(route);
  document.getElementById("app").innerHTML = renderShell(state, route);
  const titles = { home: "Widok główny", me: "Ja" };
  const company = route.name === "company" ? state.companies.find((item) => item.id === route.companyId) : null;
  document.title = `${titles[route.name] || company?.name || "Transport Manager"} · Transport Manager`;
  if (ui.highlight) {
    document.querySelector(`[data-vehicle-col="${CSS.escape(ui.highlight)}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

function shiftCursor(dir) {
  if (ui.period === "month") {
    const current = new Date(`${ui.cursor}T12:00:00`);
    ui.cursor = toISO(new Date(current.getFullYear(), current.getMonth() + dir, 1));
    return;
  }
  ui.cursor = addDaysISO(ui.cursor, dir * (ui.period === "week" ? 7 : 1));
}

function companyFrom(button) {
  return findCompany(button.dataset.company);
}

subscribe(render);
window.addEventListener("hashchange", () => {
  closeModal();
  render();
});

document.body.addEventListener("click", (event) => {
  if (event.target.closest("#modal-root")) return;
  const highlight = event.target.closest("[data-highlight]");
  if (highlight) ui.highlight = highlight.dataset.highlight;
  const link = event.target.closest("a[href^='#']");
  if (link?.closest("nav.subnav")) {
    ui.docDriver = "";
    ui.docVehicle = "";
  }
  const button = event.target.closest("[data-action]");
  if (!button || event.target.closest(".yflag")) {
    if (link && link.getAttribute("href") === location.hash) render();
    return;
  }
  const action = button.dataset.action;
  const company = companyFrom(button);
  if (action === "set-period") ui.period = button.dataset.period;
  else if (action === "shift") shiftCursor(Number(button.dataset.dir));
  else if (action === "today") ui.cursor = todayISO();
  else if (action === "goto-day") {
    ui.period = "day";
    ui.cursor = button.dataset.date;
  } else if (action === "filter-company") ui.filter = button.dataset.id;
  else if (action === "check-shift") ui.checkDate = addDaysISO(ui.checkDate || todayISO(), Number(button.dataset.dir));
  else if (action === "add-vehicle") openVehicleModal(button.dataset.company);
  else if (action === "edit-vehicle") openVehicleModal(button.dataset.company, button.dataset.id);
  else if (action === "add-driver") openDriverModal(button.dataset.company);
  else if (action === "edit-driver") openDriverModal(button.dataset.company, button.dataset.id);
  else if (action === "edit-check") openCheckModal(button.dataset.company, button.dataset.vehicle, button.dataset.date);
  else if (action === "edit-damage") openDamageModal(button.dataset.company, button.dataset.id || "");
  else if (action === "edit-reservation") openReservationModal(button.dataset.company, button.dataset.id || "");
  else if (action === "edit-brake") openBrakeModal(button.dataset.company, button.dataset.id || "");
  else if (action === "edit-exclusion") openExclusionModal(button.dataset.company, button.dataset.id || "");
  else if (action === "edit-note") openNoteModal(button.dataset.company, button.dataset.id || "");
  else if (action === "edit-money") openMoneyModal(button.dataset.company, button.dataset.id || "");
  else if (action === "add-document") openDocumentModal(button.dataset.company, { driverId: button.dataset.driver || "", vehicleId: button.dataset.vehicle || "" });
  else if (action === "edit-training") openTrainingModal(button.dataset.id || "");
  else if (action === "sign-training") openSignModal(button.dataset.id);
  else if (action === "show-docs") {
    ui.docDriver = button.dataset.driver || "";
    ui.docVehicle = button.dataset.vehicle || "";
    const hash = `#/c/${encodeURIComponent(button.dataset.company)}/docs`;
    if (location.hash === hash) render();
    else location.hash = hash;
    return;
  } else if (action === "clear-doc-filter") {
    ui.docDriver = "";
    ui.docVehicle = "";
  } else if (action === "rename-company") openCompanyModal(button.dataset.id);
  else if (action === "add-company") openCompanyModal();
  else if (action === "delete-training") {
    const training = getState().trainings.find((item) => item.id === button.dataset.id);
    if (!training || !confirm(`Usunąć szkolenie „${training.title}”?`)) return;
    update((state) => {
      state.trainings = state.trainings.filter((item) => item.id !== training.id);
    });
    toast("Szkolenie usunięte");
    return;
  } else if (action === "delete-signature") {
    if (!confirm("Usunąć ten podpis?")) return;
    update((state) => {
      const training = state.trainings.find((item) => item.id === button.dataset.training);
      training.signatures = training.signatures.filter((item) => item.id !== button.dataset.id);
    });
    toast("Podpis usunięty");
    return;
  } else if (action === "delete-record") {
    if (!KINDS.has(button.dataset.kind) || !confirm("Usunąć ten wpis?")) return;
    update((state) => {
      const firm = state.companies.find((item) => item.id === button.dataset.company);
      firm[button.dataset.kind] = firm[button.dataset.kind].filter((item) => item.id !== button.dataset.id);
    });
    toast("Usunięte");
    return;
  } else if (action === "export-data") {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transport-manager-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  } else if (action === "import-data") {
    document.getElementById("import-file")?.click();
    return;
  } else if (action === "reset-data") {
    if (!confirm("Przywrócić dane startowe z arkusza Alessio Ltd? Dopiski w tej przeglądarce zostaną usunięte.")) return;
    resetData();
    toast("Przywrócono arkusz");
    return;
  } else return;
  if (!company && action.startsWith("edit-") && action !== "edit-training") return;
  render();
});

document.body.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset?.action === "toggle-pmi") {
    update((state) => {
      const firm = state.companies.find((item) => item.id === input.dataset.company);
      const vehicle = firm?.vehicles.find((item) => item.id === input.dataset.vehicle);
      const row = vehicle?.pmi.find((item) => item.id === input.dataset.pmi);
      if (row) row.done = input.checked;
    });
    toast(input.checked ? "PMI oznaczone jako Y" : "Cofnięte Y");
    return;
  }
  if (input.dataset?.action === "check-date") {
    ui.checkDate = input.value || todayISO();
    render();
    return;
  }
  if (input.id === "import-file" && input.files?.[0]) {
    const file = input.files[0];
    input.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.companies)) throw new Error("zły plik");
        replaceData(data);
        toast("Kopia wczytana");
      } catch {
        toast("Ten plik nie jest kopią Transport Managera.");
      }
    };
    reader.readAsText(file);
  }
});

if (!location.hash) location.hash = "#/home";
render();
closeModal();
