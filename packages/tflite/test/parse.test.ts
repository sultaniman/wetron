import { test, expect } from "bun:test";
import { parseTflite } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mobilenet_v2.tflite", import.meta.url);

async function loadModel() {
  const buf = await Bun.file(MODEL_PATH).arrayBuffer();
  return new Uint8Array(buf);
}

test("parseTflite returns a ModelGraph", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  expect(graph.nodes.length).toBe(66); // verified against netron
  expect(graph.inputs.length).toBe(1);
  expect(graph.outputs.length).toBe(1);
});

test("every node has a non-empty opType", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  for (const node of graph.nodes) {
    expect(node.opType).toBeTruthy();
  }
});

test("graph inputs have dtype", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  for (const inp of graph.inputs) {
    expect(inp.dtype).toBeTruthy();
    expect(inp.shape).not.toBeNull();
  }
});

test("parseTflite throws ParseError on garbage input", () => {
  const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00]);
  expect(() => parseTflite(bad)).toThrow(ParseError);
});

test("graph.initializers is a Map with weight entries", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  expect(graph.initializers).toBeInstanceOf(Map);
  expect(graph.initializers.size).toBeGreaterThan(0);
});

test("graph input tensors are not in initializers", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  for (const input of graph.inputs) {
    expect(graph.initializers.has(input.name)).toBe(false);
  }
});
