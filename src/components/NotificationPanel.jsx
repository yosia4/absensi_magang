import React from "react";
import { X } from "lucide-react";

export default function NotificationPanel({ notifications, onClose }) {
  return (
    <div className="notification-panel" role="dialog" aria-label="Notifikasi">
      <div className="notification-heading">
        <b>Notifikasi</b>
        <button onClick={onClose} aria-label="Tutup notifikasi">
          <X size={17} />
        </button>
      </div>
      {notifications.length ? (
        notifications.map((item) => (
          <div className="notification-item" key={item.id}>
            <b>{item.title}</b>
            <p>{item.message}</p>
            <small>{new Date(item.created_at).toLocaleString("id-ID")}</small>
          </div>
        ))
      ) : (
        <p className="notification-empty">Belum ada notifikasi.</p>
      )}
    </div>
  );
}
