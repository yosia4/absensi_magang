import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { dateLabel } from "../attendanceVisuals";
import "./RequestCard.css";

const types = {
  Izin: [FileText, "leave"],
  Sakit: [HeartPulse, "sick"],
  "Lupa Absen": [Clock3, "forgot"],
};
const statuses = {
  Menunggu: [Clock3, "pending"],
  Disetujui: [CheckCircle2, "approved"],
  Ditolak: [XCircle, "rejected"],
};

export default function RequestCard({ request, name, children, actions }) {
  const [TypeIcon, typeTone] = types[request.type] || [FileText, "leave"];
  const [StatusIcon, statusTone] = statuses[request.status] || [
    Clock3,
    "pending",
  ];
  return (
    <article
      className={`request-card request-${statusTone}`}
      aria-label={`Pengajuan ${request.type} oleh ${name}, ${request.status}`}
    >
      <div className="request-card-heading">
        <span
          className={`request-type-icon request-type-${typeTone}`}
          aria-hidden="true"
        >
          <TypeIcon size={22} />
        </span>
        <div className="request-identity">
          <h3>{name}</h3>
          <span>Pengajuan {request.type.toLowerCase()}</span>
        </div>
        <span className={`request-status request-status-${statusTone}`}>
          <StatusIcon size={14} aria-hidden="true" />
          {request.status}
        </span>
      </div>
      <div className="request-date">
        <CalendarDays size={16} aria-hidden="true" />
        <span>
          <time dateTime={request.date_from}>
            {dateLabel(request.date_from)}
          </time>
          {request.date_from !== request.date_to && (
            <>
              {" "}
              –{" "}
              <time dateTime={request.date_to}>
                {dateLabel(request.date_to)}
              </time>
            </>
          )}
        </span>
      </div>
      <div className="request-reason">
        <span>Alasan pengajuan</span>
        <p>{request.reason || "Tidak ada keterangan tambahan."}</p>
      </div>
      {request.status === "Ditolak" && request.rejection_reason && (
        <div className="request-rejection">
          <MessageSquare size={18} aria-hidden="true" />
          <div>
            <b>Alasan penolakan</b>
            <p>{request.rejection_reason}</p>
          </div>
        </div>
      )}
      {children}
      {actions && <div className="request-card-actions">{actions}</div>}
    </article>
  );
}
