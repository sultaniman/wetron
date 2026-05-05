import { test, expect } from "bun:test";
import { modelGraphToFlow } from "../src/transform.ts";
import type { ModelGraph } from "../src/ir.ts";

const GRAPH: ModelGraph = {
  name: "test",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
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

test("node and edge counts: 2 ops + 2 IO nodes, 3 edges", () => {
  const { nodes, edges } = modelGraphToFlow(GRAPH);
  expect(nodes.length).toBe(4);
  expect(edges.length).toBe(3);
});

test("all nodes have finite dagre positions", () => {
  const { nodes } = modelGraphToFlow(GRAPH);
  for (const n of nodes) {
    expect(isFinite(n.position.x)).toBe(true);
    expect(isFinite(n.position.y)).toBe(true);
  }
});

test("edge sources and targets reference existing node ids", () => {
  const { nodes, edges } = modelGraphToFlow(GRAPH);
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    expect(ids.has(e.source)).toBe(true);
    expect(ids.has(e.target)).toBe(true);
  }
});

test("Conv node gets weightInputs with labels and shapes from initializers", () => {
  const { nodes } = modelGraphToFlow(GRAPH);
  const conv = nodes.find((n) => n.data.opType === "Conv");
  expect(conv?.data.weightInputs?.length).toBe(2);
  expect(conv?.data.weightInputs?.[0].label).toBe("W");
  expect(conv?.data.weightInputs?.[0].shape).toEqual([64, 3, 3, 3]);
});

test("FlowNode and FlowEdge ids are unique", () => {
  const { nodes, edges } = modelGraphToFlow(GRAPH);
  expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
  expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
});

test("edge ids are unique when a node consumes the same tensor in two slots", () => {
  // Add(x, x) - same input tensor in slot 0 and slot 1.
  const graph: ModelGraph = {
    name: "selfadd",
    inputs: [{ name: "x", shape: [1], dtype: "float32" }],
    outputs: [{ name: "y", shape: [1], dtype: "float32" }],
    nodes: [{ name: "add", opType: "Add", inputs: ["x", "x"], outputs: ["y"], attributes: {} }],
    initializers: new Map(),
    tensorShapes: new Map(),
  };
  const { edges } = modelGraphToFlow(graph);
  // 2 edges from input::x to Add (one per slot) + 1 from Add to output::y.
  expect(edges.length).toBe(3);
  expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
  const addInputs = edges.filter((e) => e.source.startsWith("input::"));
  expect(addInputs.length).toBe(2);
  expect(new Set(addInputs.map((e) => e.id)).size).toBe(2);
});

test("FlowNode ids are unique when two graph inputs share a name", () => {
  // Pathological but possible in malformed graphs.
  const graph: ModelGraph = {
    name: "dup",
    inputs: [
      { name: "x", shape: [1], dtype: "float32" },
      { name: "x", shape: [2], dtype: "float32" },
    ],
    outputs: [{ name: "y", shape: [1], dtype: "float32" }],
    nodes: [{ name: "id", opType: "Identity", inputs: ["x"], outputs: ["y"], attributes: {} }],
    initializers: new Map(),
    tensorShapes: new Map(),
  };
  const { nodes } = modelGraphToFlow(graph);
  const inputIds = nodes.filter((n) => n.data.opType === "Input").map((n) => n.id);
  expect(inputIds.length).toBe(2);
  expect(new Set(inputIds).size).toBe(2);
});
