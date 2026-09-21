export function attendanceDisplayState(record) {
  const status = record?.status || "Belum Absen";
  const nonAttendance = ["Izin", "Sakit", "Alpa"].includes(status);
  const checkedIn = !nonAttendance && Boolean(record?.check_in);
  const complete = checkedIn && Boolean(record?.check_out);
  const needsReview = Boolean(record) && !nonAttendance && !checkedIn;
  const canScan = !nonAttendance && !complete && !needsReview;
  return {
    status,
    checkedIn,
    complete,
    canScan,
    title: nonAttendance
      ? `${status} hari ini`
      : complete
        ? "Absensi hari ini selesai"
        : checkedIn
          ? "Check-in sudah tercatat"
          : needsReview
            ? "Catatan absensi perlu ditinjau"
            : "Saatnya mulai hari yang produktif!",
    description: nonAttendance
      ? `Status ${status.toLowerCase()} sudah tercatat. Hubungi pembimbing jika perlu koreksi.`
      : complete
        ? "Terima kasih sudah menyelesaikan absensi Anda."
        : checkedIn
          ? "Lakukan scan kembali saat pulang untuk mencatat check-out."
          : needsReview
            ? "Jam masuk belum tercatat. Hubungi pembimbing untuk memeriksa absensi."
            : "Lakukan scan untuk mencatat kehadiran Anda.",
    progress: nonAttendance
      ? `Status ${status.toLowerCase()} tercatat`
      : complete
        ? "Check-in dan check-out lengkap"
        : checkedIn
          ? "Menunggu check-out"
          : needsReview
            ? "Perlu koreksi pembimbing"
            : "Belum melakukan scan",
    action: nonAttendance
      ? `${status.toUpperCase()} TERCATAT`
      : complete
        ? "ABSENSI HARI INI SELESAI"
        : needsReview
          ? "HUBUNGI PEMBIMBING"
          : checkedIn
            ? "SCAN UNTUK CHECK-OUT"
            : "SCAN ABSEN",
  };
}

export function summarizeAttendance(people, records, { from, to, today }) {
  const cutoff = to < today ? to : today;
  const byUser = new Map();
  for (const row of records) {
    if (row.date < from || row.date > cutoff) continue;
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Map());
    byUser.get(row.user_id).set(row.date, row);
  }
  return people.map((person) => {
    const own = byUser.get(person.id) || new Map();
    const count = (status) =>
      [...own.values()].filter((row) => row.status === status).length;
    return {
      id: person.id,
      name: person.name,
      hadir: count("Hadir"),
      terlambat: count("Terlambat"),
      izin: count("Izin"),
      sakit: count("Sakit"),
      alpa: count("Alpa"),
    };
  });
}

export const REPORT_NOTE =
  "Rekap menghitung status absensi yang tersimpan pada periode pilihan hingga hari ini, termasuk catatan akhir pekan. Hadir, Terlambat, Izin, Sakit, dan Alpa dihitung terpisah. Alpa hanya dihitung jika tercatat, bukan ditetapkan otomatis.";

export async function fetchAllPages(makeQuery, signal) {
  const rows = [];
  for (;;) {
    let query = makeQuery().range(rows.length, rows.length + 499);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}
