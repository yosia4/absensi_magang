import React from "react";
import "./Skeleton.css";

export default function Skeleton({
  variant = "cards",
  label = "Memuat data…",
}) {
  return (
    <div
      className={`skeleton-loading skeleton-${variant}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="skeleton-content" aria-hidden="true">
        {variant === "chart" ? (
          <>
            <div className="skeleton-line skeleton-heading" />
            <div className="skeleton-chart-bars">
              {[45, 75, 55, 90, 65, 40, 70].map((height, i) => (
                <span
                  key={i}
                  className="skeleton-block"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </>
        ) : (
          Array.from({ length: variant === "table" ? 5 : 4 }, (_, i) => (
            <div className="skeleton-item" key={i}>
              <span className="skeleton-block skeleton-icon" />
              <div>
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-short" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
