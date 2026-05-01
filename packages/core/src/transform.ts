import * as Dagre from "dagre";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";
import { opInputLabels } from "./op-inputs.ts";

export type GraphNodeData = {
  opType: string;
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
  graphNode?: GraphNode;
  graphValue?: GraphValue;
  shape?: readonly number[] | null;
  dtype?: string | null;
  weightInputs?: readonly {
    slot: number;
    label: string;
    name: string;
    shape: readonly number[];
    dtype: string;
  }[];
};

export type FlowNode = {
  id: string;
  type: "graphNode" | "ioNode";
  position: { x: number; y: number };
  data: GraphNodeData;
  initialWidth: number;
  initialHeight: number;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
  data: {
    readonly tensorName: string;
    readonly sourceOpType: string;
    readonly sourceNodeName: string;
    readonly targetOpType: string;
    readonly targetNodeName: string;
  };
};

const NODE_W = 220;
const BASE_H = 42;
const ROW_H = 19;

export function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60 });

  const flowNodes: FlowNode[] = [];
  const flowEdges: FlowEdge[] = [];
  const outputToNodeId = new Map<string, string>();
  const nodeIdToOpType = new Map<string, string>();
  const nodeIdToName = new Map<string, string>();

  for (const gv of graph.inputs) {
    const id = `input::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: {
        opType: "Input",
        name: gv.name,
        inputs: [],
        outputs: [gv.name],
        attributes: {},
        shape: gv.shape,
        dtype: gv.dtype,
        graphValue: gv,
      },
      initialWidth: NODE_W,
      initialHeight: BASE_H + ROW_H,
    });
    g.setNode(id, { width: NODE_W, height: BASE_H + ROW_H });
    outputToNodeId.set(gv.name, id);
    nodeIdToOpType.set(id, "Input");
    nodeIdToName.set(id, gv.name);
  }

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const id = `node::${node.name || `${node.opType}_${i}`}`;
    const labels = opInputLabels(node.opType);
    const weightInputs =
      labels.length === 0
        ? undefined
        : node.inputs
            .map((name, slot) => {
              const init = graph.initializers.get(name);
              return init ? { slot, label: labels[slot] ?? `in_${slot}`, name, ...init } : null;
            })
            .filter((w): w is NonNullable<typeof w> => w !== null);
    const nodeH = BASE_H + (weightInputs?.length ?? 0) * ROW_H;
    flowNodes.push({
      id,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {
        opType: node.opType,
        name: node.name,
        inputs: node.inputs,
        outputs: node.outputs,
        attributes: node.attributes,
        graphNode: node,
        weightInputs: weightInputs?.length ? weightInputs : undefined,
      },
      initialWidth: NODE_W,
      initialHeight: nodeH,
    });
    g.setNode(id, { width: NODE_W, height: nodeH });
    for (const out of node.outputs) outputToNodeId.set(out, id);
    nodeIdToOpType.set(id, node.opType);
    nodeIdToName.set(id, node.name || `${node.opType}_${i}`);
  }

  for (const gv of graph.outputs) {
    const id = `output::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: {
        opType: "Output",
        name: gv.name,
        inputs: [gv.name],
        outputs: [],
        attributes: {},
        shape: gv.shape,
        dtype: gv.dtype,
        graphValue: gv,
      },
      initialWidth: NODE_W,
      initialHeight: BASE_H + ROW_H,
    });
    g.setNode(id, { width: NODE_W, height: BASE_H + ROW_H });
    nodeIdToOpType.set(id, "Output");
    nodeIdToName.set(id, gv.name);
  }

  for (const fn of flowNodes) {
    if (fn.type === "ioNode" && fn.data.opType === "Input") continue;
    for (const inputName of fn.data.inputs) {
      const srcId = outputToNodeId.get(inputName);
      if (srcId) {
        flowEdges.push({
          id: `${srcId}=>${fn.id}::${inputName}`,
          source: srcId,
          target: fn.id,
          type: "smoothstep",
          data: {
            tensorName: inputName,
            sourceOpType: nodeIdToOpType.get(srcId) ?? "",
            sourceNodeName: nodeIdToName.get(srcId) ?? "",
            targetOpType: fn.data.opType,
            targetNodeName: nodeIdToName.get(fn.id) ?? "",
          },
        });
        if (!g.hasEdge(srcId, fn.id)) g.setEdge(srcId, fn.id);
      }
    }
  }

  Dagre.layout(g);

  for (const fn of flowNodes) {
    const pos = g.node(fn.id);
    if (pos) fn.position = { x: pos.x - NODE_W / 2, y: pos.y - pos.height / 2 };
  }

  return { nodes: flowNodes, edges: flowEdges };
}
