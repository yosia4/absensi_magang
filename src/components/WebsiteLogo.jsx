import React from "react";

export const websiteLogoSrc = "/logo-rawuh-pustaka.png";

export default function WebsiteLogo() {
  return (
    <img
      className="website-logo"
      src={websiteLogoSrc}
      alt="Logo Cah Magang"
      width="64"
      height="64"
    />
  );
}
