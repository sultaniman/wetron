import { useMemo, useEffect, useCallback, useState } from 'react';
import { useNodesState, useReactFlow, MarkerType, type Node, type Edge, type NodeMouseHandler } from '@xyflow/react';
import type { MouseEvent } from 'react';
import {
  modelGraphToFlow,
  type FlowEdge,
  type GraphFlowNode,
  type IoFlowNode,
  type LayoutDirection,
} from '@wetron/core/transform';
import type { ModelGraph, PanelTarget } from '@wetron/common/ir';
import { EDGE_THEME } from '../theme.ts';

type FlowEdgeData = FlowEdge['data'];
type ModelFlowNode = Node<GraphFlowNode['data'], 'graphNode'> | Node<IoFlowNode['data'], 'ioNode'>;

export function useModelNodes(graph: ModelGraph, rankdir: LayoutDirection = 'TB') {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => modelGraphToFlow(graph, { rankdir }),
    [graph, rankdir],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes as ModelFlowNode[]);
  useEffect(() => {
    setNodes(layoutNodes as ModelFlowNode[]);
  }, [layoutNodes, setNodes]);
  return {
    nodes,
    onNodesChange,
    layoutNodes: layoutNodes as ModelFlowNode[],
    layoutEdges,
  };
}

export function useEdgeHighlight(
  layoutEdges: Edge[],
  selectedEdgeTensorName: string | null | undefined,
  isDark: boolean,
  matchedNodeIds?: ReadonlySet<string>,
): Edge[] {
  return useMemo(() => {
    const anySelected = selectedEdgeTensorName != null;
    const filtering = matchedNodeIds != null && matchedNodeIds.size > 0;
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
            stroke: isDark ? 'rgba(120,120,160,0.2)' : 'rgba(0,0,0,0.1)',
            opacity: 1,
          },
        };
      }
      if (filtering) {
        const sourceMatch = matchedNodeIds!.has(e.source);
        const targetMatch = matchedNodeIds!.has(e.target);
        if (!sourceMatch && !targetMatch) {
          return {
            ...e,
            style: {
              stroke: isDark ? 'rgba(120,120,160,0.15)' : 'rgba(0,0,0,0.07)',
              opacity: 1,
            },
          };
        }
      }
      return e;
    });
  }, [layoutEdges, selectedEdgeTensorName, isDark, matchedNodeIds]);
}

export function useNodeClickHandler(onTargetClick?: (target: PanelTarget) => void): NodeMouseHandler<ModelFlowNode> {
  return useCallback<NodeMouseHandler<ModelFlowNode>>(
    (event, node) => {
      if (!onTargetClick) return;

      const weightRow = (event.target as Element).closest('[data-weight-name]') as HTMLElement | null;
      if (weightRow) {
        const name = weightRow.dataset.weightName;
        const shapeStr = weightRow.dataset.weightShape;
        if (name && shapeStr) {
          onTargetClick({
            tensor: {
              name,
              shape: shapeStr.split(',').map(Number),
              dtype: weightRow.dataset.weightDtype ?? null,
            },
          });
        }
        return;
      }

      if (node.type === 'graphNode') {
        onTargetClick(node.data.graphNode);
      } else {
        onTargetClick({
          graphValue: node.data.graphValue,
          direction: node.data.opType === 'Input' ? 'input' : 'output',
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
      const sameEdges = layoutEdges.filter((e) => (e.data as FlowEdgeData | undefined)?.tensorName === d.tensorName);
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

export function useNodeDim(nodes: ModelFlowNode[], matchedNodeIds: ReadonlySet<string>): ModelFlowNode[] {
  return useMemo(() => {
    if (matchedNodeIds.size === 0) return nodes;
    return nodes.map((n) => {
      if (n.type !== 'graphNode') return n;
      const matched = matchedNodeIds.has(n.id);
      return matched ? n : { ...n, style: { ...n.style, opacity: 0.1 } };
    });
  }, [nodes, matchedNodeIds]);
}

export type NavStack = {
  currentGraph: ModelGraph;
  depth: number;
  scopeName: string | null;
  navigateInto: (subGraph: ModelGraph) => void;
  navigateBack: () => void;
};

export function useNavStack(rootGraph: ModelGraph): NavStack {
  const [stack, setStack] = useState<readonly ModelGraph[]>([rootGraph]);
  useEffect(() => {
    setStack([rootGraph]);
  }, [rootGraph]);
  const navigateInto = useCallback((sub: ModelGraph) => {
    setStack((s) => (s[s.length - 1] === sub ? s : [...s, sub]));
  }, []);
  const navigateBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const currentGraph = stack[stack.length - 1];
  const depth = stack.length - 1;
  return {
    currentGraph,
    depth,
    scopeName: depth > 0 ? currentGraph.name : null,
    navigateInto,
    navigateBack,
  };
}

export function useFitOnGraphChange(graph: ModelGraph, layoutNodes: ModelFlowNode[]): void {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const topNodes = [...layoutNodes]
      .sort((a, b) => a.position.y - b.position.y)
      .slice(0, 6)
      .map((n) => ({ id: n.id }));
    fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
  }, [graph, fitView, layoutNodes]);
}
