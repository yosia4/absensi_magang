import React, { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  dailyTrend,
  dateLabel,
  jakartaToday,
  monthRange,
  shiftDate,
  weekRange,
} from "../attendanceVisuals";
import useAttendanceRange from "./useAttendanceRange";
import Skeleton from "./Skeleton";
import "./AttendanceVisuals.css";

export default function AttendanceTrend({ client }) {
  const today = jakartaToday();
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const range =
    mode === "week" ? weekRange(anchor) : monthRange(anchor.slice(0, 7));
  const { rows, loading, error, retry } = useAttendanceRange(client, range);
  const days = dailyTrend(
    rows.filter((row) => row.date <= today),
    range.from,
    range.to,
  );
  const selectedDay =
    days.find((day) => day.date === selected) ||
    days.find((day) => day.date === today) ||
    days[0];
  const max = Math.max(
    2,
    Math.ceil(Math.max(0, ...days.map((day) => day.total)) / 2) * 2,
  );
  const totals = ATTENDANCE_STATUSES.map((status) => ({
    ...status,
    count: days.reduce((sum, day) => sum + day.counts[status.name], 0),
  }));
  const hasData = days.some((day) => day.total > 0);
  const selectAnchor = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setAnchor(date);
    setSelected(date);
  };
  const navigate = (direction) =>
    selectAnchor(
      mode === "week"
        ? shiftDate(anchor, direction * 7)
        : direction < 0
          ? shiftDate(range.from, -1)
          : shiftDate(range.to, 1),
    );
  return (
    <section
      className="panel attendance-trend"
      aria-label="Grafik tren kehadiran"
    >
      <div className="visual-heading">
        <div>
          <span className="visual-eyebrow">
            <TrendingUp size={15} /> PEMANTAUAN KEHADIRAN
          </span>
          <h2>Tren Kehadiran</h2>
          <p>Jumlah peserta per status pada setiap tanggal.</p>
        </div>
        <div className="trend-mode" role="group" aria-label="Periode grafik">
          <button
            type="button"
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            Mingguan
          </button>
          <button
            type="button"
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Bulanan
          </button>
        </div>
      </div>
      <div className="trend-toolbar">
        <h3>
          {mode === "week"
            ? `${dateLabel(range.from, { day: "numeric", month: "short" })} – ${dateLabel(range.to)}`
            : dateLabel(range.from, { month: "long", year: "numeric" })}
        </h3>
        <div className="visual-controls">
          <button
            type="button"
            className="outline visual-arrow"
            aria-label="Periode sebelumnya"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type={mode === "week" ? "date" : "month"}
            aria-label={
              mode === "week" ? "Tanggal dalam minggu grafik" : "Bulan grafik"
            }
            value={mode === "week" ? anchor : anchor.slice(0, 7)}
            onChange={(event) =>
              selectAnchor(
                mode === "week"
                  ? event.target.value
                  : `${event.target.value}-01`,
              )
            }
          />
          <button
            type="button"
            className="outline visual-arrow"
            aria-label="Periode berikutnya"
            onClick={() => navigate(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => selectAnchor(today)}
          >
            Periode ini
          </button>
        </div>
      </div>
      {loading ? (
        <Skeleton variant="chart" label="Memuat tren kehadiran…" />
      ) : error ? (
        <div className="visual-state" role="alert">
          <p>{error}</p>
          <button type="button" className="outline" onClick={retry}>
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          <div className="trend-totals">
            {totals.map(({ name, tone, count }) => (
              <div key={name}>
                <span>
                  <i className={`visual-dot tone-${tone}`} />
                  {name}
                </span>
                <b>{count}</b>
                <small>catatan</small>
              </div>
            ))}
          </div>
          {!hasData && (
            <p className="trend-empty" role="status">
              Belum ada catatan absensi pada periode ini.
            </p>
          )}
          <p className="visual-note" id="attendance-trend-help">
            Klik batang atau tanggal untuk melihat rinciannya. Tinggi batang
            menunjukkan jumlah peserta; hari mendatang belum dihitung.
          </p>
          <div className="trend-plot-layout">
            <div className="trend-axis" aria-hidden="true">
              <span>{max}</span>
              <span>{Math.ceil(max / 2)}</span>
              <span>0</span>
            </div>
            <div
              className="trend-scroll"
              role="region"
              aria-label="Grafik harian, dapat digeser mendatar"
              tabIndex={0}
            >
              <div
                className={`trend-plot ${mode === "month" ? "is-month" : "is-week"}`}
                aria-describedby="attendance-trend-help"
              >
                {days.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`trend-column${day.date === selectedDay.date ? " is-selected" : ""}`}
                    aria-pressed={day.date === selectedDay.date}
                    aria-label={`${dateLabel(day.date)}: ${day.date > today ? "belum berlangsung" : ATTENDANCE_STATUSES.map(({ name }) => `${name} ${day.counts[name]}`).join(", ")}`}
                    onClick={() => setSelected(day.date)}
                  >
                    <span className="trend-stack-space" aria-hidden="true">
                      {day.total > 0 && (
                        <span
                          className="trend-count"
                          style={{ bottom: `${(day.total / max) * 100}%` }}
                        >
                          {day.total}
                        </span>
                      )}
                      <span
                        className="trend-stack"
                        style={{ height: `${(day.total / max) * 100}%` }}
                      >
                        {ATTENDANCE_STATUSES.map(
                          ({ name, tone }) =>
                            day.counts[name] > 0 && (
                              <span
                                key={name}
                                className={`trend-segment tone-${tone}`}
                                style={{ flex: day.counts[name] }}
                              />
                            ),
                        )}
                      </span>
                      {!day.total && (
                        <span className="trend-zero">
                          {day.date > today ? "·" : "0"}
                        </span>
                      )}
                    </span>
                    <span className="trend-date">
                      {mode === "week"
                        ? dateLabel(day.date, { weekday: "short" })
                        : Number(day.date.slice(-2))}
                    </span>
                    {mode === "week" && (
                      <small>
                        {dateLabel(day.date, {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="trend-detail" aria-live="polite" aria-atomic="true">
            <b>
              {dateLabel(selectedDay.date, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </b>
            {selectedDay.date > today ? (
              <p>Tanggal ini belum berlangsung.</p>
            ) : (
              <div className="visual-legend">
                {ATTENDANCE_STATUSES.map(({ name, tone }) => (
                  <span key={name}>
                    <i className={`visual-dot tone-${tone}`} />
                    {name}: <strong>{selectedDay.counts[name]}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="visual-note">
            Hadir dan Terlambat dihitung terpisah. Ringkasan menjumlahkan
            catatan harian, bukan peserta unik sepanjang periode. Alpa hanya
            ditampilkan jika sudah tercatat.
          </p>
        </>
      )}
    </section>
  );
}
