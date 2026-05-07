import { useEffect, useImperativeHandle, forwardRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  MarkerType,
  PanOnScrollMode,
  useReactFlow,
  getNodesBounds,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./model-graph-view.css";
import type { ModelGraph, PanelTarget, ParseWarning } from "@wetron/core/ir";
import type { LayoutDirection } from "@wetron/core/transform";
import { GraphNodeComponent } from "../nodes/graph-node.tsx";
import { IoNodeComponent } from "../nodes/io-node.tsx";
import { ModelEdge } from "../edges/model-edge.tsx";
import { ColorModeContext, useColorMode, type ColorMode } from "../color-mode-context.ts";
import { MINIMAP_THEME } from "../theme.ts";
import {
  useModelNodes,
  useEdgeHighlight,
  useNodeDim,
  useNodeClickHandler,
  useEdgeClickHandler,
  useFitOnGraphChange,
} from "./hooks.ts";
import { filterGraph } from "@wetron/core";

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent as NodeTypes[string],
  ioNode: IoNodeComponent as NodeTypes[string],
};

const edgeTypes = { modelEdge: ModelEdge } as const;

const EDGE_DEFAULTS = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
  style: { stroke: "var(--wetron-edge-default)", opacity: "var(--wetron-edge-default-opacity)" },
} as const;

const EMPTY_NAMES: ReadonlySet<string> = new Set();

export type ModelGraphViewHandle = {
  /** Fit all nodes into view and wait for DOM to update (ensures all nodes are rendered). */
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  /** Bounding box of all nodes - use with getViewportForBounds for a hi-res export. */
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  /** The `.react-flow__viewport` element - capture with a custom transform for PNG export. */
  getViewportElement: () => HTMLElement | null;
};

type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  onWarnings?: (warnings: readonly ParseWarning[]) => void;
  colorMode?: ColorMode;
  selectedEdgeTensorName?: string | null;
  searchQuery?: string;
  /** Layout direction. Defaults to "TB" (top-to-bottom). Use "LR" for left-to-right pipelines. */
  rankdir?: LayoutDirection;
};

const Inner = forwardRef<ModelGraphViewHandle, Props & { colorMode: ColorMode }>(function Inner(
  { graph, onTargetClick, onWarnings, selectedEdgeTensorName, searchQuery, colorMode, rankdir },
  ref,
) {
  const isDark = useColorMode() === "dark";
  const rf = useReactFlow();
  const { nodes: rawNodes, onNodesChange, layoutNodes, layoutEdges } = useModelNodes(
    graph,
    rankdir,
  );
  const matchedNames = searchQuery ? filterGraph(graph, searchQuery) : EMPTY_NAMES;
  const nodes = useNodeDim(rawNodes, matchedNames);
  const edges = useEdgeHighlight(layoutEdges, selectedEdgeTensorName, isDark, matchedNames);
  const handleNodeClick = useNodeClickHandler(onTargetClick);
  const handleEdgeClick = useEdgeClickHandler(onTargetClick, layoutEdges);
  useFitOnGraphChange(graph, layoutNodes);
  useEffect(() => {
    onWarnings?.(graph.warnings ?? []);
  }, [graph, onWarnings]);

  useImperativeHandle(
    ref,
    () => ({
      async fitAll() {
        const allNodes = rf.getNodes();
        rf.fitView({ nodes: allNodes.map((n) => ({ id: n.id })), padding: 0.1, duration: 0 });
        // Two frames: first for React to flush state, second for DOM to settle.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      },
      getViewport() {
        return rf.getViewport();
      },
      setViewport(vp) {
        rf.setViewport(vp);
      },
      getNodesBounds() {
        return getNodesBounds(rf.getNodes());
      },
      getViewportElement() {
        return document.querySelector<HTMLElement>(".react-flow__viewport");
      },
    }),
    [rf],
  );

  return (
    <div
      className="wetron-root"
      data-theme={isDark ? "dark" : "light"}
      style={{ width: "100%", height: "100%" }}
    >
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        defaultEdgeOptions={EDGE_DEFAULTS}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomActivationKeyCode="Meta"
        minZoom={0.05}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          style={{
            background: isDark ? MINIMAP_THEME.dark.background : MINIMAP_THEME.light.background,
            borderRadius: MINIMAP_THEME.borderRadius,
            border: "none",
            overflow: "hidden",
            cursor: "crosshair",
          }}
          nodeColor={isDark ? MINIMAP_THEME.dark.nodeColor : MINIMAP_THEME.light.nodeColor}
          maskColor={isDark ? MINIMAP_THEME.dark.maskColor : MINIMAP_THEME.light.maskColor}
          onClick={(_, pos) => rf.setCenter(pos.x, pos.y, { zoom: rf.getViewport().zoom })}
        />
        <Controls />
        <Background color="var(--wetron-bg-pattern)" />
      </ReactFlow>
    </div>
  );
});

export const ModelGraphView = forwardRef<ModelGraphViewHandle, Props>(function ModelGraphView(
  { colorMode = "system", ...rest },
  ref,
) {
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ReactFlowProvider>
        <Inner {...rest} colorMode={colorMode} ref={ref} />
      </ReactFlowProvider>
    </ColorModeContext.Provider>
  );
});
