import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check } from "lucide-react";
import AnimatedLoginLogo from "./AnimatedLoginLogo";
import "./LoginFeedback.css";

export default function LoginFeedback({ phase, name, message, onContinue }) {
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;
  const titleId = useId();
  const messageId = useId();
  const title =
    phase === "success"
      ? "Selamat datang!"
      : phase === "error"
        ? "Belum berhasil masuk"
        : "Menyiapkan langkah baru…";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (phase !== "loading") buttonRef.current?.focus();
    if (phase !== "success") return;
    const timer = window.setTimeout(() => continueRef.current(), 2200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`login-feedback login-feedback-${phase}`}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        if (phase !== "loading") onContinue();
      }}
    >
      <div className="login-feedback-art" aria-hidden="true">
        <AnimatedLoginLogo key={phase} phase={phase} />
        {phase !== "loading" && (
          <span className="login-feedback-symbol">
            {phase === "success" ? (
              <Check size={22} />
            ) : (
              <AlertCircle size={22} />
            )}
          </span>
        )}
      </div>
      <div
        className="login-feedback-copy"
        aria-live="polite"
        aria-atomic="true"
      >
        <h2 key={`title-${phase}`} id={titleId}>
          {title}
        </h2>
        <p key={`message-${phase}`} id={messageId}>
          {phase === "success" ? (
            <>
              <strong>{name}</strong>
              <span>Senang bertemu kembali di Rawuh Pustaka.</span>
            </>
          ) : phase === "error" ? (
            message
          ) : (
            "Sedang memeriksa akun Anda. Mohon tunggu sebentar."
          )}
        </p>
      </div>
      {phase === "loading" ? (
        <div className="login-feedback-progress" aria-hidden="true">
          <span />
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          className="login-feedback-action"
          onClick={onContinue}
        >
          {phase === "success" ? "Masuk ke beranda" : "Coba lagi"}
        </button>
      )}
    </dialog>,
    document.body,
  );
}
