import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseExecutorch } from "../src/parse.ts";

const MODEL = join(import.meta.dir, "../../../test-models/add.pte");

test("parseExecutorch: add.pte parses successfully", () => {
  const bytes = new Uint8Array(readFileSync(MODEL));
  const graph = parseExecutorch(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === "string" && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => n.opType !== undefined)).toBe(true);
});

test("parseExecutorch: rejects non-ET12 bytes", () => {
  expect(() => parseExecutorch(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow("ET12");
});
