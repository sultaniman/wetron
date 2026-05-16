import { useState, useCallback, useEffect } from "react";
import { XIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  loadSavedModelWeights,
  loadSavedModelWeightsFromUrls,
  attachCheckpointToGraph,
} from "@wetron/savedmodel";
import type { ModelGraph } from "@wetron/core";
import css from "./weights-dialog.module.css";

type LoadState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

export function WeightsDialog({
  theme,
  graph,
  onClose,
  onLoaded,
}: {
  theme: "light" | "dark";
  graph: ModelGraph;
  onClose: () => void;
  onLoaded: (graph: ModelGraph) => void;
}) {
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

  const filesValid = indexFile !== null && dataFile !== null;
  const urlsValid = indexUrl.trim() !== "" && dataUrls.some((u) => u.trim() !== "");
  const loading = load.status === "loading";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Load weights"
      onClick={onClose}
      data-theme={theme}
      className={css.overlay}
    >
      <div onClick={(e) => e.stopPropagation()} className={css.dialog}>
        <header className={css.header}>
          <div className={css.title}>Load weights</div>
          <button onClick={onClose} aria-label="Close" className={css.closeButton}>
            <XIcon size={16} />
          </button>
        </header>

        <div className={css.body}>
          <section className={css.section}>
            <div className={css.sectionTitle}>From files</div>
            <div className={css.sectionHint}>
              Pick the TF2 SavedModel <code>variables/</code> pair.
            </div>
            <FilePickerRow
              label="variables.index"
              file={indexFile}
              accept=".index"
              onChange={setIndexFile}
            />
            <FilePickerRow
              label="variables.data-XXXXX-of-XXXXX"
              file={dataFile}
              onChange={setDataFile}
            />
            <div className={css.actions}>
              <button
                disabled={!filesValid || loading}
                onClick={submitFiles}
                className={css.primaryButton}
              >
                Load files
              </button>
            </div>
          </section>

          <section className={css.section}>
            <div className={css.sectionTitle}>From URLs</div>
            <div className={css.sectionHint}>
              Provide a <code>variables.index</code> URL and one or more shard URLs in order.
            </div>

            <label className={css.field}>
              <span>Index URL</span>
              <input
                type="url"
                placeholder="https://…/variables.index"
                value={indexUrl}
                onChange={(e) => setIndexUrl(e.target.value)}
                className={css.textInput}
              />
            </label>

            <div className={css.shardRows}>
              <span className={css.filePickerLabel}>Weight shard URLs</span>
              {dataUrls.map((url, i) => (
                <div key={i} className={css.shardRow}>
                  <input
                    type="url"
                    placeholder={`https://…/variables.data-${String(i).padStart(5, "0")}-of-${String(dataUrls.length).padStart(5, "0")}`}
                    value={url}
                    onChange={(e) => {
                      const next = [...dataUrls];
                      next[i] = e.target.value;
                      setDataUrls(next);
                    }}
                    className={`${css.textInput} ${css.shardInput}`}
                  />
                  <button
                    onClick={() => setDataUrls(dataUrls.filter((_, j) => j !== i))}
                    disabled={dataUrls.length === 1}
                    aria-label={`Remove shard ${i}`}
                    className={css.iconButton}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setDataUrls([...dataUrls, ""])} className={css.addShard}>
                <PlusIcon size={12} /> Add shard
              </button>
            </div>

            <div className={css.actions}>
              <button
                disabled={!urlsValid || loading}
                onClick={submitUrls}
                className={css.primaryButton}
              >
                {loading ? "Loading…" : "Load from URLs"}
              </button>
            </div>
          </section>

          {load.status === "error" && <div className={css.error}>{load.message}</div>}
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
}: {
  label: string;
  file: File | null;
  accept?: string;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className={css.filePicker}>
      <span className={css.filePickerLabel}>{label}</span>
      <span className={`${css.filePickerBox} ${file ? "" : css.filePickerBoxEmpty}`}>
        <input
          type="file"
          {...(accept ? { accept } : {})}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className={css.filePickerHidden}
        />
        <button
          onClick={(e) => {
            const input = (e.currentTarget.parentElement as HTMLElement).querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null;
            input?.click();
          }}
          className={css.filePickerButton}
        >
          Choose
        </button>
        <span className={css.filePickerName}>{file?.name ?? "No file selected"}</span>
      </span>
    </label>
  );
}
