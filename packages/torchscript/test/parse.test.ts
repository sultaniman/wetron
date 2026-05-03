import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parseTorchscript } from "../src/parse.ts";

const MODEL = join(import.meta.dir, "../../../test-models/div_tensor.pt");
const MODEL_ZIP = join(import.meta.dir, "../../../test-models/mobilenet_v2.pt");

test("parseTorchscript: div_tensor.pt parses successfully", () => {
  const bytes = new Uint8Array(readFileSync(MODEL));
  const graph = parseTorchscript(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === "string" && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => n.opType !== undefined)).toBe(true);
});

test("parseTorchscript: rejects non-PTMF bytes", () => {
  expect(() => parseTorchscript(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow("PTMF");
});

test("parseTorchscript: ZIP-based mobilenet_v2.pt parses successfully", () => {
  if (!existsSync(MODEL_ZIP)) return; // optional fixture
  const bytes = new Uint8Array(readFileSync(MODEL_ZIP));
  const graph = parseTorchscript(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === "string" && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});
