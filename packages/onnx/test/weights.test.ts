import { test, expect } from "bun:test";
import { parseOnnx } from "../src/index.ts";
import { readFileSync } from "node:fs";

test("ONNX parse exposes weight bytes for initializers", async () => {
  const bytes = new Uint8Array(readFileSync("test-models/mnist-12.onnx"));
  const graph = parseOnnx(bytes);

  expect(graph.fileSizeBytes).toBe(bytes.byteLength);
  expect(graph.weights).toBeDefined();
  expect(graph.weights!.totalBytes).toBeGreaterThan(0);

  // Pick the first initializer name.
  const firstName = [...graph.initializers.keys()][0];
  expect(firstName).toBeDefined();

  const init = graph.initializers.get(firstName)!;
  const out = graph.weights!.get(firstName);
  expect(out).toBeInstanceOf(Uint8Array);

  // Byte length should match shape × dtype size for typical Tier 1 dtypes.
  const elementSize: Record<string, number> = {
    float32: 4, float16: 2, int64: 8, int32: 4, int8: 1, uint8: 1,
  };
  const elements = init.shape.reduce((a, b) => a * b, 1);
  const expected = elements * (elementSize[init.dtype] ?? 0);
  if (expected > 0) {
    expect(out!.byteLength).toBe(expected);
  } else {
    expect(out!.byteLength).toBeGreaterThan(0);
  }
});

test("ONNX weights.get returns undefined for unknown name", () => {
  const bytes = new Uint8Array(readFileSync("test-models/mnist-12.onnx"));
  const graph = parseOnnx(bytes);
  expect(graph.weights!.get("__nope__")).toBeUndefined();
});
