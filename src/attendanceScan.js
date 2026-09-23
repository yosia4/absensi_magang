import { attendanceDisplayState } from "./attendanceSummary.js";

export function canScanAction(record, action) {
  const state = attendanceDisplayState(record);
  return (
    state.canScan &&
    (action === "check_in"
      ? !state.checkedIn
      : action === "check_out" && state.checkedIn)
  );
}

// Demo follows the same explicit-action rule as the server; never toggle on retry.
export function applyDemoScan(records, date, action, time) {
  const existing = records.find((row) => row.date === date);
  if (!canScanAction(existing, action)) return records;
  if (action === "check_in")
    return [
      { date, check_in: time, check_out: null, status: "Hadir" },
      ...records,
    ];
  return records.map((row) =>
    row.date === date ? { ...row, check_out: time } : row,
  );
}
