import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({ id, className = "", ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? "Sembunyikan kata sandi"
    : "Tampilkan kata sandi";

  return (
    <span className="password-field">
      <input
        {...props}
        id={inputId}
        className={`password-input ${className}`.trim()}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={toggleLabel}
        aria-controls={inputId}
        title={toggleLabel}
        disabled={props.disabled}
      >
        {visible ? (
          <EyeOff size={20} aria-hidden="true" />
        ) : (
          <Eye size={20} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
