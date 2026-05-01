import { test, expect } from "bun:test";
import { parseOnnx } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);

async function loadModel() {
  const buf = await Bun.file(MODEL_PATH).arrayBuffer();
  return new Uint8Array(buf);
}

test("parseOnnx returns a ModelGraph from mnist-12", async () => {
  const graph = await parseOnnx(await loadModel());
  expect(graph.name).toBeDefined();
  expect(graph.nodes.length).toBe(12); // verified against netron
  expect(graph.inputs.length).toBe(1);
  expect(graph.outputs.length).toBe(1);
});

test("every node has a non-empty opType", async () => {
  const graph = await parseOnnx(await loadModel());
  for (const node of graph.nodes) {
    expect(node.opType).toBeTruthy();
  }
});

test("graph inputs have shape and dtype", async () => {
  const graph = await parseOnnx(await loadModel());
  const input = graph.inputs[0];
  expect(input.name).toBeTruthy();
  expect(input.shape).not.toBeNull();
  expect(input.dtype).toBe("float32");
});

test("graph outputs have shape and dtype", async () => {
  const graph = await parseOnnx(await loadModel());
  const output = graph.outputs[0];
  expect(output.shape).not.toBeNull();
  expect(output.dtype).toBe("float32");
});

test("parseOnnx throws ParseError on garbage input", async () => {
  const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  await expect(parseOnnx(bad)).rejects.toBeInstanceOf(ParseError);
});

test("graph.initializers is a Map with weight entries", async () => {
  const graph = await parseOnnx(await loadModel());
  expect(graph.initializers).toBeInstanceOf(Map);
  expect(graph.initializers.size).toBeGreaterThan(0);
});

test("initializer entries have non-empty shape and dtype", async () => {
  const graph = await parseOnnx(await loadModel());
  for (const [, init] of graph.initializers) {
    expect(Array.isArray(init.shape)).toBe(true);
    expect(init.shape.length).toBeGreaterThan(0);
    expect(typeof init.dtype).toBe("string");
    expect(init.dtype.length).toBeGreaterThan(0);
  }
});

test("initializer names do not appear in graph.inputs", async () => {
  const graph = await parseOnnx(await loadModel());
  const inputNames = new Set(graph.inputs.map((i) => i.name));
  for (const name of graph.initializers.keys()) {
    expect(inputNames.has(name)).toBe(false);
  }
});
