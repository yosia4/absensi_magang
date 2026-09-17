import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceDisplayState,
  summarizeAttendance,
} from "../src/attendanceSummary.js";

test("leave, sickness and explicit absence are never check-in or checkout states", () => {
  for (const status of ["Izin", "Sakit", "Alpa"]) {
    for (const times of [{}, { check_in: "08:00", check_out: "16:00" }]) {
      const state = attendanceDisplayState({ status, ...times });
      assert.equal(state.status, status);
      assert.equal(state.checkedIn, false);
      assert.equal(state.complete, false);
      assert.equal(state.canScan, false);
      assert.ok(!state.progress.includes("Menunggu check-out"));
    }
  }
});

test("scan action depends on actual timestamps and never checks out a row without check-in", () => {
  assert.equal(attendanceDisplayState(null).canScan, true);
  const present = attendanceDisplayState({
    status: "Terlambat",
    check_in: "08:20",
  });
  assert.equal(present.checkedIn, true);
  assert.equal(present.action, "SCAN UNTUK CHECK-OUT");
  assert.equal(present.status, "Terlambat");
  assert.equal(
    attendanceDisplayState({
      status: "Hadir",
      check_in: "08:00",
      check_out: "16:00",
    }).canScan,
    false,
  );
  assert.equal(
    attendanceDisplayState({ status: "Hadir", check_out: "16:00" }).complete,
    false,
  );
  assert.equal(attendanceDisplayState({ status: "Hadir" }).canScan, false);
});

const person = {
  id: "a",
  name: "Peserta A",
  internship_start: "2026-09-01",
  internship_end: "2026-09-30",
  is_active: true,
};
const range = { from: "2026-09-01", to: "2026-09-30", today: "2026-09-07" };

test("reports count Izin separately and distinguish missing weekdays from recorded Alpa", () => {
  const rows = [
    { user_id: "a", date: "2026-09-01", status: "Hadir" },
    { user_id: "a", date: "2026-09-02", status: "Izin" },
    { user_id: "a", date: "2026-09-03", status: "Alpa" },
    { user_id: "a", date: "2026-09-05", status: "Hadir" },
    { user_id: "a", date: "2026-09-08", status: "Sakit" },
    { user_id: "b", date: "2026-09-04", status: "Hadir" },
  ];
  const [result] = summarizeAttendance([person], rows, range);
  assert.deepEqual(result, {
    id: "a",
    name: "Peserta A",
    hadir: 2,
    terlambat: 0,
    izin: 1,
    sakit: 0,
    alpa: 1,
    missing: 2,
  });
});

test("weekends and future periods never add missing attendance", () => {
  const [weekend] = summarizeAttendance([person], [], {
    from: "2026-09-05",
    to: "2026-09-06",
    today: "2026-09-07",
  });
  assert.equal(weekend.missing, 0);
  const [future] = summarizeAttendance([person], [], {
    from: "2026-09-08",
    to: "2026-09-30",
    today: "2026-09-07",
  });
  assert.equal(future.missing, 0);
});

test("missing attendance respects internship bounds and unknown dates", () => {
  const profiles = [
    { ...person, internship_start: "2026-09-03", internship_end: "2026-09-04" },
    { ...person, id: "b", internship_start: null },
    { ...person, id: "c", is_active: false, internship_end: null },
    { ...person, id: "d", is_active: false, internship_end: "2026-09-02" },
  ];
  assert.deepEqual(
    summarizeAttendance(profiles, [], range).map((row) => row.missing),
    [2, null, null, 2],
  );
});

test("selected date only counts that date, preserving zero counts", () => {
  const [result] = summarizeAttendance(
    [person],
    [{ user_id: "a", date: "2026-09-01", status: "Izin" }],
    { from: "2026-09-02", to: "2026-09-02", today: "2026-09-07" },
  );
  assert.equal(result.izin, 0);
  assert.equal(result.alpa, 0);
  assert.equal(result.missing, 1);
});
