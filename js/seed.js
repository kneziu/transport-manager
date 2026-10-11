function shell(id, name, color, extra = {}) {
  return {
    id,
    name,
    color,
    vehicles: [],
    drivers: [],
    checks: [],
    damages: [],
    reservations: [],
    brakes: [],
    exclusions: [],
    notes: [],
    money: [],
    documents: [],
    ...extra
  };
}

function pmi(id, date, done = false, note = "", active = false) {
  return { id, date, done, note, active };
}

function vehicle(data) {
  return {
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
    status: "active",
    pmi: [],
    ...data
  };
}

function createSeed() {
  return {
    version: 1,
    companies: [
      shell("alessio", "Alessio Ltd", "#1a6b63", {
        vehicles: [
          vehicle({
            id: "v-mx67",
            reg: "MX67 KZF",
            status: "sold",
            motDate: "2027-07-31",
            nextMot: "07.2028",
            taxDate: "2027-03-01",
            tachoCal: "2026-02-19",
            tachoExpiry: "2028-02-19",
            pmi: [
              pmi("p-mx67-1", "", false, "N/A TRUCK IN WORKSHOP", false),
              pmi("p-mx67-2", "2026-07-10", false, "", false),
              pmi("p-mx67-3", "", false, "truck sold", false)
            ]
          }),
          vehicle({
            id: "v-mk20",
            reg: "MK20 UUV",
            olDate: "2026-04-15",
            motDate: "2027-08-31",
            nextMot: "01.07–31.08.2028",
            taxDate: "2027-04-01",
            tachoCal: "2025-08-12",
            tachoExpiry: "2027-08-12",
            pmi: [
              pmi("p-mk20-1", "2026-05-16", false),
              pmi("p-mk20-2", "2026-07-03", true),
              pmi("p-mk20-3", "2026-08-14", false)
            ]
          }),
          vehicle({
            id: "v-bf70",
            reg: "BF70 MXK",
            olDate: "2026-04-15",
            motDate: "2026-11-30",
            nextMot: "01.10–30.11.2026",
            preparing: true,
            windowStart: "2026-10-01",
            windowEnd: "2026-11-30",
            taxDate: "2027-10-01",
            tachoCal: "2025-11-21",
            tachoExpiry: "2027-11-21",
            pmi: [
              pmi("p-bf70-1", "", false, "IN SERVICE", false),
              pmi("p-bf70-2", "2026-07-09", true),
              pmi("p-bf70-3", "2026-08-30", true)
            ]
          }),
          vehicle({
            id: "v-kpr",
            reg: "MW22 KPR",
            olDate: "2026-08-21",
            motDate: "2027-08-31",
            nextMot: "01.07–31.08.2028",
            taxDate: "2027-03-01",
            tachoCal: "2025-09-29",
            tachoExpiry: "2027-09-29",
            pmi: [
              pmi("p-kpr-1", "2026-09-26", true),
              pmi("p-kpr-2", "2026-11-07", false),
              pmi("p-kpr-3", "2026-12-19", false)
            ]
          }),
          vehicle({
            id: "v-ksk",
            reg: "MW22 KSK",
            olDate: "2026-08-21",
            motDate: "2027-08-31",
            nextMot: "01.07–31.08.2028",
            taxDate: "2027-03-01",
            tachoCal: "2026-08-21",
            tachoExpiry: "2028-08-21",
            pmi: [
              pmi("p-ksk-1", "2026-09-26", true),
              pmi("p-ksk-2", "2026-11-07", false),
              pmi("p-ksk-3", "2026-12-19", false)
            ]
          }),
          vehicle({
            id: "v-de69",
            reg: "DE69 ZKU",
            olDate: "2026-10-05",
            motDate: "2027-11-30",
            nextMot: "01.10–30.11.2028",
            taxDate: "2027-04-01",
            pmi: [
              pmi("p-de69-1", "", false, "waiting for dealer to send it", true),
              pmi("p-de69-2", "2026-11-13", false),
              pmi("p-de69-3", "2026-12-30", false)
            ]
          })
        ]
      }),
      shell("firma-2", "Firma 2", "#b45309"),
      shell("firma-3", "Firma 3", "#1d4e89"),
      shell("firma-4", "Firma 4", "#6d28a8")
    ],
    trainings: [
      {
        id: "t-walkaround",
        title: "Codzienna kontrola pojazdu",
        body: "Kierowca potwierdza, że przed wyjazdem sprawdza pojazd i zapisuje usterki. Podpis zostaje przy szkoleniu.",
        questions: [
          { id: "q1", text: "Przed wyjazdem sprawdzam opony, światła, hamulce i wycieki." },
          { id: "q2", text: "Usterkę zapisuję w Daily check tego samego dnia." },
          { id: "q3", text: "Nie wyjeżdżam, gdy tachograf nie ma ważnej kalibracji albo nie mam karty kierowcy." }
        ],
        shares: [{ id: "s1", companyId: "alessio", driverId: "" }],
        signatures: []
      }
    ]
  };
}
