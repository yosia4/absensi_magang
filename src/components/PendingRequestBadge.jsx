import React from "react";

export default function PendingRequestBadge({
  count,
  label = "pengajuan menunggu persetujuan",
}) {
  if (!count) return null;
  return (
    <span
      className="pending-request-badge"
      aria-label={`${count} ${label}`}
      title={`${count} ${label}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
