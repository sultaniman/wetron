import { test, expect } from "bun:test";
import { parseTflite } from "../src/index.ts";
import { readFileSync } from "node:fs";

test("TFLite parse exposes weight bytes for initializers", () => {
  const bytes = new Uint8Array(readFileSync("test-models/mobilenet_v2.tflite"));
  const graph = parseTflite(bytes);

  expect(graph.fileSizeBytes).toBe(bytes.byteLength);
  expect(graph.weights).toBeDefined();
  expect(graph.weights!.totalBytes).toBeGreaterThan(0);

  const firstName = [...graph.initializers.keys()][0];
  expect(firstName).toBeDefined();
  const out = graph.weights!.get(firstName);
  expect(out).toBeInstanceOf(Uint8Array);
  expect(out!.byteLength).toBeGreaterThan(0);
});

test("TFLite weights.get returns undefined for unknown name", () => {
  const bytes = new Uint8Array(readFileSync("test-models/mobilenet_v2.tflite"));
  const graph = parseTflite(bytes);
  expect(graph.weights!.get("__nope__")).toBeUndefined();
});
