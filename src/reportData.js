import { attendanceTime } from "./attendanceVisuals.js";
import { summarizeAttendance } from "./attendanceSummary.js";

export function validReportRange(from, to) {
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  };
  return validDate(from) && validDate(to) && from <= to;
}

// The screen and both exports share this selection, including its ordering.
export function prepareReport(
  { people, attendance, requests },
  range,
  search = "",
  sort = "name",
  participantId = "",
) {
  const query = search.trim().toLocaleLowerCase("id-ID");
  const selected = people.filter(
    (person) =>
      (!participantId || person.id === participantId) &&
      (person.name || "").toLocaleLowerCase("id-ID").includes(query),
  );
  const byId = new Map(selected.map((person) => [person.id, person]));
  const cutoff = range.to < range.today ? range.to : range.today;
  const records = attendance.filter(
    (row) =>
      byId.has(row.user_id) && row.date >= range.from && row.date <= cutoff,
  );
  const summary = summarizeAttendance(selected, records, range)
    .map((row) => ({
      ...row,
      university: byId.get(row.id).university || "—",
      major: byId.get(row.id).major || "—",
      internship_start: byId.get(row.id).internship_start || null,
      internship_end: byId.get(row.id).internship_end || null,
    }))
    .sort((a, b) => {
      if (sort === "terlambat") {
        const difference = (b[sort] ?? -1) - (a[sort] ?? -1);
        if (difference) return difference;
      }
      return (a.name || "").localeCompare(b.name || "", "id");
    });
  const rank = new Map(summary.map((row, index) => [row.id, index]));
  const rows = records
    .map((row) => ({
      ...row,
      name: byId.get(row.user_id).name || "Anak magang",
      university: byId.get(row.user_id).university || "—",
      major: byId.get(row.user_id).major || "—",
      in: attendanceTime(row.check_in),
      out: attendanceTime(row.check_out),
    }))
    .sort(
      (a, b) =>
        rank.get(a.user_id) - rank.get(b.user_id) ||
        a.date.localeCompare(b.date),
    );
  return {
    summary,
    rows,
    requests: requests
      .filter(
        (row) =>
          byId.has(row.user_id) &&
          row.status === "Disetujui" &&
          row.date_from <= range.to &&
          row.date_to >= range.from,
      )
      .map((row) => ({
        ...row,
        name: byId.get(row.user_id).name || "Anak magang",
      }))
      .sort(
        (a, b) =>
          rank.get(a.user_id) - rank.get(b.user_id) ||
          a.date_from.localeCompare(b.date_from),
      ),
  };
}
