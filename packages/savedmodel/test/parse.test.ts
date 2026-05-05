import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { parseSavedModel } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const fixtureDir = new URL("../../../test-models/", import.meta.url);

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(name, fixtureDir)));
}

test("small_keras_metadata.pb: Keras layer graph", () => {
  const graph = parseSavedModel(fixture("small_keras_metadata.pb"));
  // 21 nodes (InputLayer nodes are excluded)
  expect(graph.nodes.length).toBe(21);
  expect(graph.nodes.some((n) => n.opType === "Conv2D")).toBe(true);
  expect(graph.inputs.length).toBeGreaterThanOrEqual(1);
  expect(graph.outputs.length).toBeGreaterThanOrEqual(1);
});

test("large_keras_metadata.pb: Keras layer graph", () => {
  const graph = parseSavedModel(fixture("large_keras_metadata.pb"));
  // 152 nodes
  expect(graph.nodes.length).toBeGreaterThan(100);
  expect(graph.nodes.some((n) => n.opType === "Conv2D")).toBe(true);
});

test("small_saved_model.pb: TF op graph", () => {
  const graph = parseSavedModel(fixture("small_saved_model.pb"));
  // 257 nodes, 2 inputs (Placeholder nodes), 148 outputs
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.inputs.length).toBeGreaterThanOrEqual(1);
  // TF SavedModel serving graph uses StatefulPartitionedCall, not Conv2D
  expect(graph.nodes.some((n) => n.opType === "StatefulPartitionedCall")).toBe(true);
});

test("large_saved_model.pb: TF op graph", () => {
  const graph = parseSavedModel(fixture("large_saved_model.pb"));
  // 1867 nodes
  expect(graph.nodes.length).toBeGreaterThan(50);
});

test("vertical_saved_model.pb: sequential TF op graph", () => {
  const graph = parseSavedModel(fixture("vertical_saved_model.pb"));
  expect(graph.nodes.length).toBe(72);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].name).toBe("input");
  expect(graph.outputs.length).toBe(1);
  expect(graph.outputs[0].name).toBe("softmax_1");
  expect(graph.nodes.some((n) => n.opType === "Conv2D")).toBe(true);
  expect(graph.nodes.some((n) => n.opType === "Relu")).toBe(true);
  expect(graph.nodes.some((n) => n.opType === "MatMul")).toBe(true);
});

test("unknown .pb content throws ParseError with savedmodel format", () => {
  let err: unknown;
  try {
    parseSavedModel(new Uint8Array([0x00, 0x01]));
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ParseError);
  expect((err as ParseError).format).toBe("savedmodel");
});

test("file too short throws ParseError", () => {
  expect(() => parseSavedModel(new Uint8Array([0x00]))).toThrow(ParseError);
});
