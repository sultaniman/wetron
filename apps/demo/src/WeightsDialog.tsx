import React, { useState, useCallback, useEffect } from "react";
import { XIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  loadSavedModelWeights,
  loadSavedModelWeightsFromUrls,
  attachCheckpointToGraph,
} from "@wetron/savedmodel";
import type { ModelGraph } from "@wetron/core";

type LoadState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

interface Chrome {
  bg: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  pageBg: string;
}

interface Props {
  graph: ModelGraph;
  chrome: Chrome;
  isDark: boolean;
  onClose: () => void;
  onLoaded: (graph: ModelGraph) => void;
}

export function WeightsDialog({ graph, chrome, isDark, onClose, onLoaded }: Props) {
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [indexUrl, setIndexUrl] = useState("");
  const [dataUrls, setDataUrls] = useState<string[]>([""]);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitFiles = useCallback(async () => {
    if (!indexFile || !dataFile) return;
    setLoad({ status: "loading" });
    try {
      const loaded = await loadSavedModelWeights(indexFile, dataFile);
      onLoaded(attachCheckpointToGraph(graph, loaded));
      onClose();
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [indexFile, dataFile, graph, onLoaded, onClose]);

  const submitUrls = useCallback(async () => {
    const filled = dataUrls.map((u) => u.trim()).filter(Boolean);
    if (!indexUrl.trim() || filled.length === 0) return;
    setLoad({ status: "loading" });
    try {
      const loaded = await loadSavedModelWeightsFromUrls(indexUrl.trim(), ...filled);
      onLoaded(attachCheckpointToGraph(graph, loaded));
      onClose();
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [indexUrl, dataUrls, graph, onLoaded, onClose]);

  const overlayBg = isDark ? "rgba(0,0,0,0.55)" : "rgba(15,15,23,0.35)";
  const inputBg = isDark ? "#1f1f2a" : "#fff";
  const sectionBg = isDark ? "#1a1a24" : "#fafafa";
  const errColor = "#d93025";

  const filesValid = indexFile !== null && dataFile !== null;
  const urlsValid = indexUrl.trim() !== "" && dataUrls.some((u) => u.trim() !== "");
  const loading = load.status === "loading";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Load weights"
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
          width: 480,
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
          <div style={{ fontWeight: 600, fontSize: 15 }}>Load weights</div>
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

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
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
            <div style={{ fontSize: 13, fontWeight: 600 }}>From files</div>
            <div style={{ fontSize: 12, color: chrome.muted }}>
              Pick the TF2 SavedModel <code>variables/</code> pair.
            </div>
            <FilePickerRow
              label="variables.index"
              file={indexFile}
              accept=".index"
              onChange={setIndexFile}
              chrome={chrome}
              inputBg={inputBg}
            />
            <FilePickerRow
              label="variables.data-XXXXX-of-XXXXX"
              file={dataFile}
              onChange={setDataFile}
              chrome={chrome}
              inputBg={inputBg}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                disabled={!filesValid || loading}
                onClick={submitFiles}
                style={primaryButton(filesValid && !loading)}
              >
                Load files
              </button>
            </div>
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
            <div style={{ fontSize: 13, fontWeight: 600 }}>From URLs</div>
            <div style={{ fontSize: 12, color: chrome.muted }}>
              Provide a <code>variables.index</code> URL and one or more shard URLs in order.
            </div>

            <label style={fieldLabel(chrome)}>
              <span>Index URL</span>
              <input
                type="url"
                placeholder="https://…/variables.index"
                value={indexUrl}
                onChange={(e) => setIndexUrl(e.target.value)}
                style={textInput(chrome, inputBg)}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, color: chrome.muted }}>Weight shard URLs</span>
              {dataUrls.map((url, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="url"
                    placeholder={`https://…/variables.data-${String(i).padStart(5, "0")}-of-${String(dataUrls.length).padStart(5, "0")}`}
                    value={url}
                    onChange={(e) => {
                      const next = [...dataUrls];
                      next[i] = e.target.value;
                      setDataUrls(next);
                    }}
                    style={{ ...textInput(chrome, inputBg), flex: 1 }}
                  />
                  <button
                    onClick={() => setDataUrls(dataUrls.filter((_, j) => j !== i))}
                    disabled={dataUrls.length === 1}
                    aria-label={`Remove shard ${i}`}
                    style={iconButton(chrome, dataUrls.length > 1)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDataUrls([...dataUrls, ""])}
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  background: "transparent",
                  color: chrome.muted,
                  border: `1px dashed ${chrome.border}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <PlusIcon size={12} /> Add shard
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                disabled={!urlsValid || loading}
                onClick={submitUrls}
                style={primaryButton(urlsValid && !loading)}
              >
                {loading ? "Loading…" : "Load from URLs"}
              </button>
            </div>
          </section>

          {load.status === "error" && (
            <div style={{ color: errColor, fontSize: 12, lineHeight: 1.4 }}>{load.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilePickerRow({
  label,
  file,
  accept,
  onChange,
  chrome,
  inputBg,
}: {
  label: string;
  file: File | null;
  accept?: string;
  onChange: (f: File | null) => void;
  chrome: Chrome;
  inputBg: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: chrome.muted }}>{label}</span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: inputBg,
          border: `1px solid ${chrome.border}`,
          borderRadius: 6,
          fontSize: 12,
          color: file ? chrome.text : chrome.faint,
        }}
      >
        <input
          type="file"
          {...(accept ? { accept } : {})}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            border: 0,
          }}
        />
        <button
          onClick={(e) => {
            const input = (e.currentTarget.parentElement as HTMLElement).querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null;
            input?.click();
          }}
          style={{
            padding: "3px 10px",
            background: "transparent",
            color: chrome.muted,
            border: `1px solid ${chrome.border}`,
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          Choose
        </button>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file?.name ?? "No file selected"}
        </span>
      </span>
    </label>
  );
}

function primaryButton(enabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: enabled ? "#1a73e8" : "#1a73e833",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 13,
    fontWeight: 500,
  };
}

function textInput(chrome: Chrome, bg: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    background: bg,
    color: chrome.text,
    border: `1px solid ${chrome.border}`,
    borderRadius: 6,
    fontSize: 12,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };
}

function fieldLabel(chrome: Chrome): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    color: chrome.muted,
  };
}

function iconButton(chrome: Chrome, enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    background: "transparent",
    color: enabled ? chrome.muted : chrome.faint,
    border: `1px solid ${chrome.border}`,
    borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
