import React, { useState } from "react";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { canScanAction } from "../attendanceScan";
import { attendanceTime } from "../attendanceVisuals";
import ConfirmDialog from "./ConfirmDialog";
import "./AttendanceScanActions.css";

export default function AttendanceScanActions({
  record,
  onStart,
  disabled = false,
}) {
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const canEnter = !disabled && canScanAction(record, "check_in");
  const canLeave = !disabled && canScanAction(record, "check_out");
  return (
    <>
      <div
        className="attendance-scan-actions"
        aria-label="Pilih absensi masuk atau pulang"
      >
        <button
          type="button"
          className="attendance-scan-button scan-enter"
          disabled={!canEnter}
          onClick={() => onStart("check_in")}
        >
          {record?.check_in ? <CheckCircle2 size={25} /> : <LogIn size={25} />}
          <span>
            <strong>
              {record?.check_in
                ? `Sudah masuk · ${attendanceTime(record.check_in)}`
                : "Absen Masuk"}
            </strong>
            <small>
              {record?.check_in
                ? "Jam masuk tercatat"
                : canEnter
                  ? "Scan QR saat datang"
                  : "Tidak tersedia"}
            </small>
          </span>
        </button>
        <button
          type="button"
          className="attendance-scan-button scan-leave"
          disabled={!canLeave}
          onClick={() => setConfirmCheckout(true)}
        >
          {record?.check_out ? (
            <CheckCircle2 size={25} />
          ) : (
            <LogOut size={25} />
          )}
          <span>
            <strong>
              {record?.check_out
                ? `Sudah pulang · ${attendanceTime(record.check_out)}`
                : "Absen Pulang"}
            </strong>
            <small>
              {record?.check_out
                ? "Jam pulang tercatat"
                : canLeave
                  ? "Scan QR saat pulang"
                  : !record
                    ? "Absen masuk terlebih dahulu"
                    : "Tidak tersedia"}
            </small>
          </span>
        </button>
      </div>
      {confirmCheckout && (
        <ConfirmDialog
          icon={<LogOut size={23} />}
          title="Ingin mencatat kepulangan sekarang?"
          message="Setelah dikonfirmasi, buka kamera dan scan QR untuk mencatat jam pulang Anda."
          confirmLabel="Ya, lanjut scan pulang"
          confirmDisabled={!canLeave}
          onCancel={() => setConfirmCheckout(false)}
          onConfirm={() => {
            if (canLeave) {
              setConfirmCheckout(false);
              onStart("check_out");
            }
          }}
        />
      )}
    </>
  );
}
