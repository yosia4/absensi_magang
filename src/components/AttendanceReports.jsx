import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  attendanceTime,
  dateLabel,
  fetchAttendanceRange,
  jakartaToday,
  monthRange,
} from "../attendanceVisuals";
import {
  fetchAllPages,
  REPORT_NOTE,
  summarizeAttendance,
} from "../attendanceSummary";
import { exportAttendanceExcel, exportAttendancePdf } from "../reportExport";
import Skeleton from "./Skeleton";
import "./AttendanceReports.css";

const columns = [
  ["hadir", "Hadir"],
  ["terlambat", "Terlambat"],
  ["izin", "Izin"],
  ["sakit", "Sakit"],
  ["alpa", "Alpa"],
  ["missing", "Tanpa catatan"],
];

export default function AttendanceReports({ client, flash }) {
  const today = jakartaToday();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState(today);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [state, setState] = useState({
    key: "",
    people: [],
    attendance: [],
    requests: [],
    loading: true,
    error: "",
  });
  const range = useMemo(
    () => (mode === "month" ? monthRange(month) : { from: date, to: date }),
    [mode, month, date],
  );
  const key = `${range.from}:${range.to}:${today}`;
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({
        key,
        people: [],
        attendance: [],
        requests: [],
        loading: true,
        error: "",
      });
      try {
        if (!client)
          throw new Error("Laporan tersedia setelah terhubung ke database.");
        const [people, attendance, requests] = await Promise.all([
          fetchAllPages(
            () =>
              client
                .from("profiles")
                .select(
                  "id,name,university,major,internship_start,internship_end,is_active",
                )
                .eq("role", "intern")
                .order("id"),
            controller.signal,
          ),
          fetchAttendanceRange(client, { ...range, signal: controller.signal }),
          fetchAllPages(
            () =>
              client
                .from("leave_requests")
                .select("id,user_id,type,date_from,date_to,reason,status")
                .in("type", ["Izin", "Sakit"])
                .eq("status", "Disetujui")
                .lte("date_from", range.to)
                .gte("date_to", range.from)
                .order("id"),
            controller.signal,
          ),
        ]);
        if (!controller.signal.aborted)
          setState({
            key,
            people,
            attendance: attendance.filter((item) => item.date <= today),
            requests,
            loading: false,
            error: "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            key,
            people: [],
            attendance: [],
            requests: [],
            loading: false,
            error: client
              ? "Laporan belum dapat dimuat. Periksa koneksi lalu coba lagi."
              : error.message,
          });
      }
    };
    load();
    return () => controller.abort();
  }, [client, key, range, revision, today]);
  const loading = state.key !== key || state.loading;
  const ready = !loading && !state.error;
  const summary = ready
    ? summarizeAttendance(state.people, state.attendance, { ...range, today })
    : [];
  const unknown = summary.filter((row) => row.missing === null).length;
  const byId = new Map(state.people.map((person) => [person.id, person]));
  const label =
    mode === "month"
      ? dateLabel(range.from, { month: "long", year: "numeric" })
      : dateLabel(date);
  const payload = {
    rows: state.attendance.map((item) => ({
      ...item,
      name: byId.get(item.user_id)?.name || "Anak magang",
      university: byId.get(item.user_id)?.university || "—",
      major: byId.get(item.user_id)?.major || "—",
      in: attendanceTime(item.check_in),
      out: attendanceTime(item.check_out),
    })),
    summary,
    requests: state.requests.map((item) => ({
      ...item,
      name: byId.get(item.user_id)?.name || "Anak magang",
    })),
    label,
    fileKey: mode === "month" ? month : date,
    note: REPORT_NOTE,
  };
  const download = async (format) => {
    if (!ready || exporting) return;
    setExporting(true);
    try {
      await (format === "Excel"
        ? exportAttendanceExcel(payload)
        : exportAttendancePdf(payload));
      flash(`File ${format} berhasil diunduh.`);
    } catch {
      flash("Laporan gagal diunduh. Silakan coba lagi.", "error");
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <div className="panel report-filter">
        <div>
          <h2>Rekap Laporan</h2>
          <p>Pilih tanggal atau bulan untuk melihat dan mengunduh rekap.</p>
        </div>
        <select
          aria-label="Jenis periode laporan"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="date">Tanggal</option>
          <option value="month">Bulanan</option>
        </select>
        <input
          aria-label="Periode laporan"
          type={mode === "month" ? "month" : "date"}
          value={mode === "month" ? month : date}
          onChange={(event) => {
            if (event.target.value)
              (mode === "month" ? setMonth : setDate)(event.target.value);
          }}
        />
        <button
          className="primary"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {loading ? "Memuat…" : "Tampilkan"}
        </button>
      </div>
      {loading ? (
        <>
          <Skeleton variant="cards" label="Memuat ringkasan laporan…" />
          <Skeleton variant="table" label="Memuat rekap peserta…" />
        </>
      ) : state.error ? (
        <div className="data-load-error" role="alert">
          <span>{state.error}</span>
          <button
            className="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          <section className="stat-grid report-stats">
            {columns.map(([field, title]) => (
              <div className="stat-card simple" key={field}>
                <b>
                  {summary.reduce((total, row) => total + (row[field] || 0), 0)}
                </b>
                <small>
                  {title}
                  {field === "missing" && unknown > 0
                    ? " (data lengkap saja)"
                    : ""}
                </small>
              </div>
            ))}
          </section>
          <section className="panel report-summary">
            <h3>Rekap per peserta · {label}</h3>
            <p className="report-explanation">{REPORT_NOTE}</p>
            {unknown > 0 && (
              <p className="report-explanation">
                {unknown} peserta belum dapat dihitung hari tanpa catatannya.
                Lengkapi tanggal mulai; akun nonaktif juga memerlukan tanggal
                selesai.
              </p>
            )}
            {summary.length ? (
              <>
                <div className="report-summary-desktop">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama</th>
                        {columns.map(([field, title]) => (
                          <th key={field}>{title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <b>{person.name}</b>
                          </td>
                          {columns.map(([field]) => (
                            <td key={field}>{person[field] ?? "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="report-summary-mobile">
                  {summary.map((person) => (
                    <article key={person.id}>
                      <h4>{person.name}</h4>
                      <dl>
                        {columns.map(([field, title]) => (
                          <div key={field}>
                            <dt>{title}</dt>
                            <dd>{person[field] ?? "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">Belum ada peserta untuk direkap.</p>
            )}
          </section>
        </>
      )}
      <div className="panel export">
        <FileText size={28} />
        <div>
          <h3>Unduh laporan absensi</h3>
          <p>
            Rekap {label}, termasuk Izin, Sakit, Alpa, dan hari tanpa catatan.
          </p>
        </div>
        <button
          className="outline"
          disabled={!ready || exporting}
          onClick={() => download("Excel")}
        >
          <Download size={16} /> Export Excel
        </button>
        <button
          className="primary"
          disabled={!ready || exporting}
          onClick={() => download("PDF")}
        >
          <Download size={16} /> Export PDF
        </button>
      </div>
    </>
  );
}
