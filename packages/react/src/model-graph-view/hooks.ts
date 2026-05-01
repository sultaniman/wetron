import { useMemo, useEffect } from "react";
import { useNodesState, type Edge, type Node } from "@xyflow/react";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";

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
