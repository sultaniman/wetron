import { test, expect, describe } from "bun:test";
import { parseModel, detectFormat, filterGraph, ParseError } from "../src/index.ts";
import type { ModelGraph } from "../src/ir.ts";

test("parseModel throws ParseError on unknown format", async () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00]);
  await expect(parseModel(bytes, "model.bin")).rejects.toBeInstanceOf(ParseError);
});

test("re-exports detectFormat", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});

describe("filterGraph", () => {
  const graph = {
    name: "g",
    inputs: [],
    outputs: [],
    nodes: [
      { name: "conv1", opType: "Conv", inputs: [], outputs: [], attributes: {} },
      { name: "relu_1", opType: "Relu", inputs: [], outputs: [], attributes: {} },
      { name: "BatchNorm", opType: "BatchNormalization", inputs: [], outputs: [], attributes: {} },
    ],
    initializers: new Map(),
    tensorShapes: new Map(),
    fileSizeBytes: 0,
  } as unknown as ModelGraph;

  test("empty query returns empty set", () => {
    expect(filterGraph(graph, "").size).toBe(0);
  });

  test("whitespace-only query returns empty set", () => {
    expect(filterGraph(graph, "   ").size).toBe(0);
  });

  test("matches by opType (case-insensitive)", () => {
    expect(filterGraph(graph, "conv")).toEqual(new Set(["conv1"]));
    expect(filterGraph(graph, "RELU")).toEqual(new Set(["relu_1"]));
  });

  test("matches by node name", () => {
    expect(filterGraph(graph, "BatchNorm")).toEqual(new Set(["BatchNorm"]));
  });

  test("returns empty set when nothing matches", () => {
    expect(filterGraph(graph, "nope").size).toBe(0);
  });

  test("trims surrounding whitespace", () => {
    expect(filterGraph(graph, "  conv  ")).toEqual(new Set(["conv1"]));
  });
});

describe("parseModel dispatch", () => {
  const cases: Array<{ format: string; path: string }> = [
    { format: "onnx", path: "../../../test-models/mnist-12.onnx" },
    { format: "tflite", path: "../../../test-models/mobilenet_v2.tflite" },
    { format: "keras", path: "../../../test-models/mobilenet.keras" },
    { format: "savedmodel", path: "../../../test-models/small_saved_model.pb" },
    { format: "executorch", path: "../../../test-models/add.pte" },
    { format: "torchscript", path: "../../../test-models/div_tensor.pt" },
  ];

  for (const { format, path } of cases) {
    test(`routes ${format} to its parser`, async () => {
      const url = new URL(path, import.meta.url);
      const bytes = new Uint8Array(await Bun.file(url).arrayBuffer());
      const graph = await parseModel(bytes);
      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  }
});
