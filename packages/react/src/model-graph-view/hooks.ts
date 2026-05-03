import { useMemo, useEffect, useCallback } from "react";
import {
  useNodesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { MouseEvent } from "react";
import { modelGraphToFlow, type GraphNodeData, type FlowEdge } from "@wetron/core/transform";
import type { ModelGraph, PanelTarget } from "@wetron/core/ir";
import { EDGE_THEME } from "../theme.ts";

type FlowEdgeData = FlowEdge["data"];

export function useModelNodes(graph: ModelGraph) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => modelGraphToFlow(graph),
    [graph],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes as Node<GraphNodeData>[]);
  useEffect(() => {
    setNodes(layoutNodes as Node<GraphNodeData>[]);
  }, [layoutNodes, setNodes]);
  return {
    nodes,
    onNodesChange,
    layoutNodes: layoutNodes as Node<GraphNodeData>[],
    layoutEdges,
  };
}

export function useEdgeHighlight(
  layoutEdges: Edge[],
  selectedEdgeTensorName: string | null | undefined,
  isDark: boolean,
): Edge[] {
  return useMemo(
    () => {
      const anySelected = selectedEdgeTensorName != null;
      return layoutEdges.map((e) => {
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
        if (anySelected) {
          return {
            ...e,
            style: {
              stroke: isDark ? "rgba(120,120,160,0.2)" : "rgba(0,0,0,0.1)",
              opacity: 1,
            },
          };
        }
        return e;
      });
    },
    [layoutEdges, selectedEdgeTensorName, isDark],
  );
}

export function useNodeClickHandler(
  onTargetClick?: (target: PanelTarget) => void,
): NodeMouseHandler<Node<GraphNodeData>> {
  return useCallback<NodeMouseHandler<Node<GraphNodeData>>>(
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
}

export function useEdgeClickHandler(
  onTargetClick: ((target: PanelTarget) => void) | undefined,
  layoutEdges: Edge[],
): (event: MouseEvent, edge: Edge) => void {
  return useCallback(
    (_event: MouseEvent, edge: Edge) => {
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
}

export function useFitOnGraphChange(graph: ModelGraph, layoutNodes: Node<GraphNodeData>[]): void {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const topNodes = [...layoutNodes]
      .sort((a, b) => a.position.y - b.position.y)
      .slice(0, 6)
      .map((n) => ({ id: n.id }));
    fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
  }, [graph, fitView, layoutNodes]);
}
