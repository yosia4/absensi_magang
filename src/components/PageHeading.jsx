import React from "react";
import "./PageHeading.css";

export default function PageHeading({
  icon: Icon,
  title,
  description,
  actions,
  children,
}) {
  return (
    <div className="page-heading">
      <div className="page-heading-identity">
        <span className="page-heading-icon" aria-hidden="true">
          <Icon size={25} strokeWidth={1.8} />
        </span>
        <div className="page-heading-copy">
          <span className="page-heading-brand">RAWUH PUSTAKA</span>
          <h2>{title}</h2>
          <p className="page-heading-description">{description}</p>
          {children}
        </div>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  );
}
