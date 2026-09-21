import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAdminDashboard } from "../src/adminDashboardData.js";

const options = {
  today: "2026-09-21",
  now: new Date("2026-09-21T09:01:00Z"),
  workEndTime: "16:00",
};

test("counts active accounts separately and includes late check-ins without conflating statuses", () => {
  const summary = summarizeAdminDashboard(
    [
      { is_active: true, status: "Hadir", check_in: "2026-09-21T00:50:00Z" },
      { is_active: true, status: "Terlambat", in: "08.15" },
      { is_active: false, status: "Nonaktif" },
      { is_active: true, status: "Izin" },
      { is_active: true, status: "Sakit" },
      { is_active: true, status: "Alpa" },
      { is_active: true, status: "Belum Absen" },
      { is_active: true, status: "Hadir", in: "-" },
    ],
    options,
  );
  assert.equal(summary.total, 8);
  assert.equal(summary.active, 7);
  assert.equal(summary.checkedIn, 2);
  assert.deepEqual(summary.counts, {
    Hadir: 2,
    Terlambat: 1,
    Izin: 1,
    Sakit: 1,
    Alpa: 1,
  });
});

test("checkout reminder starts at the configured WIB end time and ignores completed/non-attendance records", () => {
  const rows = [
    { id: "pending", status: "Terlambat", in: "08:15", out: "—" },
    {
      id: "complete",
      status: "Hadir",
      check_in: "2026-09-21T00:55:00Z",
      check_out: "2026-09-21T09:00:00Z",
    },
    { id: "missing", status: "Belum Absen", in: "-", out: "-" },
    { id: "leave", status: "Izin", in: "08:00" },
  ];
  assert.deepEqual(
    summarizeAdminDashboard(rows, {
      ...options,
      now: new Date("2026-09-21T08:59:00Z"),
    }).checkoutPending,
    [],
  );
  assert.deepEqual(
    summarizeAdminDashboard(rows, {
      ...options,
      now: new Date("2026-09-21T09:00:00Z"),
    }).checkoutPending.map((r) => r.id),
    ["pending"],
  );
  for (const workEndTime of [null, "", "25:00", "16:99"]) {
    const summary = summarizeAdminDashboard(rows, { ...options, workEndTime });
    assert.equal(summary.hasWorkEnd, false);
    assert.deepEqual(summary.checkoutPending, []);
  }
});

test("ending reminders include today through seven days ahead, sorted, excluding inactive and future internships", () => {
  const rows = [
    { id: "last", is_active: true, internship_end: "2026-09-28" },
    { id: "today", is_active: true, internship_end: "2026-09-21" },
    { id: "past", is_active: true, internship_end: "2026-09-20" },
    { id: "later", is_active: true, internship_end: "2026-09-29" },
    { id: "inactive", is_active: false, internship_end: "2026-09-25" },
    {
      id: "future",
      is_active: true,
      internship_start: "2026-09-22",
      internship_end: "2026-09-25",
    },
    { id: "unknown", is_active: true },
  ];
  assert.deepEqual(
    summarizeAdminDashboard(rows, options).ending.map((r) => r.id),
    ["today", "last"],
  );
  const yearEnd = summarizeAdminDashboard(
    [{ id: "next-year", is_active: true, internship_end: "2027-01-03" }],
    { ...options, today: "2026-12-29" },
  );
  assert.equal(yearEnd.ending.length, 1);
});

test("empty data stays empty and invalid clocks do not trigger checkout reminders", () => {
  const summary = summarizeAdminDashboard([], options);
  assert.equal(summary.total, 0);
  assert.equal(summary.active, 0);
  assert.equal(summary.checkedIn, 0);
  assert.deepEqual(summary.ending, []);
  assert.equal(
    summarizeAdminDashboard([], { ...options, now: "invalid" }).afterWork,
    false,
  );
});
