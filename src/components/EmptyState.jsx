import React from "react";
import { CalendarDays } from "lucide-react";
import "./EmptyState.css";

export default function EmptyState({
  icon: Icon = CalendarDays,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <div
      className={`friendly-empty${compact ? " friendly-empty-compact" : ""}`}
    >
      <span className="friendly-empty-icon" aria-hidden="true">
        <Icon size={27} strokeWidth={1.7} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          className="outline friendly-empty-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
