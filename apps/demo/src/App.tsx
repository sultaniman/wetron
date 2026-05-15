import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { SunIcon, MoonIcon, DesktopIcon } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { getViewportForBounds } from "@xyflow/react";
import { parseModel, parseModelFromUrl } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraphViewHandle } from "@wetron/react";
import type { ModelGraph } from "@wetron/core";
import type { PanelTarget, ColorMode } from "@wetron/react";
import { WeightsDialog } from "./WeightsDialog";
import { OpenModelDialog } from "./OpenModelDialog";

function resolveMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

const MODE_CYCLE: ColorMode[] = ["system", "light", "dark"];
const MODE_LABEL: Record<ColorMode, string> = { system: "System", light: "Light", dark: "Dark" };
const MODE_ICON: Record<ColorMode, typeof SunIcon> = {
  system: DesktopIcon,
  light: SunIcon,
  dark: MoonIcon,
};

type State =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "ready"; graph: ModelGraph; name: string }
  | { status: "error"; message: string; name: string };

export default function App() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<PanelTarget | null>(null);
  const [history, setHistory] = useState<PanelTarget[]>([]);
  const [selectedEdgeTensorName, setSelectedEdgeTensorName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorMode, setColorMode] = useState<ColorMode>("system");
  const [weightsDialogOpen, setWeightsDialogOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphViewRef = useRef<ModelGraphViewHandle>(null);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => resolveMode("system"));

  useEffect(() => {
    setResolvedMode(resolveMode(colorMode));
  }, [colorMode]);

  useEffect(() => {
    if (colorMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolvedMode(resolveMode("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorMode]);

  const cycleMode = useCallback(() => {
    setColorMode((m) => MODE_CYCLE[(MODE_CYCLE.indexOf(m) + 1) % MODE_CYCLE.length]);
  }, []);

  const loadFile = useCallback(async (file: File) => {
    setState({ status: "loading", name: file.name });
    setSelected(null);
    setHistory([]);
    setSelectedEdgeTensorName(null);
    setSearchQuery("");
    setWeightsDialogOpen(false);
    try {
      const buf = await file.arrayBuffer();
      const graph = await parseModel(new Uint8Array(buf), file.name);
      setState({ status: "ready", graph, name: file.name });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
        name: file.name,
      });
    }
  }, []);

  const loadUrl = useCallback(async (url: string) => {
    const name = (() => {
      try {
        return new URL(url).pathname.split("/").at(-1) || url;
      } catch {
        return url;
      }
    })();
    setState({ status: "loading", name });
    setSelected(null);
    setHistory([]);
    setSelectedEdgeTensorName(null);
    setSearchQuery("");
    setWeightsDialogOpen(false);
    try {
      const graph = await parseModelFromUrl(url);
      setState({ status: "ready", graph, name });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
        name,
      });
    }
  }, []);

  const onWeightsLoaded = useCallback((nextGraph: ModelGraph) => {
    setState((prev) => (prev.status === "ready" ? { ...prev, graph: nextGraph } : prev));
  }, []);

  const tensorSources = useMemo<ReadonlyMap<string, string>>(() => {
    if (state.status !== "ready") return new Map();
    const map = new Map<string, string>();
    for (const node of state.graph.nodes) {
      for (const out of node.outputs) {
        if (out) map.set(out, node.opType);
      }
    }
    for (const gv of state.graph.inputs) {
      map.set(gv.name, "Input");
    }
    return map;
  }, [state]);

  const handleTargetClick = useCallback((target: PanelTarget) => {
    setHistory([]);
    setSelected(target);
    setSelectedEdgeTensorName("edge" in target ? target.edge.tensorName : null);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
    setSelectedEdgeTensorName(null);
    setHistory([]);
  }, []);

  const handleTensorClick = useCallback(
    (name: string) => {
      if (state.status !== "ready") return;
      const info = state.graph.tensorShapes.get(name);
      setSelected((prev) => {
        if (prev) setHistory((h) => [...h, prev]);
        return { tensor: { name, shape: info?.shape ?? null, dtype: info?.dtype ?? null } };
      });
    },
    [state],
  );

  const handleBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (prev !== undefined) {
      setSelected(prev);
      setSelectedEdgeTensorName("edge" in prev ? prev.edge.tensorName : null);
    }
    setHistory((h) => h.slice(0, -1));
  }, [history]);

  const exportPng = useCallback(async () => {
    if (!graphViewRef.current || state.status !== "ready") return;
    const name = state.name.replace(/\.[^.]+$/, "") || "graph";
    const saved = graphViewRef.current.getViewport();
    // fitAll renders all nodes into the DOM (onlyRenderVisibleElements)
    await graphViewRef.current.fitAll();
    const el = graphViewRef.current.getViewportElement();
    if (!el) return;
    // Compute output canvas at actual node-layout scale (1px per layout unit) + padding
    const bounds = graphViewRef.current.getNodesBounds();
    const PAD = 60;
    const imgW = Math.ceil(bounds.width + PAD * 2);
    const imgH = Math.ceil(bounds.height + PAD * 2);
    const vp = getViewportForBounds(
      bounds,
      imgW,
      imgH,
      0.1,
      4,
      PAD / Math.max(bounds.width, bounds.height),
    );
    const dataUrl = await toPng(el, {
      cacheBust: true,
      pixelRatio: 2,
      width: imgW,
      height: imgH,
      style: {
        width: `${imgW}px`,
        height: `${imgH}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    });
    graphViewRef.current.setViewport(saved);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${name}.png`;
    a.click();
  }, [state]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const isDark = resolvedMode === "dark";
  const chrome = {
    bg: isDark ? "#16161e" : "#fff",
    border: isDark ? "#2a2a3a" : "#e0e0e0",
    text: isDark ? "#e0e0e0" : "#333",
    muted: isDark ? "#888" : "#666",
    faint: isDark ? "#666" : "#888",
    pageBg: isDark ? "#0f0f17" : "#f5f5f5",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: chrome.pageBg,
      }}
    >
      <header
        style={{
          padding: "12px 20px",
          background: chrome.bg,
          borderBottom: `1px solid ${chrome.border}`,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: chrome.text,
          }}
        >
          <BrandMark size={22} />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>wetron</span>
        </a>
        <a
          href="https://github.com/sultaniman/wetron"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          aria-label="View on GitHub"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: chrome.text,
            textDecoration: "none",
            lineHeight: 0,
            marginTop: 2,
          }}
        >
          <GitHubIcon size={22} />
        </a>
        {state.status !== "idle" && (
          <span style={{ color: chrome.muted, fontSize: 14 }}>{state.name}</span>
        )}
        {state.status === "ready" && (
          <span style={{ color: chrome.faint, fontSize: 13 }}>
            {state.graph.nodes.length} nodes · {state.graph.inputs.length} inputs ·{" "}
            {state.graph.outputs.length} outputs
          </span>
        )}
        {state.status === "ready" && (
          <input
            type="search"
            placeholder="Search ops…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              marginLeft: "auto",
              padding: "5px 10px",
              background: "transparent",
              color: chrome.text,
              border: `1px solid ${chrome.border}`,
              borderRadius: 6,
              fontSize: 13,
              outline: "none",
              width: 180,
            }}
          />
        )}
        {state.status === "ready" && (
          <button
            onClick={exportPng}
            style={{
              padding: "5px 12px",
              background: "transparent",
              color: chrome.muted,
              border: `1px solid ${chrome.border}`,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Export PNG
          </button>
        )}
        {state.status === "ready" && state.graph.hasExternalWeights && !state.graph.weights && (
          <button
            onClick={() => setWeightsDialogOpen(true)}
            style={{
              padding: "5px 12px",
              background: "transparent",
              color: chrome.muted,
              border: `1px solid ${chrome.border}`,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Load weights…
          </button>
        )}
        {state.status === "ready" && state.graph.weights && (
          <span
            style={{
              padding: "5px 10px",
              color: chrome.muted,
              fontSize: 12,
            }}
            title={`${state.graph.weights.totalBytes.toLocaleString()} bytes loaded`}
          >
            ✓ weights loaded
          </span>
        )}
        <button
          onClick={() => setOpenDialogOpen(true)}
          style={{
            marginLeft: state.status === "ready" ? 0 : "auto",
            padding: "6px 14px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Open model
        </button>
        {(() => {
          const Icon = MODE_ICON[colorMode];
          return (
            <button
              onClick={cycleMode}
              title={`Theme: ${MODE_LABEL[colorMode]}`}
              aria-label={`Theme: ${MODE_LABEL[colorMode]}`}
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
              <Icon size={16} weight="regular" />
            </button>
          );
        })()}
      </header>

      <main style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {state.status === "idle" && (
          <DropZone
            dragging={dragging}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onOpen={() => setOpenDialogOpen(true)}
            isDark={isDark}
          />
        )}
        {state.status === "loading" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: chrome.muted,
            }}
          >
            Parsing {state.name}...
          </div>
        )}
        {state.status === "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
            }}
          >
            <div style={{ color: "#d93025", fontWeight: 600 }}>Failed to parse {state.name}</div>
            <div style={{ color: chrome.muted, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
              {state.message}
            </div>
          </div>
        )}
        {state.status === "ready" && (
          <div
            ref={graphContainerRef}
            style={{ position: "relative", width: "100%", height: "100%" }}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
          >
            <ModelGraphView
              ref={graphViewRef}
              graph={state.graph}
              onTargetClick={handleTargetClick}
              selectedEdgeTensorName={selectedEdgeTensorName}
              searchQuery={searchQuery}
              colorMode={colorMode}
            />
            <div style={{ position: "absolute", top: 16, right: 16, width: 320, zIndex: 10 }}>
              <NodePropertyPanel
                target={selected}
                graph={state.status === "ready" ? state.graph : undefined}
                onTensorClick={handleTensorClick}
                onBack={history.length > 0 ? handleBack : undefined}
                onClose={handleClose}
                colorMode={colorMode}
                inputSources={tensorSources}
                tensorShapes={state.status === "ready" ? state.graph.tensorShapes : undefined}
              />
            </div>
          </div>
        )}
      </main>
      {weightsDialogOpen && state.status === "ready" && (
        <WeightsDialog
          graph={state.graph}
          chrome={chrome}
          isDark={isDark}
          onClose={() => setWeightsDialogOpen(false)}
          onLoaded={onWeightsLoaded}
        />
      )}
      {openDialogOpen && (
        <OpenModelDialog
          chrome={chrome}
          isDark={isDark}
          onClose={() => setOpenDialogOpen(false)}
          onFile={loadFile}
          onUrl={loadUrl}
        />
      )}
    </div>
  );
}

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#1a73e8" />
      <path
        d="M14 18 L24 48 L32 30 L40 48 L50 18"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DropZone({
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpen,
  isDark,
}: {
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onOpen: () => void;
  isDark: boolean;
}) {
  const headline = isDark ? "#ececf1" : "#1a1a1f";
  const sub = isDark ? "#9ea0aa" : "#5b6270";
  const faint = isDark ? "#6b6e78" : "#9aa0ac";
  const dragBg = isDark ? "rgba(26,115,232,0.12)" : "rgba(26,115,232,0.06)";
  const dragOutline = "rgba(26,115,232,0.55)";
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 14,
        background: dragging ? dragBg : "transparent",
        boxShadow: dragging ? `inset 0 0 0 2px ${dragOutline}` : "none",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    >
      <BrandMark size={64} />
      <div
        style={{
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "-0.01em",
          color: headline,
          marginTop: 4,
        }}
      >
        Open a neural network model
      </div>
      <div style={{ color: sub, fontSize: 13 }}>
        Supports .onnx, .tflite, .keras, .pt, .pte and .pb
      </div>
      <button
        onClick={onOpen}
        style={{
          marginTop: 8,
          padding: "9px 20px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 1px 2px rgba(26,115,232,0.25)",
        }}
      >
        Open model
      </button>
      <div style={{ color: faint, fontSize: 12 }}>or drop a file here</div>
    </div>
  );
}
