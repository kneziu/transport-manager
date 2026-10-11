
const PMI_WEEKS = 42;
const SOON_PMI = 30;
const SOON_MOT = 45;
const SOON_TAX = 30;
const SOON_TACHO = 60;
const SOON_LICENCE = 60;

function regOf(company, vehicleId) {
  return company.vehicles.find((vehicle) => vehicle.id === vehicleId)?.reg || "Auto";
}

function classifyPmi(vehicle, today) {
  const dated = vehicle.pmi.filter((row) => row.date);
  const lastDone = dated.filter((row) => row.done).map((row) => row.date).sort().at(-1) || "";
  const overdue = dated
    .filter((row) => !row.done && row.date < today && (!lastDone || row.date > lastDone))
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = dated
    .filter((row) => !row.done && row.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { lastDone, overdue, upcoming };
}

function pmiPlan(vehicle, today) {
  if (vehicle.status === "sold") return { next: null, status: "none", computed: false };
  const { overdue, upcoming } = classifyPmi(vehicle, today);
  if (overdue.length) return { next: overdue.at(-1), status: "overdue", computed: false };
  if (upcoming.length) {
    const next = upcoming[0];
    const status = next.date === today ? "today" : diffDays(today, next.date) <= SOON_PMI ? "soon" : "ok";
    return { next, status, computed: false };
  }
  const done = vehicle.pmi.filter((row) => row.date && row.done).sort((a, b) => a.date.localeCompare(b.date));
  if (!done.length) return { next: null, status: "none", computed: false };
  const last = done.at(-1);
  const date = addDaysISO(last.date, PMI_WEEKS);
  const status = date < today ? "overdue" : date === today ? "today" : diffDays(today, date) <= SOON_PMI ? "soon" : "ok";
  return {
    next: { id: `computed-${vehicle.id}`, date, done: false, computed: true, from: last.date },
    status,
    computed: true
  };
}

function pmiCellTone(row, vehicle, today) {
  if (!row?.date) return "";
  if (row.done) return "tone-done";
  const { lastDone } = classifyPmi(vehicle, today);
  if (row.date < today && (!lastDone || row.date > lastDone)) return "tone-over";
  if (row.date >= today && diffDays(today, row.date) <= SOON_PMI) return "tone-soon";
  return "";
}

function motTone(vehicle, today) {
  if (vehicle.status === "sold" || !vehicle.motDate) return "";
  if (vehicle.preparing && vehicle.windowStart && vehicle.windowEnd && today >= vehicle.windowStart && today <= vehicle.windowEnd) {
    return "tone-soon";
  }
  if (vehicle.motDate < today) return "tone-over";
  if (diffDays(today, vehicle.motDate) <= SOON_MOT) return "tone-soon";
  return "";
}

function dateTone(iso, today, soonDays) {
  if (!iso) return "";
  if (iso < today) return "tone-over";
  if (diffDays(today, iso) <= soonDays) return "tone-soon";
  return "";
}

function companiesOf(state, filterId) {
  if (!filterId || filterId === "all") return state.companies;
  return state.companies.filter((company) => company.id === filterId);
}

function levelOf(date, today, soonDays) {
  if (date < today) return "over";
  if (date === today) return "today";
  if (diffDays(today, date) <= soonDays) return "soon";
  return "ok";
}

function buildAttention(state, filterId, today) {
  const items = [];
  for (const company of companiesOf(state, filterId)) {
    for (const vehicle of company.vehicles) {
      if (vehicle.status === "sold") continue;
      const plan = pmiPlan(vehicle, today);
      if (plan.next && ["overdue", "today", "soon"].includes(plan.status)) {
        const level = plan.status === "overdue" ? "over" : plan.status === "today" ? "today" : "soon";
        items.push({
          id: `pmi-${vehicle.id}-${plan.next.date}`,
          level,
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "vehicles",
          date: plan.next.date,
          title: plan.status === "overdue"
            ? `${vehicle.reg} — PMI po terminie`
            : plan.computed
              ? `${vehicle.reg} — PMI należne`
              : `${vehicle.reg} — PMI`,
          detail: plan.computed
            ? `${company.name} · 6 tyg. od ${formatPL(plan.next.from)}`
            : `${company.name} · ${formatPL(plan.next.date)}`
        });
      }
      if (vehicle.preparing && vehicle.windowStart && vehicle.windowEnd && today >= vehicle.windowStart && today <= vehicle.windowEnd) {
        items.push({
          id: `mot-${vehicle.id}`,
          level: "soon",
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "vehicles",
          date: vehicle.motDate || vehicle.windowEnd,
          title: `${vehicle.reg} — MOT ${formatPL(vehicle.motDate)} · preparing`,
          detail: `${company.name} · okno ${formatPL(vehicle.windowStart)}–${formatPL(vehicle.windowEnd)}`
        });
      } else if (vehicle.motDate && (vehicle.motDate < today || diffDays(today, vehicle.motDate) <= SOON_MOT)) {
        items.push({
          id: `mot-${vehicle.id}`,
          level: vehicle.motDate < today ? "over" : vehicle.motDate === today ? "today" : "soon",
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "vehicles",
          date: vehicle.motDate,
          title: `${vehicle.reg} — MOT`,
          detail: `${company.name} · ${formatPL(vehicle.motDate)}`
        });
      }
      if (vehicle.taxDate && (vehicle.taxDate < today || diffDays(today, vehicle.taxDate) <= SOON_TAX)) {
        items.push({
          id: `tax-${vehicle.id}`,
          level: levelOf(vehicle.taxDate, today, SOON_TAX),
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "vehicles",
          date: vehicle.taxDate,
          title: `${vehicle.reg} — podatek drogowy`,
          detail: `${company.name} · ${formatPL(vehicle.taxDate)}`
        });
      }
      const activeNotes = vehicle.pmi.filter((row) => !row.date && row.note && row.active);
      if (activeNotes.length) {
        for (const note of activeNotes) {
          items.push({
            id: `note-${note.id}`,
            level: "info",
            companyId: company.id,
            vehicleId: vehicle.id,
            href: "vehicles",
            date: "",
            title: `${vehicle.reg} — ${note.note}`,
            detail: vehicle.tachoExpiry ? company.name : `${company.name} · brak daty tachografu`
          });
        }
      } else if (!vehicle.tachoExpiry) {
        items.push({
          id: `tacho-missing-${vehicle.id}`,
          level: "soon",
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "tacho",
          date: "",
          title: `${vehicle.reg} — brak ważności tachografu`,
          detail: company.name
        });
      } else if (vehicle.tachoExpiry < today || diffDays(today, vehicle.tachoExpiry) <= SOON_TACHO) {
        items.push({
          id: `tacho-${vehicle.id}`,
          level: levelOf(vehicle.tachoExpiry, today, SOON_TACHO),
          companyId: company.id,
          vehicleId: vehicle.id,
          href: "tacho",
          date: vehicle.tachoExpiry,
          title: `${vehicle.reg} — ważność tachografu`,
          detail: `${company.name} · ${formatPL(vehicle.tachoExpiry)}`
        });
      }
    }
    for (const driver of company.drivers) {
      for (const [field, label] of [["licenceExpiry", "prawo jazdy"], ["cardExpiry", "karta tachografu"], ["otherDate", driver.otherLabel || "termin kierowcy"]]) {
        const date = driver[field];
        if (!date || (date >= today && diffDays(today, date) > SOON_LICENCE)) continue;
        items.push({
          id: `drv-${driver.id}-${field}`,
          level: date < today ? "over" : date === today ? "today" : "soon",
          companyId: company.id,
          vehicleId: "",
          href: "drivers",
          date,
          title: `${driver.name} — ${label}`,
          detail: `${company.name} · ${formatPL(date)}`
        });
      }
    }
    for (const check of company.checks) {
      if (check.date !== today) continue;
      if (!Object.values(check.items).includes("defect")) continue;
      items.push({
        id: `def-${check.id}`,
        level: "today",
        companyId: company.id,
        vehicleId: check.vehicleId,
        href: "daily",
        date: today,
        title: `${regOf(company, check.vehicleId)} — usterka w daily check`,
        detail: check.notes || company.name
      });
    }
    for (const damage of company.damages) {
      if (damage.status === "closed") continue;
      items.push({
        id: `dmg-${damage.id}`,
        level: damage.status === "open" ? "soon" : "info",
        companyId: company.id,
        vehicleId: damage.vehicleId,
        href: "pmi",
        date: damage.date,
        title: `${regOf(company, damage.vehicleId)} — szkoda`,
        detail: damage.description || company.name
      });
    }
    for (const brake of company.brakes) {
      if (brake.result !== "fail") continue;
      const laterPass = company.brakes.some((row) => row.vehicleId === brake.vehicleId && row.result === "pass" && row.date > brake.date);
      if (laterPass) continue;
      items.push({
        id: `bt-${brake.id}`,
        level: "over",
        companyId: company.id,
        vehicleId: brake.vehicleId,
        href: "brakes",
        date: brake.date,
        title: `${regOf(company, brake.vehicleId)} — brake test fail`,
        detail: `${company.name} · ${formatPL(brake.date)}`
      });
    }
  }
  const rank = { over: 0, today: 1, soon: 2, info: 3, ok: 4 };
  return items.sort((a, b) => rank[a.level] - rank[b.level] || (a.date || "9999").localeCompare(b.date || "9999"));
}

function buildEvents(state, start, end, filterId, today) {
  const events = [];
  const push = (event) => {
    if (event.date < start || event.date > end) return;
    events.push(event);
  };
  for (const company of companiesOf(state, filterId)) {
    for (const vehicle of company.vehicles) {
      const base = { companyId: company.id, color: company.color, vehicleId: vehicle.id, reg: vehicle.reg };
      if (vehicle.status !== "sold") {
        const { overdue } = classifyPmi(vehicle, today);
        for (const row of vehicle.pmi) {
          if (!row.date || row.done) continue;
          if (row.date < today && !overdue.some((item) => item.id === row.id)) continue;
          const carried = row.date < start && overdue.some((item) => item.id === row.id) && today >= start && today <= end;
          const date = carried ? today : row.date;
          if (!carried && (date < start || date > end)) continue;
          events.push({
            ...base,
            id: `pmi-${row.id}${carried ? "-carry" : ""}`,
            date,
            kind: "PMI",
            level: carried || date < today ? "over" : date === today ? "today" : diffDays(today, date) <= SOON_PMI ? "soon" : "ok",
            title: carried ? `${vehicle.reg} — zaległe PMI` : `${vehicle.reg} — PMI`,
            detail: carried ? `${company.name} · termin ${formatPL(row.date)}` : company.name,
            href: "vehicles"
          });
        }
        const plan = pmiPlan(vehicle, today);
        if (plan.computed && plan.next) {
          const original = plan.next.date;
          const carried = original < start && today >= start && today <= end;
          const date = carried ? today : original;
          if (date >= start && date <= end) {
            events.push({
              ...base,
              id: `pmi-next-${vehicle.id}`,
              date,
              kind: "PMI",
              level: carried || original < today ? "over" : original === today ? "today" : diffDays(today, original) <= SOON_PMI ? "soon" : "ok",
              title: carried ? `${vehicle.reg} — zaległe PMI` : `${vehicle.reg} — PMI`,
              detail: `${company.name} · 6 tyg. od ${formatPL(plan.next.from)}`,
              href: "vehicles"
            });
          }
        }
        if (vehicle.motDate) {
          push({
            ...base,
            id: `mot-${vehicle.id}`,
            date: vehicle.motDate,
            kind: "MOT",
            level: vehicle.preparing && vehicle.motDate >= today ? "soon" : levelOf(vehicle.motDate, today, SOON_MOT),
            title: `${vehicle.reg} — MOT${vehicle.preparing ? " · preparing" : ""}`,
            detail: company.name,
            href: "vehicles"
          });
        }
        if (vehicle.taxDate) {
          push({
            ...base,
            id: `tax-${vehicle.id}`,
            date: vehicle.taxDate,
            kind: "TAX",
            level: levelOf(vehicle.taxDate, today, SOON_TAX),
            title: `${vehicle.reg} — podatek`,
            detail: company.name,
            href: "vehicles"
          });
        }
        if (vehicle.tachoExpiry) {
          push({
            ...base,
            id: `tacho-${vehicle.id}`,
            date: vehicle.tachoExpiry,
            kind: "TACHO",
            level: levelOf(vehicle.tachoExpiry, today, SOON_TACHO),
            title: `${vehicle.reg} — tachograf`,
            detail: company.name,
            href: "tacho"
          });
        }
      }
      if (vehicle.olDate) {
        push({
          ...base,
          id: `ol-${vehicle.id}`,
          date: vehicle.olDate,
          kind: "OL",
          level: "info",
          title: `${vehicle.reg} — wpis na OL`,
          detail: company.name,
          href: "vehicles"
        });
      }
    }
    for (const reservation of company.reservations) {
      push({
        companyId: company.id,
        color: company.color,
        vehicleId: reservation.vehicleId,
        id: `res-${reservation.id}`,
        date: reservation.date,
        kind: "REZERWACJA",
        level: reservation.date < today ? "info" : levelOf(reservation.date, today, 14),
        title: `${regOf(company, reservation.vehicleId)} — ${reservation.kind || "rezerwacja"}`,
        detail: reservation.place || reservation.note || company.name,
        href: "pmi"
      });
    }
    for (const brake of company.brakes) {
      push({
        companyId: company.id,
        color: company.color,
        vehicleId: brake.vehicleId,
        id: `brake-${brake.id}`,
        date: brake.date,
        kind: "BT",
        level: brake.result === "fail" ? "over" : "ok",
        title: `${regOf(company, brake.vehicleId)} — brake test ${brake.result === "fail" ? "fail" : "pass"}`,
        detail: company.name,
        href: "brakes"
      });
    }
    for (const damage of company.damages) {
      if (!damage.date) continue;
      push({
        companyId: company.id,
        color: company.color,
        vehicleId: damage.vehicleId,
        id: `damage-${damage.id}`,
        date: damage.date,
        kind: "SZKODA",
        level: damage.status === "closed" ? "info" : "soon",
        title: `${regOf(company, damage.vehicleId)} — szkoda`,
        detail: damage.description || company.name,
        href: "pmi"
      });
    }
    for (const exclusion of company.exclusions) {
      if (!exclusion.start || !exclusion.end || exclusion.end < start || exclusion.start > end) continue;
      events.push({
        companyId: company.id,
        color: company.color,
        vehicleId: exclusion.vehicleId,
        id: `ex-${exclusion.id}`,
        date: exclusion.start >= start ? exclusion.start : start,
        kind: "WYŁ.",
        level: "info",
        title: `${regOf(company, exclusion.vehicleId)} — wyłączenie`,
        detail: exclusion.reason || company.name,
        href: "tacho"
      });
    }
    for (const note of company.notes) {
      push({
        companyId: company.id,
        color: company.color,
        vehicleId: note.vehicleId,
        id: `note-${note.id}`,
        date: note.date,
        kind: "INNE",
        level: "info",
        title: note.vehicleId ? `${regOf(company, note.vehicleId)} — notatka` : "Notatka",
        detail: note.text || company.name,
        href: "tacho"
      });
    }
    for (const driver of company.drivers) {
      for (const [field, kind, label] of [["licenceExpiry", "PRAWO JAZDY", "prawo jazdy"], ["cardExpiry", "KARTA", "karta tacho"], ["otherDate", "TERMIN", driver.otherLabel || "termin"]]) {
        if (!driver[field]) continue;
        push({
          companyId: company.id,
          color: company.color,
          vehicleId: "",
          id: `drv-${driver.id}-${field}`,
          date: driver[field],
          kind,
          level: levelOf(driver[field], today, SOON_LICENCE),
          title: `${driver.name} — ${label}`,
          detail: company.name,
          href: "drivers"
        });
      }
    }
  }
  const rank = { over: 0, today: 1, soon: 2, ok: 3, info: 4 };
  return events.sort((a, b) => a.date.localeCompare(b.date) || rank[a.level] - rank[b.level]);
}

function activeWindows(state, start, end, filterId) {
  const windows = [];
  for (const company of companiesOf(state, filterId)) {
    for (const vehicle of company.vehicles) {
      if (vehicle.status === "sold" || !vehicle.preparing || !vehicle.windowStart || !vehicle.windowEnd) continue;
      if (vehicle.windowEnd < start || vehicle.windowStart > end) continue;
      windows.push({
        id: vehicle.id,
        companyId: company.id,
        color: company.color,
        reg: vehicle.reg,
        company: company.name,
        start: vehicle.windowStart,
        end: vehicle.windowEnd,
        mot: vehicle.motDate
      });
    }
  }
  return windows;
}

function dailyStats(state, filterId, day) {
  let active = 0;
  let done = 0;
  let defects = 0;
  for (const company of companiesOf(state, filterId)) {
    for (const vehicle of company.vehicles) {
      if (vehicle.status === "sold") continue;
      active += 1;
      const check = company.checks.find((row) => row.vehicleId === vehicle.id && row.date === day);
      if (!check) continue;
      done += 1;
      if (Object.values(check.items).includes("defect")) defects += 1;
    }
  }
  return { active, done, defects };
}

function trainingNeedsSignature(state, training) {
  if (!training.shares.length) return false;
  return training.shares.some((share) => {
    if (share.driverId) return !training.signatures.some((signature) => signature.driverId === share.driverId);
    const drivers = state.companies.find((company) => company.id === share.companyId)?.drivers || [];
    if (!drivers.length) return !training.signatures.some((signature) => signature.companyId === share.companyId);
    return drivers.some((driver) => !training.signatures.some((signature) => signature.driverId === driver.id));
  });
}

function openTrainingCount(state) {
  return state.trainings.filter((training) => trainingNeedsSignature(state, training)).length;
}
