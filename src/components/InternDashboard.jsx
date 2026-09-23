import React from "react";
import {
  Clock3,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react";
import { dateLabel as formatDate, jakartaToday } from "../attendanceVisuals";
import { attendanceDisplayState } from "../attendanceSummary";
import StatusBadge from "./StatusBadge";
import AttendanceScanActions from "./AttendanceScanActions";

export default function InternDashboard({ user, record, nav, attendance, onStartScan }) {
  const today = jakartaToday();
  const display = attendanceDisplayState(record);
  const { checkedIn } = display;
  const history = [...attendance].sort((a, b) => b.date.localeCompare(a.date));
  const hadir = history.filter(
    (x) => attendanceDisplayState(x).checkedIn,
  ).length;
  const terlambat = history.filter((x) => x.status === "Terlambat").length;
  const selesai = history.filter(
    (x) => attendanceDisplayState(x).complete,
  ).length;
  const rate = hadir ? Math.round((selesai / hadir) * 100) : 0;
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">{formatDate(today)}</span>
          <h2>{display.title}</h2>
          <p>{display.description}</p>
        </div>
        <div className="hero-orb">
          <Clock3 size={30} />
          <b>{record?.check_in || "--:--"}</b>
          <small>JAM MASUK</small>
        </div>
      </div>
      <section className="status-grid">
        <div className="status-card">
          {user.photo_url ? (
            <img
              className="avatar large table-photo"
              src={user.photo_url}
              alt={user.name}
            />
          ) : (
            <div className="avatar large">{user.initials}</div>
          )}
          <div>
            <small>STATUS KEHADIRAN</small>
            <h3>{display.status}</h3>
            <StatusBadge status={display.status} />
            <p className="attendance-progress">{display.progress}</p>
          </div>
        </div>
        <div className="time-card">
          <small>JAM MASUK</small>
          <strong>{record?.check_in || "--:--"}</strong>
          <span>
            {record?.check_in ? "Tercatat hari ini" : "Belum ada jam masuk"}
          </span>
        </div>
        <div className="time-card">
          <small>JAM PULANG</small>
          <strong>{record?.check_out || "--:--"}</strong>
          <span>
            {record?.check_out
              ? "Tercatat hari ini"
              : checkedIn
                ? "Menunggu check-out"
                : "Belum ada jam pulang"}
          </span>
        </div>
      </section>
      <AttendanceScanActions record={record} onStart={onStartScan} />
      <section className="split">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Ringkasan Kehadiran</h3>
              <p>Data absensi Anda saat ini</p>
            </div>
            <MoreHorizontal />
          </div>
          <div className="metrics">
            <div>
              <b>{hadir}</b>
              <span>Total hadir</span>
            </div>
            <div>
              <b>{rate}%</b>
              <span>Absensi selesai</span>
            </div>
            <div>
              <b>{terlambat}</b>
              <span>Terlambat</span>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Aktivitas Terakhir</h3>
              <p>Riwayat absensi Anda</p>
            </div>
            <button className="text-btn" onClick={() => nav("history")}>
              Lihat semua
            </button>
          </div>
          {history.length ? (
            history.slice(0, 2).map((x, i) => (
              <div className="activity" key={i}>
                <span className="mini-icon">
                  <CalendarDays size={16} />
                </span>
                <div>
                  <b>{formatDate(x.date)}</b>
                  <small>
                    {x.check_in || "-"} —{" "}
                    {x.check_out ||
                      (attendanceDisplayState(x).checkedIn
                        ? "Belum pulang"
                        : "-")}
                  </small>
                </div>
                <StatusBadge status={x.status} />
              </div>
            ))
          ) : (
            <div className="activity">
              <span className="mini-icon">
                <CalendarDays size={16} />
              </span>
              <div>
                <b>Belum ada aktivitas</b>
                <small>Riwayat absensi akan tampil setelah scan pertama.</small>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
