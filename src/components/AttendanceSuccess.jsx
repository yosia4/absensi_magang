import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import "./AttendanceSuccess.css";

export default function AttendanceSuccess({ checkout, name, time, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const timer = window.setTimeout(onClose, 4200);
    return () => {
      window.clearTimeout(timer);
      dialog.close();
    };
  }, [onClose]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`attendance-success ${checkout ? "attendance-success-sunset" : "attendance-success-sunrise"}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="attendance-success-scene" aria-hidden="true">
        <div className="attendance-success-dusk" />
        <div className="attendance-success-stars"><i /><i /><i /><i /></div>
        <div className="attendance-success-sun" />
        <div className="attendance-success-cloud attendance-success-cloud-one" />
        <div className="attendance-success-cloud attendance-success-cloud-two" />
        <svg className="attendance-success-hills" viewBox="0 0 400 110" preserveAspectRatio="none">
          <path className="attendance-success-hill-back" d="M0 64 Q70 10 155 60 T310 45 T400 50 V110 H0Z" />
          <path className="attendance-success-hill-front" d="M0 90 Q85 50 175 86 T330 73 T400 83 V110 H0Z" />
        </svg>
        <span className="attendance-success-badge">
          <Check size={14} strokeWidth={3} />
          {checkout ? "CHECK-OUT BERHASIL" : "ABSEN MASUK BERHASIL"}
        </span>
      </div>
      <div className="attendance-success-content">
        <p className="attendance-success-name">{name}</p>
        <h2 id={titleId}>
          {checkout ? "Terima kasih untuk hari ini." : "Selamat beraktivitas!"}
        </h2>
        <p id={descriptionId} className="attendance-success-description">
          {checkout
            ? "Waktunya beristirahat. Sampai jumpa kembali!"
            : "Awali hari dengan semangat dan langkah baik."}
        </p>
        <div className="attendance-success-time">
          <span>{checkout ? "Jam pulang tercatat" : "Jam masuk tercatat"}</span>
          <strong>{time} <small>WIB</small></strong>
        </div>
        <button type="button" className="attendance-success-dismiss" onClick={onClose} autoFocus>
          Lanjut ke beranda
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
