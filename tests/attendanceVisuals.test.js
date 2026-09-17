import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceTime,
  calendarDayType,
  calendarStatus,
  dailyTrend,
  fetchAttendanceRange,
  jakartaToday,
  monthRange,
  shiftDate,
  weekRange,
} from "../src/attendanceVisuals.js";

test("calendar includes leap day and weeks cross a year boundary on Monday", () => {
  assert.deepEqual(monthRange("2024-02"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(monthRange("2025-02"), {
    from: "2025-02-01",
    to: "2025-02-28",
  });
  assert.deepEqual(weekRange("2026-01-01"), {
    from: "2025-12-29",
    to: "2026-01-04",
  });
  assert.deepEqual(weekRange("2026-01-04"), weekRange("2026-01-01"));
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
});

test("Jakarta day and time do not depend on the device timezone", () => {
  assert.equal(jakartaToday(new Date("2026-09-16T17:30:00Z")), "2026-09-17");
  assert.equal(attendanceTime("2026-09-17T01:05:00Z"), "08:05");
  assert.equal(attendanceTime("08.05"), "08:05");
  assert.equal(attendanceTime(null), "—");
});

test("missing attendance is not Alpa, future dates and internship bounds stay distinct", () => {
  const user = { internship_start: "2026-09-01", internship_end: "2026-09-15" };
  assert.equal(
    calendarStatus("2026-09-10", null, "2026-09-17", user),
    "Belum Absen",
  );
  assert.equal(
    calendarStatus("2026-08-31", null, "2026-09-17", user),
    "Di luar masa magang",
  );
  assert.equal(
    calendarStatus("2026-09-16", null, "2026-09-17", user),
    "Di luar masa magang",
  );
  assert.equal(
    calendarStatus("2026-09-18", null, "2026-09-17", user),
    "Belum berlangsung",
  );
  assert.equal(
    calendarStatus("2026-09-10", { status: "Sakit" }, "2026-09-17", user),
    "Sakit",
  );
});

test("Sunday is a holiday and Saturday is optional, including upcoming weekends", () => {
  for (const today of ["2026-09-10", "2026-09-17"]) {
    assert.equal(calendarStatus("2026-09-12", null, today), "Masuk opsional");
    assert.equal(calendarStatus("2026-09-13", null, today), "Libur");
  }
  assert.equal(calendarDayType("2026-09-12"), "Masuk opsional");
  assert.equal(calendarDayType("2026-09-13"), "Libur");
  assert.equal(calendarDayType("2026-09-14"), null);
  assert.equal(calendarStatus("2026-09-14", null, "2026-09-17"), "Belum Absen");
});

test("weekend attendance records remain visible instead of being replaced by schedule labels", () => {
  assert.equal(
    calendarStatus("2026-09-12", { status: "Hadir" }, "2026-09-17"),
    "Hadir",
  );
  assert.equal(
    calendarStatus("2026-09-13", { status: "Terlambat" }, "2026-09-17"),
    "Terlambat",
  );
});

test("trend counts each recorded status separately and includes empty days", () => {
  const days = dailyTrend(
    [
      { date: "2026-09-14", status: "Hadir" },
      { date: "2026-09-14", status: "Hadir" },
      { date: "2026-09-14", status: "Terlambat" },
      { date: "2026-09-15", status: "Izin" },
      { date: "2026-09-15", status: "Sakit" },
      { date: "2026-09-15", status: "Alpa" },
      { date: "2026-09-15", status: "Unknown" },
      { date: "2026-09-20", status: "Hadir" },
    ],
    "2026-09-14",
    "2026-09-16",
  );
  assert.equal(days.length, 3);
  assert.deepEqual(days[0].counts, {
    Hadir: 2,
    Terlambat: 1,
    Izin: 0,
    Sakit: 0,
    Alpa: 0,
  });
  assert.equal(days[0].total, 3);
  assert.equal(days[1].total, 3);
  assert.equal(days[2].total, 0);
  assert.equal(days[2].counts.Alpa, 0);
});

test("range fetch retrieves more than one API page even with a lower server row cap", async () => {
  const all = Array.from({ length: 1203 }, (_, i) => ({
    user_id: `user-${i}`,
  }));
  const offsets = [];
  const filters = [];
  const client = {
    from: () => {
      let offset = 0;
      const query = {
        select() {
          return this;
        },
        gte() {
          return this;
        },
        lte() {
          return this;
        },
        order() {
          return this;
        },
        eq(key, value) {
          filters.push([key, value]);
          return this;
        },
        range(start) {
          offset = start;
          offsets.push(start);
          return this;
        },
        then(resolve) {
          return Promise.resolve({
            data: all.slice(offset, offset + 200),
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  };
  assert.equal(
    (
      await fetchAttendanceRange(client, {
        from: "2026-09-01",
        to: "2026-09-30",
        userId: "intern-1",
      })
    ).length,
    1203,
  );
  assert.deepEqual(offsets, [0, 200, 400, 600, 800, 1000, 1200, 1203]);
  assert.ok(
    filters.every(([key, value]) => key === "user_id" && value === "intern-1"),
  );
});

test("failed range fetch does not return incomplete counts", async () => {
  const query = {
    select() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    order() {
      return this;
    },
    range() {
      return this;
    },
    then(resolve) {
      return Promise.resolve({ error: new Error("Offline") }).then(resolve);
    },
  };
  await assert.rejects(
    fetchAttendanceRange(
      { from: () => query },
      { from: "2026-09-01", to: "2026-09-30" },
    ),
    /Offline/,
  );
});
