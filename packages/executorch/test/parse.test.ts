import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExecutorch } from "../src/parse.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL = join(__dirname, "../../../test-models/add.pte");

test("parseExecutorch: add.pte parses successfully", () => {
  const bytes = new Uint8Array(readFileSync(MODEL));
  const graph = parseExecutorch(bytes);

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => typeof n.opType === "string" && n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});

test("parseExecutorch: rejects non-ET12 bytes", () => {
  expect(() => parseExecutorch(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow("ET12");
});
