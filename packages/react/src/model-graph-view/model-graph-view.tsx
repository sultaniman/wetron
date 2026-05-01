import React, { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  PanOnScrollMode,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./model-graph-view.css";
import type { GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";
import { GraphNodeComponent } from "../nodes/graph-node.tsx";
import { IoNodeComponent } from "../nodes/io-node.tsx";
import { ModelEdge } from "../edges/model-edge.tsx";
import { type PanelTarget } from "../node-property-panel/node-property-panel.tsx";
import { ColorModeContext, useColorMode, type ColorMode } from "../color-mode-context.ts";
import { MINIMAP_THEME, EDGE_THEME } from "../theme.ts";
import { useModelNodes } from "./hooks.ts";

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent as NodeTypes[string],
  ioNode: IoNodeComponent as NodeTypes[string],
};

const edgeTypes = { modelEdge: ModelEdge } as const;

type FlowEdgeData = {
  tensorName: string;
  sourceOpType: string;
  sourceNodeName: string;
  targetOpType: string;
  targetNodeName: string;
};

type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: ColorMode;
  selectedEdgeTensorName?: string | null;
};

function Inner({ graph, onTargetClick, selectedEdgeTensorName, colorMode }: Props) {
  const { fitView } = useReactFlow();
  const isDark = useColorMode() === "dark";
  const edgeDefaults = useMemo(
    () => (isDark ? { stroke: "#7a7a9a", opacity: 0.55 } : { stroke: "rgba(60,60,100,0.55)" }),
    [isDark],
  );
  const { nodes, onNodesChange, layoutNodes, layoutEdges } = useModelNodes(graph);

  const edges = useMemo(
    () =>
      layoutEdges.map((e) => {
        const d = e.data as FlowEdgeData | undefined;
        if (d?.tensorName === selectedEdgeTensorName) {
          return {
            ...e,
            style: {
              stroke: EDGE_THEME.selectedStroke,
              strokeWidth: EDGE_THEME.selectedStrokeWidth,
              opacity: 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: EDGE_THEME.selectedStroke,
              width: 10,
              height: 10,
            },
          };
        }
        return e;
      }),
    [layoutEdges, selectedEdgeTensorName],
  );

  const handleNodeClick = useCallback<NodeMouseHandler<Node<GraphNodeData>>>(
    (event, node) => {
      if (!onTargetClick) return;
      const weightRow = (event.target as Element).closest(
        "[data-weight-name]",
      ) as HTMLElement | null;
      if (weightRow) {
        const name = weightRow.dataset.weightName;
        const shapeStr = weightRow.dataset.weightShape;
        if (name && shapeStr) {
          onTargetClick({
            tensor: {
              name,
              shape: shapeStr.split(",").map(Number),
              dtype: weightRow.dataset.weightDtype ?? null,
            },
          });
        }
        return;
      }
      if (node.data.graphNode) {
        onTargetClick(node.data.graphNode);
      } else if (node.data.graphValue) {
        onTargetClick({
          graphValue: node.data.graphValue,
          direction: node.data.opType === "Input" ? "input" : "output",
        });
      }
    },
    [onTargetClick],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!onTargetClick || !edge.data) return;
      const d = edge.data as FlowEdgeData;
      const sameEdges = layoutEdges.filter(
        (e) => (e.data as FlowEdgeData | undefined)?.tensorName === d.tensorName,
      );
      const from = { opType: d.sourceOpType, name: d.sourceNodeName };
      const to = sameEdges.map((e) => ({
        opType: (e.data as FlowEdgeData).targetOpType,
        name: (e.data as FlowEdgeData).targetNodeName,
      }));
      onTargetClick({ edge: { tensorName: d.tensorName, from, to } });
    },
    [onTargetClick, layoutEdges],
  );

  React.useEffect(() => {
    // Fit to the topmost 6 nodes so the initial zoom is readable (~1.0 for
    // sequential models). For graphs with ≤ 6 nodes this fits all of them.
    const topNodes = [...layoutNodes]
      .sort((a, b) => a.position.y - b.position.y)
      .slice(0, 6)
      .map((n) => ({ id: n.id }));
    fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
  }, [graph, fitView, layoutNodes]);

  return (
    <div data-theme={isDark ? "dark" : "light"} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
          style: edgeDefaults,
        }}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomActivationKeyCode="Meta"
        minZoom={0.05}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          style={{
            background: isDark ? MINIMAP_THEME.dark.background : MINIMAP_THEME.light.background,
            borderRadius: MINIMAP_THEME.borderRadius,
            border: "none",
            overflow: "hidden",
          }}
          nodeColor={isDark ? MINIMAP_THEME.dark.nodeColor : MINIMAP_THEME.light.nodeColor}
          maskColor={isDark ? MINIMAP_THEME.dark.maskColor : MINIMAP_THEME.light.maskColor}
        />
        <Controls />
        <Background color={isDark ? "#2a2a3a" : "#d0d0d8"} />
      </ReactFlow>
    </div>
  );
}

export function ModelGraphView({ colorMode = "system", ...rest }: Props) {
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ReactFlowProvider>
        <Inner {...rest} colorMode={colorMode} />
      </ReactFlowProvider>
    </ColorModeContext.Provider>
  );
}
