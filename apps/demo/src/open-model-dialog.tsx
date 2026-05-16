import React, { useState, useCallback, useEffect } from "react";
import { XIcon } from "@phosphor-icons/react";
import css from "./open-model-dialog.module.css";

export function OpenModelDialog({
  theme,
  onClose,
  onFile,
  onUrl,
}: {
  theme: "light" | "dark";
  onClose: () => void;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        onFile(f);
        onClose();
      }
    },
    [onFile, onClose],
  );

  const submitUrl = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onUrl(trimmed);
    onClose();
  }, [url, onUrl, onClose]);

  const urlValid = url.trim() !== "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open model"
      onClick={onClose}
      data-theme={theme}
      className={css.overlay}
    >
      <div onClick={(e) => e.stopPropagation()} className={css.dialog}>
        <header className={css.header}>
          <div className={css.title}>Open model</div>
          <button onClick={onClose} aria-label="Close" className={css.closeButton}>
            <XIcon size={16} />
          </button>
        </header>

        <div className={css.body}>
          <section className={css.section}>
            <div className={css.sectionTitle}>From file</div>
            <div className={css.sectionHint}>.onnx, .tflite, .keras, .pt, .pte, or .pb</div>
            <label className={css.fileChooser}>
              <span className={css.fileChooserLabel}>Choose file…</span>
              <input
                type="file"
                accept=".onnx,.tflite,.keras,.pte,.pt,.pb"
                className={css.hiddenInput}
                onChange={onFileChange}
              />
            </label>
          </section>

          <section className={css.section}>
            <div className={css.sectionTitle}>From URL</div>
            <div className={css.sectionHint}>
              The server must allow CORS (<code>Access-Control-Allow-Origin</code>).
            </div>
            <input
              type="url"
              placeholder="https://…/model.onnx"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlValid) submitUrl();
              }}
              className={css.urlInput}
            />
            <div className={css.actions}>
              <button onClick={submitUrl} disabled={!urlValid} className={css.primaryButton}>
                Open URL
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
