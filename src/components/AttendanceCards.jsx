import React from "react";
import { dateLabel } from "../attendanceVisuals";
import StatusBadge from "./StatusBadge";
import "./AttendanceCards.css";

export default function AttendanceCards({
  rows,
  showAttendance = true,
  onHistory,
  onEdit,
  onDelete,
  onToggleActive,
  onPhotoClick,
}) {
  return (
    <div className="attendance-mobile-cards">
      {!rows.length && (
        <p className="empty-state">Belum ada data yang ditampilkan.</p>
      )}
      {rows.map((row, index) => (
        <article
          className="attendance-mobile-card"
          key={`${row.id || row.name || index}:${row.date || ""}`}
        >
          <div className="attendance-card-heading">
            <div>
              <h3>{row.name}</h3>
              {row.date && <p>{dateLabel(row.date)}</p>}
            </div>
            {showAttendance ? (
              <StatusBadge status={row.status} />
            ) : (
              <span
                className={`badge ${row.is_active === false ? "gray" : "green"}`}
              >
                {row.is_active === false ? "Nonaktif" : "Aktif"}
              </span>
            )}
          </div>
          {showAttendance && (
            <dl className="attendance-card-times">
              <div>
                <dt>Jam masuk</dt>
                <dd>{row.in || "—"}</dd>
              </div>
              <div>
                <dt>Jam pulang</dt>
                <dd>{row.out || "—"}</dd>
              </div>
            </dl>
          )}
          {row.checkoutPending && (
            <p className="checkout-pending">Belum check-out</p>
          )}
          {row.checkoutEarly && <p className="checkout-early">Pulang cepat</p>}
          <details className="attendance-card-details">
            <summary>
              <span className="details-closed">Lihat detail</span>
              <span className="details-open">Tutup detail</span>
              <span className="sr-only">
                {" "}
                {row.name}
                {row.date ? `, ${dateLabel(row.date)}` : ""}
              </span>
            </summary>
            <dl>
              <div>
                <dt>Universitas</dt>
                <dd>{row.university || "—"}</dd>
              </div>
              <div>
                <dt>Jurusan</dt>
                <dd>{row.major || "—"}</dd>
              </div>
              {row.email && (
                <div>
                  <dt>Email</dt>
                  <dd>{row.email}</dd>
                </div>
              )}
              {(row.internship_start || row.internship_end) && (
                <div>
                  <dt>Periode magang</dt>
                  <dd>
                    {row.internship_start
                      ? dateLabel(row.internship_start)
                      : "—"}{" "}
                    – {row.internship_end ? dateLabel(row.internship_end) : "—"}
                  </dd>
                </div>
              )}
              {showAttendance && row.is_active === false && (
                <div>
                  <dt>Akun</dt>
                  <dd>Nonaktif</dd>
                </div>
              )}
            </dl>
            <div className="attendance-card-actions">
              {onPhotoClick && row.photo_url && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onPhotoClick(row)}
                >
                  Lihat foto
                </button>
              )}
              {onHistory && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onHistory(row)}
                >
                  Riwayat
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onEdit(row)}
                >
                  Edit
                </button>
              )}
              {onToggleActive && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onToggleActive(row)}
                >
                  {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="text-btn danger-btn"
                  onClick={() => onDelete(row)}
                >
                  Hapus
                </button>
              )}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
