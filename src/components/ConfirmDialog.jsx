import React from "react";

export default function ConfirmDialog({
  icon,
  title,
  message,
  confirmLabel,
  danger,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="confirm-backdrop" onClick={onCancel} role="presentation">
      <div
        className="confirm-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <span className="confirm-icon">{icon}</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <div>
          <button className="outline" onClick={onCancel}>
            Batal
          </button>
          <button
            className={`primary${danger ? " danger-confirm" : ""}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
