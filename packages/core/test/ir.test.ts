import { test, expect } from "bun:test";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "../src/ir.ts";
import { ParseError } from "../src/ir.ts";

test("ParseError has correct shape", () => {
  const err = new ParseError("onnx", "bad magic bytes");
  expect(err).toBeInstanceOf(Error);
  expect(err.format).toBe("onnx");
  expect(err.context).toBe("bad magic bytes");
  expect(err.message).toBe("[onnx] bad magic bytes");
  expect(err.name).toBe("ParseError");
});

test("ModelGraph type is assignable", () => {
  const node: GraphNode = {
    name: "conv1",
    opType: "Conv",
    inputs: ["x", "w"],
    outputs: ["y"],
    attributes: { group: 1, dilations: [1, 1] },
  };
  const value: GraphValue = { name: "x", shape: [1, 3, 224, 224], dtype: "float32" };
  const graph: ModelGraph = {
    name: "test",
    inputs: [value],
    outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
    nodes: [node],
    initializers: new Map(),
    tensorShapes: new Map(),
  };
  expect(graph.nodes.length).toBe(1);
  expect(graph.nodes[0].opType).toBe("Conv");
});
