export const ATTENDANCE_STATUSES = [
  { name: "Hadir", tone: "present" },
  { name: "Terlambat", tone: "late" },
  { name: "Izin", tone: "leave" },
  { name: "Sakit", tone: "sick" },
  { name: "Alpa", tone: "absent" },
];

export function attendanceTone(status) {
  return (
    ATTENDANCE_STATUSES.find((item) => item.name === status)?.tone ||
    {
      "Belum Absen": "missing",
      Libur: "holiday",
      "Masuk opsional": "optional",
      Nonaktif: "missing",
    }[status] ||
    "neutral"
  );
}

export function jakartaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Date-only arithmetic uses UTC so the viewer's device timezone cannot move a day.
export function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthRange(month) {
  const from = `${month}-01`;
  const next = new Date(`${from}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: shiftDate(next.toISOString().slice(0, 10), -1) };
}

export function weekRange(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const from = shiftDate(date, -((weekday + 6) % 7));
  return { from, to: shiftDate(from, 6) };
}

export function dateLabel(
  date,
  options = { day: "numeric", month: "long", year: "numeric" },
) {
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function attendanceTime(value) {
  if (!value) return "—";
  if (/^\d{2}[:.]\d{2}$/.test(value)) return value.replace(".", ":");
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Jakarta",
      })
        .format(date)
        .replace(".", ":");
}

export function calendarDayType(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? "Libur" : weekday === 6 ? "Masuk opsional" : null;
}

export function calendarStatus(date, record, today, user = {}) {
  if (record) return record.status;
  const dayType = calendarDayType(date);
  if (dayType) return dayType;
  if (date > today) return "Belum berlangsung";
  if (
    (user.internship_start && date < user.internship_start) ||
    (user.internship_end && date > user.internship_end)
  )
    return "Di luar masa magang";
  return "Belum Absen";
}

export function dailyTrend(records, from, to) {
  const days = new Map();
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    days.set(date, {
      date,
      total: 0,
      counts: Object.fromEntries(
        ATTENDANCE_STATUSES.map(({ name }) => [name, 0]),
      ),
    });
  }
  for (const record of records) {
    const day = days.get(record.date);
    if (day && Object.hasOwn(day.counts, record.status)) {
      day.counts[record.status] += 1;
      day.total += 1;
    }
  }
  return [...days.values()];
}

// Fetch until an empty page, including projects whose API row cap is below 500.
export async function fetchAttendanceRange(
  client,
  { from, to, userId, signal },
) {
  const records = [];
  for (;;) {
    let query = client
      .from("attendance")
      .select("user_id,date,check_in,check_out,status")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("user_id")
      .range(records.length, records.length + 499);
    if (userId) query = query.eq("user_id", userId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return records;
    records.push(...data);
  }
}
