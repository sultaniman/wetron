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
  type: "modelEdge";
  data: {
    readonly tensorName: string;
    readonly sourceOpType: string;
    readonly sourceNodeName: string;
    readonly targetOpType: string;
    readonly targetNodeName: string;
    readonly points?: readonly { x: number; y: number }[];
  };
};

const NODE_W = 220;
// Heights derived from node-card CSS (border:2 + padding:14 + header:16 for 13px/1.2×).
// SUBTITLE_H: margin-top(2) + line(13 for 11px/1.2×). META_MARGIN: .meta margin-top.
// ROW_H: weight-row margin(3) + padding(4) + line(12 for 10px/1.2×).
// ION_H: ioNode = base + meta-section (margin(5) + single text line(12)).
const CARD_BASE = 32;
const SUBTITLE_H = 15;
const META_MARGIN = 5;
const ROW_H = 19;
const ION_H = CARD_BASE + META_MARGIN + 12; // 49

export function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

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
      initialHeight: ION_H,
    });

    g.setNode(id, { width: NODE_W, height: ION_H });
    outputToNodeId.set(gv.name, id);
    nodeIdToOpType.set(id, "Input");
    nodeIdToName.set(id, gv.name);
  }

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const id = `node::${i}::${node.name || node.opType}`;
    const labels = opInputLabels(node.opType);
    const weightInputsRaw = node.inputs
      .map((name, slot) => {
        const init = graph.initializers.get(name);
        return init ? { slot, label: labels[slot] ?? `in_${slot}`, name, ...init } : null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);

    const weightInputs = weightInputsRaw.length > 0 ? weightInputsRaw : undefined;
    const hasSubtitle = !!(node.name && !/^op_\d+$/.test(node.name));
    const nWeights = weightInputs?.length ?? 0;
    const nodeH =
      CARD_BASE +
      (hasSubtitle ? SUBTITLE_H : 0) +
      (nWeights > 0 ? META_MARGIN + nWeights * ROW_H : 0);

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
        weightInputs,
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
      initialHeight: ION_H,
    });

    g.setNode(id, { width: NODE_W, height: ION_H });
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
          type: "modelEdge",
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

  // Annotate each flow edge with Dagre's intermediate waypoints so the edge
  // component can draw a catmull-rom spline that routes around intermediate nodes.
  // Multiple flow edges sharing the same source->target pair reuse the same points.
  const ptCache = new Map<string, readonly { x: number; y: number }[]>();
  for (let i = 0; i < flowEdges.length; i++) {
    const fe = flowEdges[i];
    const key = `${fe.source}::${fe.target}`;
    let pts = ptCache.get(key);
    if (pts === undefined) {
      const raw = (
        g.edge(fe.source, fe.target) as { points?: { x: number; y: number }[] } | undefined
      )?.points;
      // Slice off first and last - those are dagre's node-center estimates;
      // the edge component uses xyflow's actual handle positions instead.
      pts = raw && raw.length > 2 ? raw.slice(1, raw.length - 1) : [];
      ptCache.set(key, pts);
    }

    if (pts.length > 0) {
      flowEdges[i] = { ...fe, data: { ...fe.data, points: pts } };
    }
  }

  return { nodes: flowNodes, edges: flowEdges };
}
