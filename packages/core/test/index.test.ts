import { test, expect } from "bun:test";
import { parseModel, detectFormat, ParseError } from "../src/index.ts";

const ONNX_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);
const TFLITE_PATH = new URL("../../../test-models/mobilenet_v2.tflite", import.meta.url);

test("parseModel parses an ONNX file", async () => {
  const buf = await Bun.file(ONNX_PATH).arrayBuffer();
  const graph = await parseModel(new Uint8Array(buf), "mnist-12.onnx");
  expect(graph.nodes.length).toBeGreaterThan(0);
});

test("parseModel parses a TFLite file", async () => {
  const buf = await Bun.file(TFLITE_PATH).arrayBuffer();
  const graph = await parseModel(new Uint8Array(buf), "mobilenet_v2.tflite");
  expect(graph.nodes.length).toBeGreaterThan(0);
});

test("parseModel throws ParseError on unknown format", async () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00]);
  await expect(parseModel(bytes, "model.bin")).rejects.toBeInstanceOf(ParseError);
});

test("re-exports detectFormat", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});
