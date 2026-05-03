import { test, expect } from "bun:test";
import { parseTflite } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mobilenet_v2.tflite", import.meta.url);

async function loadModel() {
  const buf = await Bun.file(MODEL_PATH).arrayBuffer();
  return new Uint8Array(buf);
}

test("mobilenet_v2: 66 nodes, 1 input (float32), initializers not in inputs", async () => {
  const graph = parseTflite(await loadModel());
  expect(graph.nodes.length).toBe(66);
  expect(graph.nodes.every((n) => n.opType.length > 0)).toBe(true);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].dtype).toBeTruthy();
  expect(graph.inputs[0].shape).not.toBeNull();
  expect(graph.outputs.length).toBe(1);
  expect(graph.initializers.size).toBeGreaterThan(0);
  for (const input of graph.inputs) expect(graph.initializers.has(input.name)).toBe(false);
});

test("throws ParseError on garbage input", () => {
  expect(() =>
    parseTflite(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00])),
  ).toThrow(ParseError);
});
