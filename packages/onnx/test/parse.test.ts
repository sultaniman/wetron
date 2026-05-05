import { test, expect } from "bun:test";
import { parseOnnx } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);

async function loadModel() {
  const buf = await Bun.file(MODEL_PATH).arrayBuffer();
  return new Uint8Array(buf);
}

test("mnist-12: 12 nodes, 1 input (float32), 1 output, initializers not in inputs", async () => {
  const graph = parseOnnx(await loadModel());
  expect(graph.nodes.length).toBe(12);
  expect(graph.nodes.every((n) => n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].dtype).toBe("float32");
  expect(graph.inputs[0].shape).not.toBeNull();
  expect(graph.outputs.length).toBe(1);
  expect(graph.initializers.size).toBeGreaterThan(0);
  const inputNames = new Set(graph.inputs.map((i) => i.name));
  for (const name of graph.initializers.keys()) expect(inputNames.has(name)).toBe(false);
});

test("throws ParseError on garbage input", () => {
  expect(() => parseOnnx(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toThrow(ParseError);
});
