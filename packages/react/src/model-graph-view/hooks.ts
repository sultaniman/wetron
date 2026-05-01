import { type MouseEvent, useMemo, useEffect, useCallback } from "react";
import {
  useNodesState,
  useReactFlow,
  MarkerType,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";
import type { PanelTarget } from "../node-property-panel/node-property-panel.tsx";
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
