import { attendanceTime, shiftDate } from "./attendanceVisuals.js";

export function summarizeAdminDashboard(rows, { today, now, workEndTime }) {
  const statuses = ["Hadir", "Terlambat", "Izin", "Sakit", "Alpa"];
  const counts = Object.fromEntries(
    statuses.map((status) => [
      status,
      rows.filter((row) => row.status === status).length,
    ]),
  );
  const hasTime = (value) => attendanceTime(value) !== "—";
  const checkedIn = rows.filter(
    (row) =>
      ["Hadir", "Terlambat"].includes(row.status) &&
      hasTime(row.check_in ?? row.in),
  );
  const hasWorkEnd = /^([01]\d|2[0-3]):[0-5]\d$/.test(workEndTime || "");
  const currentTime = attendanceTime(now);
  const afterWork =
    hasWorkEnd && currentTime !== "—" && currentTime >= workEndTime;
  const checkoutPending = afterWork
    ? checkedIn.filter((row) => !hasTime(row.check_out ?? row.out))
    : [];
  const ending = rows
    .filter(
      (row) =>
        row.is_active === true &&
        (!row.internship_start || row.internship_start <= today) &&
        row.internship_end >= today &&
        row.internship_end <= shiftDate(today, 7),
    )
    .sort(
      (a, b) =>
        a.internship_end.localeCompare(b.internship_end) ||
        (a.name || "").localeCompare(b.name || "", "id"),
    );
  return {
    total: rows.length,
    active: rows.filter((row) => row.is_active === true).length,
    checkedIn: checkedIn.length,
    counts,
    hasWorkEnd,
    afterWork,
    checkoutPending,
    ending,
  };
}
