import { test, expect } from "bun:test";
import { modelGraphToFlow } from "../src/transform.ts";
import type { ModelGraph } from "../src/ir.ts";

const SIMPLE_GRAPH: ModelGraph = {
  name: "test",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
  nodes: [
    { name: "conv1", opType: "Conv", inputs: ["x"], outputs: ["h"], attributes: {} },
    { name: "relu1", opType: "Relu", inputs: ["h"], outputs: ["y"], attributes: {} },
  ],
  initializers: new Map(),
  tensorShapes: new Map(),
};

const GRAPH_WITH_WEIGHTS: ModelGraph = {
  name: "weighted",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 64], dtype: "float32" }],
  nodes: [
    {
      name: "conv1",
      opType: "Conv",
      inputs: ["x", "weight", "bias"],
      outputs: ["h"],
      attributes: {},
    },
    { name: "relu1", opType: "Relu", inputs: ["h"], outputs: ["y"], attributes: {} },
  ],
  initializers: new Map([
    ["weight", { shape: [64, 3, 3, 3], dtype: "float32" }],
    ["bias", { shape: [64], dtype: "float32" }],
  ]),
  tensorShapes: new Map(),
};

test("produces correct node count", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  // 1 input IO + 2 graph nodes + 1 output IO = 4
  expect(nodes.length).toBe(4);
});

test("produces correct edge count", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  // x→conv1, conv1→relu1, relu1→output:y = 3
  expect(edges.length).toBe(3);
});

test("IO nodes have type ioNode", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  const ioNodes = nodes.filter((n) => n.type === "ioNode");
  expect(ioNodes.length).toBe(2);
});

test("graph nodes have type graphNode", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  const graphNodes = nodes.filter((n) => n.type === "graphNode");
  expect(graphNodes.length).toBe(2);
});

test("all nodes have numeric positions after dagre layout", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  for (const n of nodes) {
    expect(typeof n.position.x).toBe("number");
    expect(typeof n.position.y).toBe("number");
    expect(isFinite(n.position.x)).toBe(true);
    expect(isFinite(n.position.y)).toBe(true);
  }
});

test("edge sources and targets reference existing node ids", () => {
  const { nodes, edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    expect(ids.has(e.source)).toBe(true);
    expect(ids.has(e.target)).toBe(true);
  }
});

test("edges carry tensorName matching the connecting tensor", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  // x → conv1
  const e0 = edges.find((e) => e.source === "input::x");
  expect(e0).toBeDefined();
  expect(e0!.data.tensorName).toBe("x");
});

test("edges carry sourceOpType and targetOpType", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const convToRelu = edges.find((e) => e.data.tensorName === "h");
  expect(convToRelu).toBeDefined();
  expect(convToRelu!.data.sourceOpType).toBe("Conv");
  expect(convToRelu!.data.targetOpType).toBe("Relu");
});

test("edges have type smoothstep", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  for (const e of edges) {
    expect(e.type).toBe("smoothstep");
  }
});

test("edges carry sourceNodeName and targetNodeName", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const convToRelu = edges.find((e) => e.data.tensorName === "h");
  expect(convToRelu).toBeDefined();
  expect(convToRelu!.data.sourceNodeName).toBe("conv1");
  expect(convToRelu!.data.targetNodeName).toBe("relu1");
});

test("Conv node with initializers gets weightInputs with labels and shapes", () => {
  const { nodes } = modelGraphToFlow(GRAPH_WITH_WEIGHTS);
  const conv = nodes.find((n) => n.data.opType === "Conv");
  expect(conv?.data.weightInputs).toBeDefined();
  expect(conv?.data.weightInputs?.length).toBe(2);
  expect(conv?.data.weightInputs?.[0].label).toBe("W");
  expect(conv?.data.weightInputs?.[0].shape).toEqual([64, 3, 3, 3]);
  expect(conv?.data.weightInputs?.[1].label).toBe("B");
  expect(conv?.data.weightInputs?.[1].shape).toEqual([64]);
});

test("Relu node with no label table entry has undefined weightInputs", () => {
  const { nodes } = modelGraphToFlow(GRAPH_WITH_WEIGHTS);
  const relu = nodes.find((n) => n.data.opType === "Relu");
  expect(relu?.data.weightInputs).toBeUndefined();
});
