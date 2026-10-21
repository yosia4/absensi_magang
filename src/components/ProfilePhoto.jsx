import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export const PhotoUrlContext = createContext(async (value) => value || "");

export default function ProfilePhoto(props) {
  return <ResolvedPhoto key={props.src || "empty"} {...props} />;
}

function ResolvedPhoto({ src, alt = "", initials = "?", className = "" }) {
  const resolveUrl = useContext(PhotoUrlContext);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const retry = useRef(null);
  useEffect(() => {
    let disposed = false;
    let retried = false;
    let sequence = 0;
    const refresh = async (force = false) => {
      const request = ++sequence;
      try {
        const next = await resolveUrl(src, { force });
        if (!disposed && request === sequence && next) {
          setUrl(next);
          setFailed(false);
        }
      } catch {
        // A photo error must not prevent the rest of the profile from loading.
      }
    };
    retry.current = () => {
      setFailed(true);
      if (retried) return;
      retried = true;
      void refresh(true);
    };
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    if (src) void refresh();
    const timer = src ? window.setInterval(refreshVisible, 5 * 60 * 1000) : null;
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [src, resolveUrl]);
  return url && !failed ? (
    <img className={className} src={url} alt={alt} onError={() => retry.current?.()} />
  ) : (
    <span className={className} role="img" aria-label={alt || "Foto profil belum tersedia"}>
      {initials}
    </span>
  );
}
