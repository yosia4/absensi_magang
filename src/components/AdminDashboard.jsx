import React from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  LogIn,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { dateLabel } from "../attendanceVisuals";
import { summarizeAdminDashboard } from "../adminDashboardData";
import AttendanceTrend from "./AttendanceTrend";
import AttendanceTable from "./AttendanceTable";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";
import "./StatusColors.css";
import "./AdminDashboard.css";

const statuses = [
  ["Hadir", "present", CheckCircle2],
  ["Terlambat", "late", Clock3],
  ["Izin", "leave", FileText],
  ["Sakit", "sick", HeartPulse],
  ["Alpa", "absent", UserRoundX],
];

export default function AdminDashboard({
  rows,
  nav,
  loading,
  error,
  onRetry,
  client,
  now,
  today,
  workEndTime,
  pendingRequests,
}) {
  const data = summarizeAdminDashboard(rows, { today, now, workEndTime });
  const stats = [
    [
      "Seluruh akun peserta",
      data.total,
      Users,
      "Termasuk akun aktif dan nonaktif",
      "neutral",
    ],
    ["Peserta aktif", data.active, UserCheck, "Akun berstatus aktif", "leave"],
    [
      "Sudah Check-in",
      data.checkedIn,
      LogIn,
      "Termasuk peserta yang terlambat",
      "present",
    ],
  ];
  return (
    <div className="admin-dashboard">
      <section className="panel admin-dashboard-hero">
        <div>
          <span className="admin-dashboard-eyebrow">RAWUH PUSTAKA</span>
          <h2>Dashboard Admin</h2>
          <p>Ringkasan kehadiran peserta magang</p>
        </div>
        <div className="admin-dashboard-date">
          <CalendarDays size={20} />
          <span>
            {dateLabel(today, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            <small>Waktu Indonesia Barat</small>
          </span>
        </div>
      </section>
      {error ? (
        <div className="data-load-error" role="alert">
          <span>
            Ringkasan kehadiran belum dapat dimuat. Silakan coba lagi.
          </span>
          <button className="outline" onClick={onRetry}>
            Coba lagi
          </button>
        </div>
      ) : loading ? (
        <Skeleton variant="cards" label="Memuat ringkasan admin…" />
      ) : (
        <>
          <section
            className="admin-dashboard-stats"
            aria-label="Ringkasan peserta hari ini"
          >
            {stats.map(([title, count, Icon, description, tone]) => (
              <article className={`admin-metric tone-${tone}`} key={title}>
                <span className="admin-metric-icon">
                  <Icon size={23} />
                </span>
                <div>
                  <span>{title}</span>
                  <b>{count}</b>
                  <small>{description}</small>
                </div>
              </article>
            ))}
          </section>
          <section
            className="admin-status-grid"
            aria-label="Status absensi hari ini"
          >
            {statuses.map(([title, tone, Icon]) => (
              <article className={`admin-status-card tone-${tone}`} key={title}>
                <span className="admin-status-icon">
                  <Icon size={18} />
                </span>
                <span>{title}</span>
                <b>{data.counts[title]}</b>
                <small>peserta hari ini</small>
              </article>
            ))}
          </section>
        </>
      )}
      <section
        className="panel admin-followups"
        aria-labelledby="admin-followups-title"
      >
        <div className="admin-followups-heading">
          <div>
            <h2 id="admin-followups-title">Perlu ditindaklanjuti</h2>
            <p>Pengajuan dan pengingat untuk pembimbing.</p>
          </div>
          <span className="admin-followups-note">Diperbarui otomatis</span>
        </div>
        <div className="admin-followup-grid">
          <article
            className={`admin-followup ${pendingRequests.count > 0 ? "has-pending" : ""}`}
          >
            <div className="admin-followup-heading">
              <span className="admin-followup-icon">
                <Bell size={20} />
              </span>
            </div>
            <h3>Pengajuan menunggu</h3>
            <div aria-live="polite">
              <b className="admin-followup-number">
                {pendingRequests.loading || pendingRequests.error
                  ? "—"
                  : pendingRequests.count}
              </b>
              <span> pengajuan</span>
            </div>
            <p>Izin, sakit, dan lupa absen yang perlu ditinjau.</p>
            {pendingRequests.error ? (
              <div role="alert" className="admin-followup-error">
                <small>{pendingRequests.error}</small>
                <button className="text-btn" onClick={pendingRequests.refresh}>
                  Coba lagi
                </button>
              </div>
            ) : (
              !pendingRequests.loading &&
              pendingRequests.count === 0 && (
                <small className="admin-followup-empty">
                  Semua pengajuan sudah ditangani.
                </small>
              )
            )}
            <button
              className="admin-followup-link"
              onClick={() => nav("requests")}
            >
              Tinjau pengajuan <ArrowRight size={16} />
            </button>
          </article>
          <article className="admin-followup">
            <span className="admin-followup-icon tone-late">
              <Clock3 size={20} />
            </span>
            <h3>Belum check-out</h3>
            <div>
              <b className="admin-followup-number">
                {loading || error || !data.hasWorkEnd
                  ? "—"
                  : data.checkoutPending.length}
              </b>
              <span> peserta</span>
            </div>
            <p>
              {data.hasWorkEnd
                ? `Diperiksa setelah jam pulang ${workEndTime} WIB.`
                : "Jam pulang belum tersedia. Periksa pengaturan jam kerja."}
            </p>
            {!loading &&
              !error &&
              data.hasWorkEnd &&
              (data.checkoutPending.length ? (
                <ul>
                  {data.checkoutPending.slice(0, 3).map((row) => (
                    <li key={row.id}>
                      <button onClick={() => nav("monitor")}>{row.name}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <small className="admin-followup-empty">
                  {data.afterWork
                    ? "Tidak ada peserta yang perlu diperiksa."
                    : "Jam pulang belum tiba."}
                </small>
              ))}
            <button
              className="admin-followup-link"
              onClick={() => nav(data.hasWorkEnd ? "monitor" : "settings")}
            >
              {data.hasWorkEnd ? "Buka monitoring" : "Atur jam pulang"}{" "}
              <ArrowRight size={16} />
            </button>
          </article>
          <article className="admin-followup">
            <span className="admin-followup-icon tone-leave">
              <CalendarDays size={20} />
            </span>
            <h3>Magang segera selesai</h3>
            <div>
              <b className="admin-followup-number">
                {loading || error ? "—" : data.ending.length}
              </b>
              <span> peserta aktif</span>
            </div>
            <p>Masa magang berakhir hari ini hingga 7 hari ke depan.</p>
            {!loading &&
              !error &&
              (data.ending.length ? (
                <ul>
                  {data.ending.slice(0, 3).map((row) => (
                    <li key={row.id}>
                      <button onClick={() => nav("interns")}>
                        {row.name}
                        <small>{dateLabel(row.internship_end)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <small className="admin-followup-empty">
                  Belum ada masa magang yang segera berakhir.
                </small>
              ))}
            <button
              className="admin-followup-link"
              onClick={() => nav("interns")}
            >
              Lihat anak magang <ArrowRight size={16} />
            </button>
          </article>
        </div>
      </section>
      <AttendanceTrend client={client} />
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Absensi Hari Ini</h2>
            <p>{dateLabel(today)} · WIB</p>
          </div>
          <button className="text-btn" onClick={() => nav("monitor")}>
            Lihat monitoring
          </button>
        </div>
        {!error &&
          !loading &&
          rows.length > 0 &&
          Object.values(data.counts).every((count) => count === 0) && (
            <EmptyState
              compact
              title="Belum ada absensi hari ini"
              description="Catatan kehadiran akan muncul saat peserta absen atau statusnya dicatat oleh pembimbing."
            />
          )}
        {!error && (
          <AttendanceTable
            rows={rows}
            loading={loading}
            emptyState={{
              actionLabel: "Kelola anak magang",
              onAction: () => nav("interns"),
            }}
          />
        )}
        {error && (
          <p className="empty-state">
            Tabel tersedia setelah data berhasil dimuat.
          </p>
        )}
      </section>
    </div>
  );
}
