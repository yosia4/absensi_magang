import React from "react";
import AttendanceCards from "./AttendanceCards";
import StatusBadge from "./StatusBadge";
import Skeleton from "./Skeleton";

export default function AttendanceTable({
  rows,
  loading = false,
  onEdit,
  onDelete,
  onHistory,
  onToggleActive,
  onPhotoClick,
  showAttendance = true,
}) {
  const manageable = !!(onEdit || onDelete || onHistory || onToggleActive);
  if (loading)
    return <Skeleton variant="table" label="Memuat daftar peserta…" />;
  return (
    <>
      <AttendanceCards
        {...{
          rows,
          showAttendance,
          onHistory,
          onEdit,
          onDelete,
          onToggleActive,
          onPhotoClick,
        }}
      />
      <table className="attendance-desktop-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Universitas</th>
            <th>Jurusan</th>
            {showAttendance && <th>Jam Masuk</th>}
            {showAttendance && <th>Jam Pulang</th>}
            {showAttendance && <th>Status</th>}
            {manageable && <th>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td
                colSpan={(showAttendance ? 6 : 3) + (manageable ? 1 : 0)}
                className="empty-table"
              >
                Belum ada data anak magang di database.
              </td>
            </tr>
          )}
          {rows.map((x, i) => (
            <tr key={x.id || i}>
              <td>
                <span className="person">
                  {x.photo_url ? (
                    <button
                      type="button"
                      className="table-photo-button"
                      onClick={() => onPhotoClick?.(x)}
                      disabled={!onPhotoClick}
                      aria-label={
                        onPhotoClick ? `Lihat foto profil ${x.name}` : undefined
                      }
                    >
                      <img
                        className="avatar small table-photo"
                        src={x.photo_url}
                        alt={onPhotoClick ? "" : x.name}
                      />
                    </button>
                  ) : (
                    <span className="avatar small">{x.initials}</span>
                  )}
                  <b>{x.name}</b>
                  {onToggleActive && !x.is_active && (
                    <span className="badge red">Nonaktif</span>
                  )}
                </span>
              </td>
              <td>{x.university}</td>
              <td>{x.major}</td>
              {showAttendance && <td>{x.in}</td>}
              {showAttendance && (
                <td>
                  {x.out}
                  {x.checkoutEarly && (
                    <small className="checkout-early">Pulang cepat</small>
                  )}
                </td>
              )}
              {showAttendance && (
                <td>
                  <StatusBadge status={x.status} />
                  {x.checkoutPending && (
                    <small className="checkout-pending">Belum check-out</small>
                  )}
                </td>
              )}
              {manageable && (
                <td className="table-actions">
                  {onHistory && (
                    <button className="text-btn" onClick={() => onHistory(x)}>
                      Riwayat
                    </button>
                  )}
                  {onEdit && (
                    <button className="text-btn" onClick={() => onEdit(x)}>
                      Edit
                    </button>
                  )}
                  {onToggleActive && (
                    <button
                      className="text-btn"
                      onClick={() => onToggleActive(x)}
                    >
                      {x.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="text-btn danger-btn"
                      onClick={() => onDelete(x)}
                    >
                      Hapus
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
