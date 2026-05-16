import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import { parseModel, parseModelFromUrl } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraphViewHandle } from "@wetron/react";
import type { ModelGraph } from "@wetron/core";
import type { PanelTarget } from "@wetron/react";
import { BrandMark } from "./brand-mark.tsx";
import { GitHubIcon } from "./github-icon.tsx";
import { DropZone } from "./drop-zone.tsx";
import { OpenModelDialog } from "./open-model-dialog.tsx";
import { WeightsDialog } from "./weights-dialog.tsx";
import { MODE_CYCLE, MODE_ICON, MODE_LABEL, resolveMode, type ColorMode } from "./theme.ts";
import css from "./app.module.css";

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

  const ModeIcon = MODE_ICON[colorMode];
  const ready = state.status === "ready";
  const showWeightsButton = ready && state.graph.hasExternalWeights && !state.graph.weights;

  return (
    <div className={css.root} data-theme={resolvedMode}>
      <header className={css.header}>
        <a href="/" className={css.brandLink}>
          <BrandMark size={22} />
          <span className={css.brandName}>wetron</span>
        </a>
        <a
          href="https://github.com/sultaniman/wetron"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          aria-label="View on GitHub"
          className={`${css.iconLink} ${css.iconLinkAlign}`}
        >
          <GitHubIcon size={22} />
        </a>
        <a
          href="https://sultaniman.github.io/wetron/"
          target="_blank"
          rel="noopener noreferrer"
          title="Documentation"
          aria-label="Documentation"
          className={`${css.iconLink} ${css.iconLinkAlignTight}`}
        >
          Docs
        </a>
        {state.status !== "idle" && <span className={css.fileName}>{state.name}</span>}
        {ready && (
          <span className={css.stats}>
            {state.graph.nodes.length} nodes · {state.graph.inputs.length} inputs ·{" "}
            {state.graph.outputs.length} outputs
          </span>
        )}
        {ready && (
          <input
            type="search"
            placeholder="Search ops…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={css.search}
          />
        )}
        {ready && (
          <button onClick={exportPng} className={css.toolButton}>
            Export PNG
          </button>
        )}
        {showWeightsButton && (
          <button onClick={() => setWeightsDialogOpen(true)} className={css.toolButton}>
            Load weights…
          </button>
        )}
        {ready && state.graph.weights && (
          <span
            className={css.weightsStatus}
            title={`${state.graph.weights.totalBytes.toLocaleString()} bytes loaded`}
          >
            ✓ weights loaded
          </span>
        )}
        <button
          onClick={() => setOpenDialogOpen(true)}
          className={`${css.openButton} ${ready ? "" : css.openButtonPushRight}`}
        >
          Open model
        </button>
        <button
          onClick={cycleMode}
          title={`Theme: ${MODE_LABEL[colorMode]}`}
          aria-label={`Theme: ${MODE_LABEL[colorMode]}`}
          className={css.themeButton}
        >
          <ModeIcon size={16} weight="regular" />
        </button>
      </header>

      <main className={css.main}>
        {state.status === "idle" && (
          <DropZone
            theme={resolvedMode}
            dragging={dragging}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onOpen={() => setOpenDialogOpen(true)}
          />
        )}
        {state.status === "loading" && (
          <div className={css.placeholder}>Parsing {state.name}...</div>
        )}
        {state.status === "error" && (
          <div className={css.errorBox}>
            <div className={css.errorTitle}>Failed to parse {state.name}</div>
            <div className={css.errorMessage}>{state.message}</div>
          </div>
        )}
        {ready && (
          <div
            ref={graphContainerRef}
            className={css.graphHost}
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
            <div className={css.panelHost}>
              <NodePropertyPanel
                target={selected}
                graph={state.graph}
                onTensorClick={handleTensorClick}
                onBack={history.length > 0 ? handleBack : undefined}
                onClose={handleClose}
                colorMode={colorMode}
                inputSources={tensorSources}
                tensorShapes={state.graph.tensorShapes}
              />
            </div>
          </div>
        )}
      </main>
      {weightsDialogOpen && ready && (
        <WeightsDialog
          theme={resolvedMode}
          graph={state.graph}
          onClose={() => setWeightsDialogOpen(false)}
          onLoaded={onWeightsLoaded}
        />
      )}
      {openDialogOpen && (
        <OpenModelDialog
          theme={resolvedMode}
          onClose={() => setOpenDialogOpen(false)}
          onFile={loadFile}
          onUrl={loadUrl}
        />
      )}
    </div>
  );
}
