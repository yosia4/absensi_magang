import test from "node:test";
import assert from "node:assert/strict";
import { canScanAction, applyDemoScan } from "../src/attendanceScan.js";

test("only entry is enabled before arrival; only departure after arrival", () => {
  assert.equal(canScanAction(null, "check_in"), true);
  assert.equal(canScanAction(null, "check_out"), false);
  assert.equal(canScanAction(null, "invalid"), false);
  for (const status of ["Hadir", "Terlambat"]) {
    const entry = { check_in: "08:00", status };
    assert.equal(canScanAction(entry, "check_in"), false);
    assert.equal(canScanAction(entry, "check_out"), true);
    const complete = { ...entry, check_out: "16:00" };
    assert.equal(canScanAction(complete, "check_in"), false);
    assert.equal(canScanAction(complete, "check_out"), false);
    assert.equal(
      canScanAction({ ...complete, check_out: null }, "check_out"),
      true,
    );
  }
});
test("leave/sickness/absence and incomplete records cannot scan either action", () => {
  for (const status of ["Izin", "Sakit", "Alpa"]) {
    for (const fields of [{}, { check_in: "08:00" }]) {
      assert.equal(canScanAction({ status, ...fields }, "check_in"), false);
      assert.equal(canScanAction({ status, ...fields }, "check_out"), false);
    }
  }
  assert.equal(canScanAction({ status: "Hadir" }, "check_in"), false);
  assert.equal(
    canScanAction({ status: "Hadir", check_out: "16:00" }, "check_out"),
    false,
  );
});
test("demo duplicates never toggle entry to departure or overwrite timestamps/status", () => {
  const date = "2026-09-23";
  assert.deepEqual(applyDemoScan([], date, "check_out", "08:00"), []);
  const entered = applyDemoScan([], date, "check_in", "08:00");
  assert.equal(entered[0].check_out, null);
  assert.strictEqual(
    applyDemoScan(entered, date, "check_in", "08:01"),
    entered,
  );
  const late = [{ ...entered[0], status: "Terlambat" }];
  const left = applyDemoScan(late, date, "check_out", "16:00");
  assert.equal(left[0].check_in, "08:00");
  assert.equal(left[0].status, "Terlambat");
  assert.equal(left[0].check_out, "16:00");
  assert.strictEqual(applyDemoScan(left, date, "check_out", "16:01"), left);
  assert.strictEqual(applyDemoScan(left, date, "check_in", "16:01"), left);
});
