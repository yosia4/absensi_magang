import test from "node:test";
import assert from "node:assert/strict";
import { internshipPeriod } from "../src/internshipPeriod.js";

test("remaining calendar days include today and the end date", () => {
  const period = internshipPeriod("2026-09-01", "2026-09-30", "2026-09-21");
  assert.equal(period.remaining, 10);
  assert.equal(period.total, 30);
  assert.equal(period.day, 21);
  assert.equal(period.progress, 70);
});
test("upcoming internships show a countdown to their start", () => {
  const period = internshipPeriod("2027-01-02", "2027-02-01", "2026-12-30");
  assert.equal(period.phase, "upcoming");
  assert.equal(period.untilStart, 3);
  assert.equal(period.remaining, null);
  assert.equal(period.progress, 0);
});
test("last day and completed periods remain distinct and never show negative days", () => {
  const last = internshipPeriod("2026-09-21", "2026-09-21", "2026-09-21");
  assert.equal(last.remaining, 1);
  assert.equal(last.progress, 100);
  assert.equal(last.label, "Hari terakhir magang");
  const complete = internshipPeriod("2026-09-01", "2026-09-21", "2026-09-22");
  assert.equal(complete.phase, "complete");
  assert.equal(complete.remaining, 0);
});
test("missing dates never fabricate a duration or progress", () => {
  assert.equal(internshipPeriod(null, null, "2026-09-21").remaining, null);
  assert.equal(
    internshipPeriod("2026-09-01", null, "2026-09-21").progress,
    null,
  );
  const endOnly = internshipPeriod(null, "2026-09-30", "2026-09-21");
  assert.equal(endOnly.remaining, 10);
  assert.equal(endOnly.progress, null);
});
test("invalid and reversed dates are flagged, while leap days count correctly", () => {
  for (const [start, end] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-10-01", "2026-09-01"],
    [null, "invalid"],
  ]) {
    const period = internshipPeriod(start, end, "2026-09-21");
    assert.equal(period.phase, "invalid");
    assert.equal(period.remaining, null);
  }
  const leap = internshipPeriod("2024-02-28", "2024-03-01", "2024-02-29");
  assert.equal(leap.total, 3);
  assert.equal(leap.remaining, 2);
});
