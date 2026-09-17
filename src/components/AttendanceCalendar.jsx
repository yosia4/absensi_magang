import React, { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  attendanceTime,
  attendanceTone as toneOf,
  calendarDayType,
  calendarStatus,
  dateLabel,
  jakartaToday,
  monthRange,
  shiftDate,
} from "../attendanceVisuals";
import useAttendanceRange from "./useAttendanceRange";
import "./AttendanceVisuals.css";

export default function AttendanceCalendar({ client, user, data }) {
  const today = jakartaToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = monthRange(month);
  const { rows, loading, error, retry } = useAttendanceRange(client, {
    ...range,
    userId: user.id,
    demoData: data,
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const startOffset = (new Date(`${range.from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const dates = Array.from({ length: Number(range.to.slice(-2)) }, (_, index) =>
    shiftDate(range.from, index),
  );
  const record = byDate.get(selected);
  const status = calendarStatus(selected, record, today, user);
  const selectedDayType = calendarDayType(selected);
  const changeMonth = (next) => {
    if (!/^\d{4}-\d{2}$/.test(next)) return;
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };
  return (
    <section
      className="panel attendance-calendar"
      aria-label="Kalender kehadiran"
    >
      <div className="visual-heading">
        <div>
          <span className="visual-eyebrow">
            <CalendarDays size={15} /> RIWAYAT BULANAN
          </span>
          <h2>Kalender Kehadiran</h2>
          <p>Pilih tanggal untuk melihat detail absensi.</p>
        </div>
        <div className="visual-controls">
          <button
            type="button"
            className="outline visual-arrow"
            aria-label="Bulan sebelumnya"
            onClick={() => changeMonth(shiftDate(range.from, -1).slice(0, 7))}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="month"
            aria-label="Bulan kalender kehadiran"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
          />
          <button
            type="button"
            className="outline visual-arrow"
            aria-label="Bulan berikutnya"
            onClick={() => changeMonth(shiftDate(range.to, 1).slice(0, 7))}
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              changeMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            Hari ini
          </button>
        </div>
      </div>
      <div className="visual-legend">
        {[
          ...ATTENDANCE_STATUSES,
          { name: "Belum Absen", tone: "missing" },
          { name: "Minggu · Libur", tone: "holiday" },
          { name: "Sabtu · Opsional", tone: "optional" },
        ].map(({ name, tone }) => (
          <span key={name}>
            <i className={`visual-dot tone-${tone}`} />
            {name}
          </span>
        ))}
      </div>
      {error ? (
        <div className="visual-state" role="alert">
          <p>{error}</p>
          <button type="button" className="outline" onClick={retry}>
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="calendar-layout" aria-busy={loading}>
          <div>
            <h3 className="calendar-month-title">
              {dateLabel(range.from, { month: "long", year: "numeric" })}
            </h3>
            <div className="calendar-grid">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                <span
                  className={`calendar-weekday${day === "Min" ? " weekend-holiday" : day === "Sab" ? " weekend-optional" : ""}`}
                  key={day}
                >
                  {day}
                </span>
              ))}
              {Array.from({ length: startOffset }, (_, index) => (
                <span key={`empty-${index}`} aria-hidden="true" />
              ))}
              {dates.map((date) => {
                const dayType = calendarDayType(date);
                const dayStatus = calendarStatus(
                  date,
                  byDate.get(date),
                  today,
                  user,
                );
                return (
                  <button
                    type="button"
                    key={date}
                    disabled={loading}
                    className={`calendar-day tone-${dayType === "Libur" ? "holiday" : loading ? "neutral" : toneOf(dayStatus)}${selected === date ? " is-selected" : ""}${date === today ? " is-today" : ""}`}
                    aria-label={`${dateLabel(date)}, ${dayType ? `${dayType}, ` : ""}${loading ? "Memuat" : dayStatus}`}
                    aria-pressed={selected === date}
                    aria-current={date === today ? "date" : undefined}
                    onClick={() => setSelected(date)}
                  >
                    <b>{Number(date.slice(-2))}</b>
                    <span>{loading ? "…" : dayStatus}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="calendar-detail"
            role="region"
            aria-label="Detail tanggal absensi"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="visual-eyebrow">DETAIL TANGGAL</span>
            <h3>
              {dateLabel(selected, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
            {loading ? (
              <p role="status">Memuat absensi…</p>
            ) : (
              <>
                <span className={`visual-status tone-${toneOf(status)}`}>
                  {status}
                </span>
                {selectedDayType && (
                  <p className="calendar-schedule-note">
                    {selectedDayType === "Libur"
                      ? "Minggu adalah hari libur. Tidak wajib absen."
                      : "Sabtu masuk opsional. Tidak absen pada hari ini bukan ketidakhadiran."}
                  </p>
                )}
                <dl>
                  <div>
                    <dt>Jam masuk</dt>
                    <dd>{attendanceTime(record?.check_in)}</dd>
                  </div>
                  <div>
                    <dt>Jam pulang</dt>
                    <dd>{attendanceTime(record?.check_out)}</dd>
                  </div>
                </dl>
                <p>
                  {record
                    ? record.check_in && !record.check_out
                      ? "Check-in tercatat. Belum ada catatan check-out."
                      : "Status sesuai catatan absensi yang tersimpan."
                    : selectedDayType
                      ? "Jika ada absensi, catatannya tetap ditampilkan di sini."
                      : selected > today
                        ? "Tanggal ini belum berlangsung."
                        : "Tidak ada catatan absensi pada tanggal ini."}
                </p>
              </>
            )}
          </div>
        </div>
      )}
      <p className="visual-note">
        Minggu libur, Sabtu masuk opsional. Belum Absen hanya ditampilkan pada
        Senin–Jumat tanpa catatan, bukan otomatis Alpa. Catatan absensi akhir
        pekan tetap ditampilkan.
      </p>
    </section>
  );
}
