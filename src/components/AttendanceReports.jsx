import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  HeartPulse,
  Search,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import {
  dateLabel,
  fetchAttendanceRange,
  jakartaToday,
  monthRange,
} from "../attendanceVisuals";
import { fetchAllPages, REPORT_NOTE } from "../attendanceSummary";
import { prepareReport, validReportRange } from "../reportData";
import { exportAttendanceExcel, exportAttendancePdf } from "../reportExport";
import Skeleton from "./Skeleton";
import StatusBadge from "./StatusBadge";
import PageHeading from "./PageHeading";
import "./AttendanceReports.css";

const columns = [
  ["hadir", "Hadir", "present", CheckCircle2],
  ["terlambat", "Terlambat", "late", Clock],
  ["izin", "Izin", "leave", FileText],
  ["sakit", "Sakit", "sick", HeartPulse],
  ["alpa", "Alpa", "absent", UserRoundX],
];
const emptyData = { people: [], attendance: [], requests: [] };

function ParticipantDetail({ person, rows, label, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="report-detail"
      aria-labelledby="report-detail-title"
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="report-detail-content">
        <button
          className="report-close outline"
          onClick={onClose}
          aria-label="Tutup rincian"
        >
          <X size={18} />
        </button>
        <h2 id="report-detail-title">{person.name}</h2>
        <p>
          {person.university} · {label}
        </p>
        <div className="report-detail-counts">
          {columns.map(([field, title]) => (
            <span key={field}>
              {title}: <b>{person[field] ?? "—"}</b>
            </span>
          ))}
        </div>
        <p className="report-explanation">
          Jam masuk dan pulang dalam WIB. Rincian berikut menampilkan catatan
          absensi yang tersimpan.
        </p>
        {rows.length ? (
          <div className="report-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Masuk</th>
                  <th>Pulang</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date}>
                    <td>{dateLabel(row.date)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.in}</td>
                    <td>{row.out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">
            Belum ada catatan absensi pada periode ini.
          </p>
        )}
      </div>
    </dialog>
  );
}

export default function AttendanceReports({ client, flash }) {
  const today = jakartaToday();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(monthRange(today.slice(0, 7)).from);
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState(() => ({
    ...monthRange(today.slice(0, 7)),
    mode: "month",
  }));
  const [validation, setValidation] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [participantId, setParticipantId] = useState("");
  const [signature, setSignature] = useState(false);
  const [supervisorName, setSupervisorName] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState("");
  const [state, setState] = useState({
    ...emptyData,
    key: "",
    loading: true,
    error: "",
  });
  const range = useMemo(() => ({ from: period.from, to: period.to }), [period]);
  const key = `${range.from}:${range.to}:${today}`;
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({ ...emptyData, key, loading: true, error: "" });
      try {
        if (!client)
          throw new Error("Laporan tersedia setelah terhubung ke database.");
        const [people, attendance, requests] = await Promise.all([
          fetchAllPages(
            () =>
              client
                .from("profiles")
                .select(
                  "id,name,university,major,internship_start,internship_end",
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
            attendance,
            requests,
            loading: false,
            error: "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            ...emptyData,
            key,
            loading: false,
            error: client
              ? "Laporan belum dapat dimuat. Periksa koneksi lalu coba lagi."
              : error.message,
          });
      }
    };
    load();
    return () => controller.abort();
  }, [client, key, range, revision]);
  const loading = state.key !== key || state.loading;
  const ready = !loading && !state.error;
  const report = useMemo(
    () =>
      prepareReport(
        ready ? state : emptyData,
        { ...range, today },
        search,
        sort,
        participantId,
      ),
    [ready, state, range, today, search, sort, participantId],
  );
  const { summary } = report;
  const participantOptions = useMemo(
    () =>
      [...state.people].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "id"),
      ),
    [state.people],
  );
  const label =
    period.mode === "month"
      ? dateLabel(range.from, { month: "long", year: "numeric" })
      : range.from === range.to
        ? dateLabel(range.from)
        : `${dateLabel(range.from)} – ${dateLabel(range.to)}`;
  const selected = summary.find((person) => person.id === selectedId);
  const activate = (next) => {
    setValidation("");
    setSelectedId(null);
    setPeriod(next);
    setRevision((value) => value + 1);
  };
  const applyPeriod = (event) => {
    event.preventDefault();
    if (mode === "month" && !validReportRange(`${month}-01`, `${month}-01`)) {
      setValidation("Pilih bulan yang valid.");
      return;
    }
    const next =
      mode === "month"
        ? monthRange(month)
        : mode === "date"
          ? { from: date, to: date }
          : { from, to };
    if (!validReportRange(next.from, next.to)) {
      setValidation(
        "Isi tanggal yang valid. Tanggal selesai harus sama atau setelah tanggal mulai.",
      );
      return;
    }
    activate({ ...next, mode });
  };
  const download = async (format) => {
    if (!ready || exporting || !summary.length) return;
    if (format === "PDF" && signature && !supervisorName.trim()) {
      flash("Isi nama pembimbing untuk tanda tangan PDF.", "error");
      return;
    }
    setExporting(format);
    const payload = {
      ...report,
      label,
      fileKey:
        period.mode === "month"
          ? range.from.slice(0, 7)
          : range.from === range.to
            ? range.from
            : `${range.from}_${range.to}`,
      note: REPORT_NOTE,
      search: search.trim(),
      participantName: participantId ? summary[0].name : "",
      signature,
      supervisorName: supervisorName.trim(),
    };
    if (participantId) {
      const name =
        (summary[0].name || "peserta")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "peserta";
      payload.fileKey += `-${name}`;
    }
    try {
      await (format === "Excel"
        ? exportAttendanceExcel(payload)
        : exportAttendancePdf(payload));
      flash(`File ${format} berhasil diunduh.`);
    } catch {
      flash("Laporan gagal diunduh. Silakan coba lagi.", "error");
    } finally {
      setExporting("");
    }
  };
  return (
    <div className="attendance-reports">
      <section className="panel report-header">
        <PageHeading
          icon={FileText}
          title="Laporan Kehadiran"
          description="Tinjau rekap kehadiran peserta dan unduh laporan sesuai kebutuhan."
          actions={
            <div className="report-downloads">
              <button
                className="outline"
                disabled={!ready || !!exporting || !summary.length}
                onClick={() => download("Excel")}
              >
                <Download size={16} />
                {exporting === "Excel" ? "Mengunduh…" : "Unduh Excel"}
              </button>
              <button
                className="primary"
                disabled={
                  !ready ||
                  !!exporting ||
                  !summary.length ||
                  (signature && !supervisorName.trim())
                }
                onClick={() => download("PDF")}
              >
                <Download size={16} />
                {exporting === "PDF" ? "Mengunduh…" : "Unduh PDF"}
              </button>
            </div>
          }
        >
          <p className="report-period">
            <CalendarDays size={16} />
            Periode aktif: {label}
          </p>
        </PageHeading>
        <div className="report-export-options">
          <span>
            PDF berisi rekap per peserta. Unduhan mengikuti periode aktif,
            pilihan peserta, dan pencarian.
          </span>
          <div className="report-signature-options">
            <label>
              <input
                type="checkbox"
                checked={signature}
                onChange={(event) => setSignature(event.target.checked)}
              />
              Ruang tanda tangan pembimbing di PDF
            </label>
            <label className="report-supervisor">
              Nama pembimbing
              <input
                type="text"
                value={supervisorName}
                maxLength={100}
                required={signature}
                placeholder="Masukkan nama lengkap pembimbing"
                onChange={(event) => setSupervisorName(event.target.value)}
                aria-describedby="supervisor-hint"
              />
              <small id="supervisor-hint">
                Wajib diisi jika tanda tangan PDF diaktifkan.
              </small>
            </label>
          </div>
        </div>
        <form className="report-controls" onSubmit={applyPeriod}>
          <label>
            Jenis periode
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
                setValidation("");
              }}
            >
              <option value="date">Tanggal</option>
              <option value="month">Bulanan</option>
              <option value="range">Rentang tanggal</option>
            </select>
          </label>
          {mode === "range" ? (
            <>
              <label>
                Tanggal mulai
                <input
                  type="date"
                  required
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                Tanggal selesai
                <input
                  type="date"
                  required
                  min={from || undefined}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              {mode === "month" ? "Bulan" : "Tanggal"}
              <input
                required
                type={mode === "month" ? "month" : "date"}
                value={mode === "month" ? month : date}
                onChange={(event) =>
                  (mode === "month" ? setMonth : setDate)(event.target.value)
                }
              />
            </label>
          )}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Memuat…" : "Tampilkan"}
          </button>
        </form>
        {validation && (
          <p className="report-validation" role="alert">
            {validation}
          </p>
        )}
      </section>
      <div className="report-searchbar">
        <label className="report-participant-filter">
          Pilih peserta
          <select
            aria-label="Pilih peserta"
            value={participantId}
            disabled={!ready}
            onChange={(event) => {
              setParticipantId(event.target.value);
              setSearch("");
              setSelectedId(null);
            }}
          >
            <option value="">Semua peserta</option>
            {participantId &&
              !state.people.some((person) => person.id === participantId) && (
                <option value={participantId} disabled>
                  {loading ? "Memuat peserta…" : "Peserta tidak tersedia"}
                </option>
              )}
            {participantOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.university ? ` · ${person.university}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="report-search">
          <span>Cari peserta</span>
          <div>
            <Search size={17} />
            <input
              type="search"
              placeholder="Ketik nama peserta…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
            />
          </div>
        </label>
        <label>
          Urutkan
          <select
            aria-label="Urutkan"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">Nama A–Z</option>
            <option value="terlambat">Terlambat terbanyak</option>
          </select>
        </label>
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
          <div className="report-count" aria-live="polite">
            <Users size={18} />
            <b>{summary.length} peserta</b>
            <span>
              dari {state.people.length} peserta dalam rekap
              {participantId ? " · peserta terpilih" : ""}
              {search.trim() ? " · sesuai pencarian" : ""}
            </span>
          </div>
          <section className="report-stats" aria-label="Ringkasan kehadiran">
            {columns.map(([field, title, tone, Icon]) => (
              <div className={`report-stat tone-${tone}`} key={field}>
                <span className="report-stat-icon">
                  <Icon size={20} />
                </span>
                <span className="report-stat-title">{title}</span>
                <b>
                  {summary.reduce((total, row) => total + (row[field] || 0), 0)}
                </b>
                <small>catatan absensi</small>
              </div>
            ))}
          </section>
          <p className="report-explanation">
            Hadir, Terlambat, Izin, Sakit, dan Alpa menunjukkan jumlah catatan
            absensi, bukan jumlah peserta.
          </p>
          <section className="panel report-summary">
            <div className="report-summary-heading">
              <div>
                <h3>Rekap per peserta</h3>
                <p>Klik nama peserta untuk melihat rincian absensi · {label}</p>
              </div>
              <span>{summary.length} peserta</span>
            </div>
            <details className="report-rules">
              <summary>Cara perhitungan</summary>
              <p className="report-explanation">{REPORT_NOTE}</p>
            </details>
            {summary.length ? (
              <>
                <div className="report-summary-desktop">
                  <table>
                    <thead>
                      <tr>
                        <th>Peserta / Universitas</th>
                        {columns.map(([field, title]) => (
                          <th key={field}>{title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <button
                              className="report-person"
                              onClick={() => setSelectedId(person.id)}
                              aria-label={`Lihat rincian absensi ${person.name}`}
                            >
                              {person.name}
                            </button>
                            <span className="report-university">
                              {person.university}
                            </span>
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
                      <button
                        className="report-person"
                        onClick={() => setSelectedId(person.id)}
                        aria-label={`Lihat rincian absensi ${person.name}`}
                      >
                        {person.name}
                      </button>
                      <span className="report-university">
                        {person.university}
                      </span>
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
              <div className="empty-state">
                <p>
                  {search.trim()
                    ? "Tidak ada peserta yang cocok dengan pencarian."
                    : participantId
                      ? "Peserta yang dipilih tidak tersedia. Pilih peserta lain atau Semua peserta."
                      : "Belum ada peserta untuk direkap."}
                </p>
                {search.trim() && (
                  <button className="outline" onClick={() => setSearch("")}>
                    Hapus pencarian
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {selected && ready && (
        <ParticipantDetail
          person={selected}
          rows={report.rows.filter((row) => row.user_id === selected.id)}
          label={label}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
