
const LEVEL_LABEL = { over: "Po terminie", today: "Dziś", soon: "Wkrótce", info: "Info", ok: "Termin" };

function plate(reg, status = "active") {
  return `<span class="plate ${status === "sold" ? "sold" : ""}"><i>UK</i><b>${esc(reg)}</b></span>`;
}

function head(title, text, actions = "") {
  return `<div class="page-head"><div><h1>${title}</h1>${text ? `<p>${text}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
}

function empty(title, text, action = "") {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;
}

function btn(action, label, attrs = "", kind = "primary") {
  return `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs}>${label}</button>`;
}

function rangeFor(period, cursor) {
  if (period === "day") return { start: cursor, end: cursor, days: [cursor] };
  if (period === "week") {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
    return { start, end: days[6], days };
  }
  const date = cursor.split("-").map(Number);
  const start = `${date[0]}-${String(date[1]).padStart(2, "0")}-01`;
  const last = new Date(date[0], date[1], 0).getDate();
  const end = `${date[0]}-${String(date[1]).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end, days: monthMatrix(cursor) };
}

function eventCard(event) {
  return `<a class="event level-${event.level}" style="--co:${event.color}" href="#/c/${encodeURIComponent(event.companyId)}/${event.href || "vehicles"}" ${event.vehicleId ? `data-highlight="${esc(event.vehicleId)}"` : ""}>
    <span class="kicker">${esc(event.kind)}</span>
    <strong>${esc(event.title)}</strong>
    <em>${esc(event.detail)}</em>
  </a>`;
}

function calendarHtml(events, period, days, monthStart) {
  const byDate = new Map();
  for (const event of events) {
    if (!byDate.has(event.date)) byDate.set(event.date, []);
    byDate.get(event.date).push(event);
  }
  if (period === "month") {
    const names = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];
    const month = monthStart.slice(0, 7);
    return `<div class="month">
      <div class="month-names">${names.map((name) => `<span>${name}</span>`).join("")}</div>
      <div class="month-grid">
        ${days.map((day) => {
          const list = byDate.get(day) || [];
          const shown = list.slice(0, 3);
          const weekend = [0, 6].includes(new Date(day + "T12:00:00").getDay());
          return `<div class="${cls("mday", day === todayISO() && "today", !day.startsWith(month) && "outside", weekend && "weekend")}">
            <button type="button" data-action="goto-day" data-date="${day}">${Number(day.slice(-2))}</button>
            ${shown.map(eventCard).join("")}
            ${list.length > 3 ? `<button type="button" class="more" data-action="goto-day" data-date="${day}">+${list.length - 3}</button>` : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  if (period === "day") {
    const list = byDate.get(days[0]) || [];
    return `<div class="day-list">${list.length ? list.map(eventCard).join("") : `<p class="quiet">Brak terminów w tym dniu.</p>`}</div>`;
  }
  return `<div class="week">
    ${days.map((day) => {
      const list = byDate.get(day) || [];
      const weekend = [0, 6].includes(new Date(day + "T12:00:00").getDay());
      return `<section class="${cls("wday", day === todayISO() && "today", weekend && "weekend")}">
        <header><span>${weekday(day)}</span><strong>${Number(day.slice(-2))}</strong></header>
        ${list.map(eventCard).join("") || `<p class="quiet">—</p>`}
      </section>`;
    }).join("")}
  </div>`;
}

function schedule(state, companyId) {
  const today = todayISO();
  const locked = Boolean(companyId);
  const filter = locked ? companyId : ui.filter;
  const { start, end, days } = rangeFor(ui.period, ui.cursor);
  const events = buildEvents(state, start, end, filter, today);
  const attention = buildAttention(state, filter, today);
  const windows = activeWindows(state, start, end, filter);
  const stats = dailyStats(state, filter, today);
  const counts = {
    over: attention.filter((item) => item.level === "over").length,
    today: attention.filter((item) => item.level === "today").length,
    soon: attention.filter((item) => item.level === "soon").length
  };
  const chips = locked ? "" : `<div class="chips">
    <button type="button" class="${ui.filter === "all" ? "on" : ""}" data-action="filter-company" data-id="all">Wszystkie</button>
    ${state.companies.map((company) => `<button type="button" class="${ui.filter === company.id ? "on" : ""}" data-action="filter-company" data-id="${esc(company.id)}"><i style="background:${company.color}"></i>${esc(company.name)}</button>`).join("")}
  </div>`;
  return `${head(locked ? "Terminarz" : "Widok główny", locked ? "Terminy tej firmy." : "Zbiorczo ze wszystkich firm. Wybierz dzień, tydzień albo miesiąc.", "")}
    <div class="cal-bar">
      <div class="seg">
        ${[["day", "Dzień"], ["week", "Tydzień"], ["month", "Miesiąc"]].map(([id, label]) => `<button type="button" class="${ui.period === id ? "on" : ""}" data-action="set-period" data-period="${id}">${label}</button>`).join("")}
      </div>
      <div class="cal-nav">
        <button type="button" class="btn ghost" data-action="shift" data-dir="-1" aria-label="Poprzedni okres">‹</button>
        <strong>${esc(prettyRange(start, end))}</strong>
        <button type="button" class="btn ghost" data-action="shift" data-dir="1" aria-label="Następny okres">›</button>
        <button type="button" class="btn ghost" data-action="today">Dziś</button>
      </div>
    </div>
    ${chips}
    <div class="stats">
      <article class="stat over ${counts.over ? "" : "zero"}"><span>Po terminie</span><strong>${counts.over}</strong></article>
      <article class="stat today ${counts.today ? "" : "zero"}"><span>Na dziś</span><strong>${counts.today}</strong></article>
      <article class="stat soon ${counts.soon ? "" : "zero"}"><span>Najbliższe 30 dni</span><strong>${counts.soon}</strong></article>
      <article class="stat info ${stats.done < stats.active ? "" : "zero"}"><span>Daily check dziś</span><strong>${stats.done}/${stats.active}</strong>${stats.defects ? `<em>${stats.defects} z usterką</em>` : ""}</article>
    </div>
    ${windows.map((item) => `<div class="banner" style="--co:${item.color}">${plate(item.reg)} <span>okno MOT ${esc(formatPL(item.start))}–${esc(formatPL(item.end))} · preparing · ${esc(item.company)}</span></div>`).join("")}
    <div class="layout">
      <div class="cal">${calendarHtml(events, ui.period, days, start)}</div>
      <aside class="rail">
        <h2>Do zrobienia</h2>
        ${attention.length ? attention.map((item) => `<a class="attn level-${item.level}" href="#/c/${encodeURIComponent(item.companyId)}/${item.href}" ${item.vehicleId ? `data-highlight="${esc(item.vehicleId)}"` : ""}>
          <span>${LEVEL_LABEL[item.level]}</span>
          <strong>${esc(item.title)}</strong>
          <em>${esc(item.detail)}</em>
        </a>`).join("") : `<p class="quiet">Brak pilnych terminów.</p>`}
      </aside>
    </div>
    ${locked ? "" : `<p class="footnote">Dane startowe pochodzą z arkusza Alessio Ltd. Następne PMI bez wpisanego terminu liczy się jako 6 tygodni od ostatniego Y.</p>`}`;
}

function viewVehicles(company) {
  const today = todayISO();
  if (!company.vehicles.length) {
    return `${head("Lista aut", "Rejestracja, MOT, tachograf i PMI.", btn("add-vehicle", "Dodaj auto", `data-company="${esc(company.id)}"`))}
      ${empty("Brak aut", "Dodaj pierwszy pojazd, żeby prowadzić terminy tak jak w arkuszu.", "")}`;
  }
  const slots = Math.max(3, ...company.vehicles.map((vehicle) => vehicle.pmi.length));
  const rows = [
    ["OL", (vehicle) => vehicle.olDate ? `<div class="cell-date">${formatPL(vehicle.olDate)}</div>` : "—"],
    ["MOT", (vehicle) => vehicle.motDate ? `<div class="cell-date">${formatPL(vehicle.motDate)}</div>` : "—"],
    ["NEXT MOT", (vehicle) => `${vehicle.nextMot ? `<div>${esc(vehicle.nextMot)}</div>` : "—"}${vehicle.preparing ? `<span class="tag">preparing</span>` : ""}`],
    ["TAX ROAD", (vehicle) => vehicle.taxDate ? `<div class="cell-date">${formatPL(vehicle.taxDate)}</div>` : "—"],
    ["TACHO CALIBRATION", (vehicle) => vehicle.tachoCal ? `<div class="cell-date">${formatPL(vehicle.tachoCal)}</div>` : "—"],
    ["DATE OF EXPIRY", (vehicle) => {
      const date = vehicle.tachoExpiry ? `<div class="cell-date">${formatPL(vehicle.tachoExpiry)}</div>` : "—";
      return `${date}${vehicle.tachoNote ? `<div class="cell-note">${esc(vehicle.tachoNote)}</div>` : ""}`;
    }]
  ];
  const body = rows.map(([label, render]) => `<tr><th>${label}</th>${company.vehicles.map((vehicle) => {
    const tone = label === "MOT" ? motTone(vehicle, today) : label === "DATE OF EXPIRY" ? dateTone(vehicle.tachoExpiry, today, 60) : label === "TAX ROAD" ? dateTone(vehicle.taxDate, today, 30) : "";
    return `<td class="${cls(vehicle.status === "sold" && "is-sold", tone)}">${render(vehicle)}</td>`;
  }).join("")}</tr>`).join("");
  const pmiRows = Array.from({ length: slots }, (_, index) => `<tr><th>PMI / BT</th>${company.vehicles.map((vehicle) => {
    const row = vehicle.pmi[index];
    if (!row) return `<td class="${vehicle.status === "sold" ? "is-sold" : ""}">—</td>`;
    return `<td class="${cls(vehicle.status === "sold" && "is-sold", pmiCellTone(row, vehicle, today))}">
      ${row.date ? `<div class="cell-date">${formatPL(row.date)}</div>` : ""}
      ${row.note ? `<div class="cell-note">${esc(row.note)}</div>` : ""}
      ${row.date ? `<label class="yflag"><input type="checkbox" data-action="toggle-pmi" data-company="${esc(company.id)}" data-vehicle="${esc(vehicle.id)}" data-pmi="${esc(row.id)}" ${row.done ? "checked" : ""}> Y</label>` : ""}
      ${!row.date && !row.note ? "—" : ""}
    </td>`;
  }).join("")}</tr>`).join("");
  const nextRow = `<tr><th>Następne PMI</th>${company.vehicles.map((vehicle) => {
    const plan = pmiPlan(vehicle, today);
    if (!plan.next) return `<td class="${vehicle.status === "sold" ? "is-sold" : ""}">—</td>`;
    const tone = plan.status === "overdue" ? "tone-over" : plan.status === "today" || plan.status === "soon" ? "tone-soon" : "";
    const hint = plan.computed ? `<div class="hint">+6 tyg. od ${formatPL(plan.next.from)}</div>` : plan.status === "overdue" ? `<div class="hint">po terminie</div>` : plan.status === "today" ? `<div class="hint">dziś</div>` : "";
    return `<td class="${cls(vehicle.status === "sold" && "is-sold", tone)}"><div class="cell-date">${formatPL(plan.next.date)}</div>${hint}</td>`;
  }).join("")}</tr>`;
  const notes = `<tr><th>Uwagi</th>${company.vehicles.map((vehicle) => `<td class="${vehicle.status === "sold" ? "is-sold" : ""}">${vehicle.notes ? `<div class="cell-note">${esc(vehicle.notes)}</div>` : "—"}</td>`).join("")}</tr>`;
  const sold = company.vehicles.filter((vehicle) => vehicle.status === "sold").length;
  const soldLabel = sold === 1 ? "1 sprzedany" : sold ? `${sold} sprzedane` : "";
  return `${head("Lista aut", `${company.vehicles.length} pojazdów${soldLabel ? ` · ${soldLabel}` : ""}. Auta w kolumnach, terminy w wierszach.`, btn("add-vehicle", "Dodaj auto", `data-company="${esc(company.id)}"`))}
    <div class="sheet-wrap">
      <table class="sheet">
        <thead><tr><th></th>${company.vehicles.map((vehicle) => `<th class="${cls(vehicle.status === "sold" && "is-sold", ui.highlight === vehicle.id && "is-flash")}" data-vehicle-col="${esc(vehicle.id)}">
          ${plate(vehicle.reg, vehicle.status)}
          <div class="vstatus">${esc(STATUS_LABEL[vehicle.status] || vehicle.status)}</div>
          <button type="button" class="linkish" data-action="edit-vehicle" data-company="${esc(company.id)}" data-id="${esc(vehicle.id)}">Edytuj</button>
        </th>`).join("")}</tr></thead>
        <tbody>${body}${pmiRows}${nextRow}${notes}</tbody>
      </table>
    </div>
    <div class="sheet-foot">${esc(company.name)}</div>
    <ul class="legend">
      <li><i class="swatch soon"></i> MOT w przygotowaniu albo termin w ciągu 30–45 dni</li>
      <li><i class="swatch done"></i> PMI / BT z Y — zrobione</li>
      <li><i class="swatch over"></i> po terminie</li>
      <li>Następne PMI bez daty w arkuszu: 6 tygodni od ostatniego Y</li>
    </ul>`;
}

function viewDrivers(company) {
  const today = todayISO();
  const action = btn("add-driver", "Dodaj kierowcę", `data-company="${esc(company.id)}"`);
  if (!company.drivers.length) {
    return `${head("Kierowcy", "Imię i nazwisko, telefon, prawo jazdy, karta tachografu i kopie dokumentów.", action)}
      ${empty("Brak kierowców", "Dodaj kierowcę, a potem podepnij skan prawa jazdy albo karty.", "")}`;
  }
  return `${head("Kierowcy", "Daty prawa jazdy i karty wchodzą do terminarza 60 dni przed końcem.", action)}
    <div class="table-wrap"><table class="grid">
      <thead><tr><th>Kierowca</th><th>Telefon</th><th>Prawo jazdy</th><th>Karta tacho</th><th>Inna data</th><th>Pliki</th><th></th></tr></thead>
      <tbody>${company.drivers.map((driver) => {
        const files = company.documents.filter((doc) => doc.driverId === driver.id).length;
        return `<tr>
          <td><strong>${esc(driver.name)}</strong>${driver.notes ? `<div class="cell-note">${esc(driver.notes)}</div>` : ""}</td>
          <td>${driver.phone ? `<a href="tel:${esc(driver.phone)}">${esc(driver.phone)}</a>` : "—"}</td>
          <td class="${dateTone(driver.licenceExpiry, today, 60)}">${formatPL(driver.licenceExpiry)}</td>
          <td class="${dateTone(driver.cardExpiry, today, 60)}">${formatPL(driver.cardExpiry)}</td>
          <td class="${dateTone(driver.otherDate, today, 60)}">${driver.otherDate ? `${esc(driver.otherLabel || "Inne")} · ${formatPL(driver.otherDate)}` : "—"}</td>
          <td>${files ? `<button type="button" class="linkish" data-action="show-docs" data-company="${esc(company.id)}" data-driver="${esc(driver.id)}">${files}</button>` : "0"}</td>
          <td class="row-actions">
            <button type="button" class="linkish" data-action="edit-driver" data-company="${esc(company.id)}" data-id="${esc(driver.id)}">Edytuj</button>
            <button type="button" class="linkish" data-action="add-document" data-company="${esc(company.id)}" data-driver="${esc(driver.id)}">Dokument</button>
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
}

function viewDaily(company) {
  if (!company.vehicles.length) {
    return `${head("Daily check", "Codzienny przegląd przed wyjazdem.", "")}
      ${empty("Najpierw dodaj auto", "Daily check przypisuje się do pojazdu z listy aut.", "")}`;
  }
  const day = ui.checkDate || todayISO();
  return `${head("Daily check", longDate(day), `
      <button type="button" class="btn ghost" data-action="check-shift" data-dir="-1">Wczoraj</button>
      <input class="datebox" type="date" value="${esc(day)}" data-action="check-date" aria-label="Data przeglądu">
      <button type="button" class="btn ghost" data-action="check-shift" data-dir="1">Jutro</button>`)}
    <div class="table-wrap"><table class="grid">
      <thead><tr><th>Auto</th><th>Status</th><th>Kierowca</th><th>Uwagi</th><th></th></tr></thead>
      <tbody>${company.vehicles.filter((vehicle) => vehicle.status !== "sold").map((vehicle) => {
        const check = company.checks.find((row) => row.vehicleId === vehicle.id && row.date === day);
        const defect = check && Object.values(check.items).includes("defect");
        const label = !check ? "Brak wpisu" : defect ? "Usterka" : "OK";
        return `<tr>
          <td>${plate(vehicle.reg)}</td>
          <td><span class="pill ${!check ? "wait" : defect ? "bad" : "good"}">${label}</span></td>
          <td>${check ? esc(check.driverName) : "—"}</td>
          <td>${check?.notes ? esc(check.notes) : "—"}</td>
          <td><button type="button" class="btn small" data-action="edit-check" data-company="${esc(company.id)}" data-vehicle="${esc(vehicle.id)}" data-date="${esc(day)}">${check ? "Popraw" : "Wypełnij"}</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
}

function recordTable(company, kind, columns, renderRow, addLabel, addAction) {
  const rows = company[kind];
  return `${rows.length ? `<div class="table-wrap"><table class="grid"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}<th></th></tr></thead><tbody>
    ${rows.slice().sort((a, b) => (b.date || b.start || "").localeCompare(a.date || a.start || "")).map((row) => `<tr>${renderRow(row)}<td class="row-actions">
      <button type="button" class="linkish" data-action="${addAction}" data-company="${esc(company.id)}" data-id="${esc(row.id)}">Edytuj</button>
      <button type="button" class="linkish danger" data-action="delete-record" data-kind="${kind}" data-company="${esc(company.id)}" data-id="${esc(row.id)}">Usuń</button>
    </td></tr>`).join("")}
  </tbody></table></div>` : `<p class="quiet">Brak wpisów.</p>`}
  <div class="section-actions">${btn(addAction, addLabel, `data-company="${esc(company.id)}"`, "ghost")}</div>`;
}

function viewPmi(company) {
  const today = todayISO();
  const upcoming = company.vehicles.filter((vehicle) => vehicle.status !== "sold").map((vehicle) => ({ vehicle, plan: pmiPlan(vehicle, today) })).filter((item) => item.plan.next);
  return `${head("Szkody / PMI", "Rezerwacje warsztatu, szkody i najbliższe PMI.", "")}
    <section class="block"><h2>Najbliższe PMI</h2>
      ${upcoming.length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>Auto</th><th>Data</th><th>Stan</th></tr></thead><tbody>
        ${upcoming.map(({ vehicle, plan }) => `<tr>
          <td>${plate(vehicle.reg, vehicle.status)}</td>
          <td class="${plan.status === "overdue" ? "tone-over" : plan.status === "soon" || plan.status === "today" ? "tone-soon" : ""}">${formatPL(plan.next.date)}${plan.computed ? ` <span class="hint">+6 tyg.</span>` : ""}</td>
          <td>${plan.status === "overdue" ? "Po terminie" : plan.status === "today" ? "Dziś" : plan.status === "soon" ? "Wkrótce" : "Zaplanowane"}</td>
        </tr>`).join("")}
      </tbody></table></div>` : `<p class="quiet">Brak aktywnych aut.</p>`}
    </section>
    <section class="block"><h2>Rezerwacje</h2>
      ${recordTable(company, "reservations", ["Data", "Auto", "Rodzaj", "Miejsce", "Notatka"], (row) => `<td>${formatPL(row.date)}</td><td>${esc(regOf(company, row.vehicleId))}</td><td>${esc(row.kind)}</td><td>${esc(row.place) || "—"}</td><td>${esc(row.note) || "—"}</td>`, "Dodaj rezerwację", "edit-reservation")}
    </section>
    <section class="block"><h2>Szkody</h2>
      ${recordTable(company, "damages", ["Data", "Auto", "Opis", "Status"], (row) => `<td>${formatPL(row.date)}</td><td>${esc(regOf(company, row.vehicleId))}</td><td>${esc(row.description)}${row.photo ? `<div><a href="${row.photo}" target="_blank" rel="noopener">Zdjęcie</a></div>` : ""}</td><td>${esc({ open: "Otwarta", repair: "W naprawie", closed: "Zamknięta" }[row.status] || row.status)}</td>`, "Dodaj szkodę", "edit-damage")}
    </section>`;
}

function viewBrakes(company) {
  return `${head("Brake test", "Wynik z rolek albo decelerometru. Fail zostaje na liście, dopóki nie ma późniejszego pass.", "")}
    ${recordTable(company, "brakes", ["Data", "Auto", "Wynik", "Metoda", "Odczyt", "Notatka"], (row) => `<td>${formatPL(row.date)}</td><td>${esc(regOf(company, row.vehicleId))}</td><td><span class="pill ${row.result === "fail" ? "bad" : "good"}">${row.result === "fail" ? "Fail" : "Pass"}</span></td><td>${row.method === "decel" ? "Decelerometr" : "Rolki"}</td><td>${esc(row.reading) || "—"}</td><td>${esc(row.notes) || "—"}</td>`, "Dodaj brake test", "edit-brake")}`;
}

function viewTacho(company, today) {
  return `${head("Tachograf", "Kalibracja, ważność, wyłączenia i inne wpisy.", "")}
    <section class="block"><h2>Kalibracje</h2>
      ${company.vehicles.length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>Auto</th><th>Kalibracja</th><th>Ważność</th><th>Notatka</th></tr></thead><tbody>
        ${company.vehicles.map((vehicle) => `<tr>
          <td>${plate(vehicle.reg, vehicle.status)}</td>
          <td>${formatPL(vehicle.tachoCal)}</td>
          <td class="${dateTone(vehicle.tachoExpiry, today, 60)}">${formatPL(vehicle.tachoExpiry)}</td>
          <td>${esc(vehicle.tachoNote) || "—"}</td>
        </tr>`).join("")}
      </tbody></table></div>` : `<p class="quiet">Brak aut.</p>`}
      <p class="footnote">Daty zmienisz w liście aut. Ważność w arkuszu to kalibracja plus 2 lata.</p>
    </section>
    <section class="block"><h2>Wyłączenia</h2>
      ${recordTable(company, "exclusions", ["Od", "Do", "Auto", "Powód"], (row) => `<td>${formatPL(row.start)}</td><td>${formatPL(row.end)}</td><td>${esc(regOf(company, row.vehicleId))}</td><td>${esc(row.reason)}</td>`, "Dodaj wyłączenie", "edit-exclusion")}
    </section>
    <section class="block"><h2>Inne</h2>
      ${recordTable(company, "notes", ["Data", "Auto", "Treść"], (row) => `<td>${formatPL(row.date)}</td><td>${row.vehicleId ? esc(regOf(company, row.vehicleId)) : "—"}</td><td>${esc(row.text)}</td>`, "Dodaj wpis", "edit-note")}
    </section>`;
}

function viewMoney(company) {
  const month = todayISO().slice(0, 7);
  const total = company.money.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const monthTotal = company.money.filter((row) => (row.date || "").startsWith(month)).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return `${head("Pieniądze", `Ten miesiąc ${gbp(monthTotal)} · razem ${gbp(total)}`, "")}
    ${recordTable(company, "money", ["Data", "Auto", "Kategoria", "Kwota", "Notatka"], (row) => `<td>${formatPL(row.date)}</td><td>${row.vehicleId ? esc(regOf(company, row.vehicleId)) : "—"}</td><td>${esc(row.category)}</td><td>${gbp(row.amount)}</td><td>${esc(row.note) || "—"}</td>`, "Dodaj wydatek", "edit-money")}`;
}

function viewDocs(company) {
  let docs = company.documents;
  if (ui.docDriver) docs = docs.filter((doc) => doc.driverId === ui.docDriver);
  if (ui.docVehicle) docs = docs.filter((doc) => doc.vehicleId === ui.docVehicle);
  const driver = company.drivers.find((item) => item.id === ui.docDriver);
  const vehicle = company.vehicles.find((item) => item.id === ui.docVehicle);
  const filter = driver || vehicle ? `<p class="filterline">Filtr: ${esc(driver?.name || vehicle?.reg || "")} <button type="button" class="linkish" data-action="clear-doc-filter">Pokaż wszystkie</button></p>` : "";
  return `${head("Dokumenty", "Zdjęcia, naklejki, licencja, tachograf i kopie dokumentów kierowców.", btn("add-document", "Dodaj dokument", `data-company="${esc(company.id)}"`))}
    ${filter}
    ${docs.length ? `<div class="docs">${docs.map((doc) => `<article class="doc">
      ${doc.mime?.startsWith("image/") ? `<a href="${doc.dataUrl}" target="_blank" rel="noopener"><img src="${doc.dataUrl}" alt=""></a>` : `<div class="filechip">${doc.mime === "application/pdf" ? "PDF" : "PLIK"}</div>`}
      <strong>${esc(doc.name || "Dokument")}</strong>
      <span>${esc(doc.category || "Inne")}${doc.vehicleId ? ` · ${esc(regOf(company, doc.vehicleId))}` : ""}${doc.driverId ? ` · ${esc(company.drivers.find((item) => item.id === doc.driverId)?.name || "")}` : ""}</span>
      <div class="row-actions"><a download="${esc(doc.name || "dokument")}" href="${doc.dataUrl}">Pobierz</a>
        <button type="button" class="linkish danger" data-action="delete-record" data-kind="documents" data-company="${esc(company.id)}" data-id="${esc(doc.id)}">Usuń</button></div>
    </article>`).join("")}</div>` : empty("Brak dokumentów", "Dodaj zdjęcie naklejki, skan licencji albo kopię dokumentu kierowcy.", "")}`;
}

function viewMe(state) {
  const gaps = openTrainingCount(state);
  return `${head("Ja — szkolenia", "Szkolenie udostępniasz firmie albo kierowcy. Kierowca odpowiada na pytania i zostawia podpis, że się zapoznał.", btn("edit-training", "Nowe szkolenie"))}
    <p class="footnote">${gaps ? `${gaps} ${gaps === 1 ? "szkolenie czeka" : "szkolenia czekają"} na podpis.` : "Wszystkie udostępnione szkolenia mają podpisy."}</p>
    <div class="stack">
      ${state.trainings.length ? state.trainings.map((training) => {
        const shares = training.shares.map((share) => {
          const company = state.companies.find((item) => item.id === share.companyId);
          const driver = company?.drivers.find((item) => item.id === share.driverId);
          return driver ? `${company?.name || "Firma"} · ${driver.name}` : `${company?.name || "Firma"} · cała firma`;
        }).join(", ");
        return `<article class="card">
          <header><h2>${esc(training.title)}</h2><span class="pill ${trainingNeedsSignature(state, training) ? "wait" : "good"}">${training.signatures.length === 1 ? "1 podpis" : training.signatures.length ? `${training.signatures.length} podpisów` : "Brak podpisu"}</span></header>
          <p>${esc(training.body)}</p>
          ${training.questions.length ? `<ol class="questions">${training.questions.map((question) => `<li>${esc(question.text)}</li>`).join("")}</ol>` : ""}
          <p class="quiet">${shares ? `Udostępnione: ${esc(shares)}` : "Jeszcze nikomu nieudostępnione."}</p>
          <div class="sigs">${training.signatures.map((signature) => `<figure>
            <img src="${signature.signature}" alt="Podpis ${esc(signature.name)}">
            <figcaption>${esc(signature.name)} · ${esc(signature.signedAt.replace("T", " ").slice(0, 16))}</figcaption>
            <button type="button" class="linkish danger" data-action="delete-signature" data-training="${esc(training.id)}" data-id="${esc(signature.id)}">Usuń podpis</button>
          </figure>`).join("")}</div>
          <div class="actions">
            <button type="button" class="btn" data-action="sign-training" data-id="${esc(training.id)}">Wypełnij i podpisz</button>
            <button type="button" class="btn ghost" data-action="edit-training" data-id="${esc(training.id)}">Edytuj</button>
            <button type="button" class="btn ghost danger" data-action="delete-training" data-id="${esc(training.id)}">Usuń</button>
          </div>
        </article>`;
      }).join("") : empty("Brak szkoleń", "Utwórz pierwsze szkolenie i udostępnij je firmie.", "")}
    </div>
    <section class="block">
      <h2>Kopia danych</h2>
      <p>Wszystko zostaje w tej przeglądarce. Eksport zapisz sobie na dysk, zanim wyczyścisz historię przeglądarki.</p>
      <div class="actions">
        <button type="button" class="btn" data-action="export-data">Eksportuj kopię</button>
        <button type="button" class="btn ghost" data-action="import-data">Importuj kopię</button>
        <button type="button" class="btn ghost danger" data-action="reset-data">Przywróć dane z arkusza</button>
        <input id="import-file" type="file" accept="application/json" hidden>
      </div>
    </section>`;
}

function renderShell(state, route) {
  const company = route.name === "company" ? state.companies.find((item) => item.id === route.companyId) : null;
  const openTrainings = openTrainingCount(state);
  let main = "";
  if (route.name === "home") main = schedule(state, null);
  else if (route.name === "me") main = viewMe(state);
  else if (!company) main = empty("Nie ma takiej firmy", "Wróć do widoku głównego.", `<a class="btn" href="#/home">Widok główny</a>`);
  else if (route.sub === "vehicles") main = viewVehicles(company);
  else if (route.sub === "drivers") main = viewDrivers(company);
  else if (route.sub === "daily") main = viewDaily(company);
  else if (route.sub === "calendar") main = schedule(state, company.id);
  else if (route.sub === "pmi") main = viewPmi(company);
  else if (route.sub === "brakes") main = viewBrakes(company);
  else if (route.sub === "tacho") main = viewTacho(company, todayISO());
  else if (route.sub === "money") main = viewMoney(company);
  else main = viewDocs(company);

  const subnav = company ? `<nav class="subnav">${SUBS.map(([id, label]) => `<a class="${route.sub === id ? "active" : ""}" href="#/c/${encodeURIComponent(company.id)}/${id}">${label}</a>`).join("")}</nav>` : "";
  const crumb = route.name === "home" ? "Wszystkie firmy" : route.name === "me" ? "Szkolenia i kopia danych" : company ? company.name : "";

  return `<div class="app">
    <header class="top">
      <div class="brand">
        <span class="plate brand-plate"><i>UK</i><b>TM</b></span>
        <div><strong>Transport Manager</strong><span>${esc(crumb)}</span></div>
      </div>
      <time datetime="${todayISO()}">${esc(longDate(todayISO()))}</time>
    </header>
    <nav class="tabs">
      <div class="tab ${route.name === "home" ? "active" : ""}"><a href="#/home">Widok główny</a></div>
      <div class="tab ${route.name === "me" ? "active" : ""}"><a href="#/me">Ja</a>${openTrainings ? `<em class="badge">${openTrainings}</em>` : ""}</div>
      ${state.companies.map((item) => `<div class="tab ${company?.id === item.id ? "active" : ""}">
        <a href="${companyHref(item.id)}"><i class="dot" style="background:${item.color}"></i>${esc(item.name)}</a>
        <button type="button" class="icon-btn" data-action="rename-company" data-id="${esc(item.id)}" aria-label="Zmień nazwę ${esc(item.name)}">✎</button>
      </div>`).join("")}
      <button type="button" class="tab add" data-action="add-company">+ Firma</button>
    </nav>
    ${subnav}
    <main>${main}</main>
    <footer class="foot">Zapis lokalny w tej przeglądarce. Kopia JSON jest w zakładce Ja.</footer>
  </div>`;
}
