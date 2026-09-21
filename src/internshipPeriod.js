const DAY = 86400000;

function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : null;
}

export function internshipPeriod(start, end, today) {
  const first = dateValue(start),
    last = dateValue(end),
    current = dateValue(today);
  if (
    current === null ||
    (start && first === null) ||
    (end && last === null) ||
    (first !== null && last !== null && first > last)
  ) {
    return {
      phase: "invalid",
      label: "Periode perlu diperiksa",
      remaining: null,
      progress: null,
    };
  }
  if (first !== null && current < first) {
    return {
      phase: "upcoming",
      label: "Belum dimulai",
      untilStart: (first - current) / DAY,
      remaining: null,
      progress: last === null ? null : 0,
    };
  }
  if (last !== null && current > last) {
    return {
      phase: "complete",
      label: "Magang selesai",
      remaining: 0,
      progress: first === null ? null : 100,
    };
  }
  if (last === null)
    return {
      phase: "incomplete",
      label: "Periode belum lengkap",
      remaining: null,
      progress: null,
    };
  const remaining = (last - current) / DAY + 1;
  const total = first === null ? null : (last - first) / DAY + 1;
  const day = total === null ? null : total - remaining + 1;
  return {
    phase: "ongoing",
    label:
      first === null
        ? "Tanggal mulai belum diisi"
        : remaining === 1
          ? "Hari terakhir magang"
          : "Sedang berlangsung",
    remaining,
    total,
    day,
    progress: total === null ? null : Math.round((day / total) * 100),
  };
}
