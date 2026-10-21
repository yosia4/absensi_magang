import React from "react";
import { websiteLogoSrc } from "./WebsiteLogo";

export default function AnimatedLoginLogo({ phase }) {
  return (
    <div className={`animated-login-logo animated-login-logo-${phase}`}>
      <div className="login-logo-halo" />
      <svg
        className="login-logo-orbit"
        viewBox="0 0 240 240"
        aria-hidden="true"
      >
        <circle className="login-logo-track" cx="120" cy="120" r="110" />
        <circle
          className="login-logo-ring"
          cx="120"
          cy="120"
          r="110"
          pathLength="100"
        />
        <circle className="login-logo-satellite" cx="120" cy="10" r="4" />
      </svg>
      <div className="login-logo-emblem">
        <img
          src={websiteLogoSrc}
          alt="Logo Cah Magang"
          width="180"
          height="180"
        />
      </div>
      {phase === "success" && <div className="login-logo-ripple" />}
    </div>
  );
}
