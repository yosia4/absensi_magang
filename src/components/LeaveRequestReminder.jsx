import React from "react";
import { AlertCircle } from "lucide-react";

export default function LeaveRequestReminder({ request }) {
  if (
    request.status !== "Menunggu" ||
    !["Izin", "Sakit"].includes(request.type)
  ) {
    return null;
  }

  return (
    <div className="leave-request-reminder">
      <div className="leave-request-reminder-heading">
        <AlertCircle size={18} aria-hidden="true" />
        <b>Belum dikonfirmasi pembimbing</b>
      </div>
      <p>
        Pengajuan Anda masih menunggu persetujuan. Anda bisa memberi tahu
        pembimbing melalui WhatsApp agar pengajuan segera diperiksa.
      </p>
    </div>
  );
}
