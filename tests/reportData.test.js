import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareReport, validReportRange } from "../src/reportData.js";
import { buildAttendancePdf } from "../src/reportExport.js";

const range = { from: "2026-09-01", to: "2026-09-30", today: "2026-09-03" };
const people = [
  {
    id: "a",
    name: "Ayu",
    university: "Universitas A",
    major: "Informatika",
    internship_start: "2026-09-01",
    internship_end: "2026-12-31",
  },
  {
    id: "b",
    name: "Budi",
    university: "Universitas B",
    internship_start: "2026-09-01",
  },
  { id: "c", name: "Citra", internship_start: null },
];
const attendance = [
  { user_id: "a", date: "2026-09-01", status: "Hadir", check_in: "08:00" },
  { user_id: "a", date: "2026-09-02", status: "Hadir", check_in: "08:00" },
  { user_id: "b", date: "2026-09-01", status: "Terlambat", check_in: "08:30" },
  { user_id: "a", date: "2026-10-01", status: "Hadir" },
  { user_id: "a", date: "2026-09-04", status: "Hadir" },
];
const requests = [
  {
    user_id: "a",
    type: "Izin",
    status: "Disetujui",
    date_from: "2026-08-31",
    date_to: "2026-09-01",
  },
  {
    user_id: "b",
    type: "Sakit",
    status: "Disetujui",
    date_from: "2026-09-02",
    date_to: "2026-09-03",
  },
  {
    user_id: "a",
    type: "Izin",
    status: "Ditolak",
    date_from: "2026-09-01",
    date_to: "2026-09-01",
  },
  {
    user_id: "a",
    type: "Izin",
    status: "Disetujui",
    date_from: "2026-10-01",
    date_to: "2026-10-02",
  },
];
test("participant search filters summary, attendance and overlapping approved leave together", () => {
  const report = prepareReport(
    { people, attendance, requests },
    range,
    "  AYU ",
  );
  assert.deepEqual(
    report.summary.map((row) => row.id),
    ["a"],
  );
  assert.equal(report.summary[0].university, "Universitas A");
  assert.equal(report.summary[0].hadir, 2);
  assert.deepEqual(
    report.rows.map((row) => row.date),
    ["2026-09-01", "2026-09-02"],
  );
  assert.equal(report.rows[0].in, "08:00");
  assert.equal(report.requests.length, 1);
  assert.equal(report.requests[0].user_id, "a");
  const empty = prepareReport(
    { people, attendance, requests },
    range,
    "tidak cocok",
  );
  assert.deepEqual(empty, { summary: [], rows: [], requests: [] });
});
test("sorts lateness descending and matches export order", () => {
  const report = prepareReport(
    { people, attendance, requests },
    range,
    "",
    "terlambat",
  );
  assert.deepEqual(
    report.summary.map((row) => row.id),
    ["b", "a", "c"],
  );
  assert.equal(report.rows[0].user_id, "b");
  assert.equal(report.requests[0].user_id, "b");
});
test("validates reversed, empty and impossible dates while allowing same day and leap day", () => {
  assert.equal(validReportRange("2026-09-03", "2026-09-01"), false);
  assert.equal(validReportRange("", "2026-09-01"), false);
  assert.equal(validReportRange("2026-02-29", "2026-03-01"), false);
  assert.equal(validReportRange("2024-02-29", "2024-02-29"), true);
  assert.equal(validReportRange("2026-09-01", "2026-09-01"), true);
});
test("PDF includes logo, period, WIB timestamp, filtered participant, page numbers and optional signature", async () => {
  const logoData = new Uint8Array(
    await readFile(
      new URL("../public/logo-rawuh-pustaka.png", import.meta.url),
    ),
  );
  const report = prepareReport(
    { people, attendance, requests: [] },
    range,
    "Ayu",
  );
  const doc = await buildAttendancePdf(
    {
      ...report,
      label: "September 2026",
      search: "Ayu",
      signature: true,
      supervisorName: "Dewi Lestari, S.Pd.",
      note: "CATATAN-TIDAK-DICETAK",
    },
    { logoData, now: new Date("2026-09-03T01:00:00Z") },
  );
  const pdf = doc.output();
  for (const value of [
    "Laporan Kehadiran",
    "September 2026",
    "WIB",
    "Universitas A",
    "Pembimbing Magang",
    "Halaman 1 dari",
    "/Subtype /Image",
    "Dewi Lestari, S.Pd.",
    "Identitas peserta",
    "Informatika",
    "31 Desember 2026",
    "Total absensi tercatat",
  ])
    assert.ok(pdf.includes(value), value);
  assert.ok(!pdf.includes("Budi"));
  for (const removed of [
    "Pencarian:",
    "Pilihan:",
    "Satuan status:",
    "CATATAN-TIDAK-DICETAK",
    "Nama dan tanda tangan",
  ])
    assert.ok(!pdf.includes(removed), removed);
  const unsigned = await buildAttendancePdf({
    ...report,
    label: "September 2026",
    signature: false,
  });
  assert.ok(!unsigned.output().includes("Pembimbing Magang"));
});
test("PDF stays compact and includes only participant summary even when attendance and leave details are long", async () => {
  const report = prepareReport(
    { people, attendance, requests: [] },
    range,
    "Ayu",
  );
  const doc = await buildAttendancePdf({
    ...report,
    label: "September 2026",
    signature: true,
    supervisorName: "Dewi Lestari",
    requests: [
      {
        name: "Ayu",
        type: "Izin",
        date_from: "2026-09-01",
        date_to: "2026-09-02",
        reason:
          "Alasan panjang untuk menguji halaman. ".repeat(500) + "AKHIRALASAN",
      },
    ],
  });
  const pdf = doc.output();
  const pages = doc.getNumberOfPages();
  assert.equal(pages, 1);
  assert.ok(!pdf.includes("AKHIRALASAN"));
  assert.ok(!pdf.includes("Data absensi"));
  assert.ok(!pdf.includes("Pengajuan izin dan sakit disetujui"));
  assert.ok(!pdf.includes("08:00"));
  assert.ok(pdf.includes("Rekap per peserta"));
  assert.ok(pdf.includes("Pembimbing Magang"));
  for (let page = 1; page <= pages; page++) {
    const content = doc.internal.pages[page].join("\n");
    assert.ok(content.includes("Laporan Kehadiran"));
    assert.ok(content.includes(`Halaman ${page} dari ${pages}`));
  }
});

test("signed PDF requires an actual supervisor name", async () => {
  await assert.rejects(
    () =>
      buildAttendancePdf({
        summary: [],
        label: "September 2026",
        signature: true,
        supervisorName: "   ",
      }),
    /Nama pembimbing/,
  );
});

test("participant selection uses the exact ID even when names match, and filters every export sheet", () => {
  const sameNames = people.map((person) => ({ ...person, name: "Nama Sama" }));
  const data = { people: sameNames, attendance, requests };
  const report = prepareReport(data, range, "", "name", "b");
  assert.deepEqual(
    report.summary.map((row) => row.id),
    ["b"],
  );
  assert.equal(report.summary[0].terlambat, 1);
  assert.equal(report.summary[0].university, "Universitas B");
  assert.deepEqual(
    report.rows.map((row) => row.user_id),
    ["b"],
  );
  assert.deepEqual(
    report.requests.map((row) => row.user_id),
    ["b"],
  );
  assert.equal(prepareReport(data, range).summary.length, 3);
  const noAttendance = prepareReport(data, range, "", "name", "c");
  assert.equal(noAttendance.summary.length, 1);
  assert.equal(noAttendance.summary[0].hadir, 0);
  assert.equal(noAttendance.rows.length, 0);
  assert.deepEqual(prepareReport(data, range, "", "name", "deleted"), {
    summary: [],
    rows: [],
    requests: [],
  });
});

test("PDF for one selected participant excludes other participants", async () => {
  const report = prepareReport(
    { people, attendance, requests },
    range,
    "",
    "name",
    "b",
  );
  const doc = await buildAttendancePdf({
    ...report,
    label: "September 2026",
    participantName: "Budi",
  });
  const pdf = doc.output();
  assert.ok(pdf.includes("Budi"));
  assert.ok(pdf.includes("Universitas B"));
  assert.ok(!pdf.includes("Ayu"));
  assert.ok(!pdf.includes("Citra"));
  assert.equal(doc.getNumberOfPages(), 1);
});

test("large participant summaries repeat the report and table headers across pages", async () => {
  const summary = Array.from({ length: 100 }, (_, index) => ({
    name: `Peserta ${index + 1}`,
    university: "Universitas A",
    hadir: 10,
    terlambat: 1,
    izin: 1,
    sakit: 0,
    alpa: 0,
  }));
  const doc = await buildAttendancePdf({ summary, label: "September 2026" });
  const pages = doc.getNumberOfPages();
  assert.ok(pages > 1);
  assert.ok(doc.output().includes("Peserta 100"));
  for (let page = 1; page <= pages; page++) {
    const content = doc.internal.pages[page].join("\n");
    assert.ok(content.includes("Rekap per peserta"));
    assert.ok(content.includes("Laporan Kehadiran"));
    assert.ok(content.includes(`Halaman ${page} dari ${pages}`));
  }
});
