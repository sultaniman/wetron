import React, { useState, useCallback, useEffect } from "react";
import { XIcon } from "@phosphor-icons/react";

interface Chrome {
  bg: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  pageBg: string;
}

interface Props {
  chrome: Chrome;
  isDark: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
}

export function OpenModelDialog({ chrome, isDark, onClose, onFile, onUrl }: Props) {
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

  const overlayBg = isDark ? "rgba(0,0,0,0.55)" : "rgba(15,15,23,0.35)";
  const inputBg = isDark ? "#1f1f2a" : "#fff";
  const sectionBg = isDark ? "#1a1a24" : "#fafafa";
  const urlValid = url.trim() !== "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open model"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: overlayBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: chrome.bg,
          color: chrome.text,
          border: `1px solid ${chrome.border}`,
          borderRadius: 10,
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${chrome.border}`,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>Open model</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              padding: 0,
              background: "transparent",
              color: chrome.muted,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <XIcon size={16} />
          </button>
        </header>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <section
            style={{
              background: sectionBg,
              border: `1px solid ${chrome.border}`,
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>From file</div>
            <div style={{ fontSize: 12, color: chrome.muted }}>
              .onnx, .tflite, .keras, .pt, .pte, or .pb
            </div>
            <label style={{ display: "inline-flex" }}>
              <span
                style={{
                  padding: "6px 14px",
                  background: "#1a73e8",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Choose file…
              </span>
              <input
                type="file"
                accept=".onnx,.tflite,.keras,.pte,.pt,.pb"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
            </label>
          </section>

          <section
            style={{
              background: sectionBg,
              border: `1px solid ${chrome.border}`,
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>From URL</div>
            <div style={{ fontSize: 12, color: chrome.muted }}>
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
              style={{
                padding: "6px 10px",
                background: inputBg,
                color: chrome.text,
                border: `1px solid ${chrome.border}`,
                borderRadius: 6,
                fontSize: 12,
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={submitUrl}
                disabled={!urlValid}
                style={{
                  padding: "6px 14px",
                  background: urlValid ? "#1a73e8" : "#1a73e833",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: urlValid ? "pointer" : "not-allowed",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Open URL
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
