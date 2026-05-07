import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowUpIcon } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { getViewportForBounds } from "@xyflow/react";
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraphViewHandle } from "@wetron/react";
import type { ModelGraph } from "@wetron/core";
import type { PanelTarget, ColorMode } from "@wetron/react";

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

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
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
        <span style={{ fontWeight: 700, fontSize: 18, color: chrome.text }}>wetron</span>
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
        <button
          onClick={cycleMode}
          style={{
            marginLeft: state.status === "ready" ? 0 : "auto",
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
          {MODE_LABEL[colorMode]}
        </button>
        <label
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
          Open model
          <input
            type="file"
            accept=".onnx,.tflite,.keras,.pte,.pt,.pb"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
        </label>
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
    </div>
  );
}

function DropZone({
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  isDark,
}: {
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  isDark: boolean;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        border: `2px dashed ${dragging ? "#1a73e8" : isDark ? "#333" : "#ccc"}`,
        margin: 24,
        borderRadius: 12,
        background: dragging ? (isDark ? "#1a2a4a" : "#e8f0fe") : isDark ? "#1a1a2a" : "#fafafa",
        transition: "all 0.15s",
      }}
    >
      <div style={{ color: isDark ? "#e0e0e0" : "#333" }}>
        <ArrowUpIcon size={48} />
      </div>
      <div style={{ fontWeight: 600, color: isDark ? "#e0e0e0" : "#333" }}>
        Drop a model file here
      </div>
      <div style={{ color: isDark ? "#888" : "#888", fontSize: 13 }}>
        Supports .onnx, .tflite, .keras, .pt, .pte and .pb
      </div>
    </div>
  );
}
