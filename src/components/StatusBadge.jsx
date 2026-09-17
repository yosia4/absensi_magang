import React from "react";
import { attendanceTone } from "../attendanceVisuals";
import "./StatusColors.css";

export default function StatusBadge({ status, children }) {
  return (
    <span className={`badge attendance-status tone-${attendanceTone(status)}`}>
      {children || status}
    </span>
  );
}
