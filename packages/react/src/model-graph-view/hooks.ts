import { useMemo, useEffect } from "react";
import {
  useNodesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";
import { EDGE_THEME } from "../theme.ts";

type FlowEdgeData = {
  tensorName: string;
  sourceOpType: string;
  sourceNodeName: string;
  targetOpType: string;
  targetNodeName: string;
};

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
  selectedEdgeTensorName?: string | null,
): Edge[] {
  return useMemo(
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
}
