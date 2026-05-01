import { test, expect } from "bun:test";
import { parseKeras } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";
import { zipSync } from "fflate";

function makeKerasZip(files: Record<string, unknown>): Uint8Array {
  const enc = new TextEncoder();
  const zipped: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipped[name] = enc.encode(typeof content === "string" ? content : JSON.stringify(content));
  }
  return zipSync(zipped);
}

test("parseKeras throws ParseError on garbage bytes", () => {
  expect(() => parseKeras(new Uint8Array([0x00, 0x01, 0x02]))).toThrow(ParseError);
});

test("parseKeras throws ParseError when config.json is missing", () => {
  const zip = makeKerasZip({ "metadata.json": "{}" });
  expect(() => parseKeras(zip)).toThrow(ParseError);
});

test("parseKeras throws ParseError when config.json contains invalid JSON", () => {
  const zip = makeKerasZip({ "config.json": "not json {{{" });
  expect(() => parseKeras(zip)).toThrow(ParseError);
});

test("parseKeras throws ParseError for unsupported model class", () => {
  const zip = makeKerasZip({
    "config.json": { class_name: "MyCustomModel", config: { name: "x", layers: [] } },
  });
  expect(() => parseKeras(zip)).toThrow(ParseError);
});

const SEQ_CONFIG = {
  class_name: "Sequential",
  config: {
    name: "clf",
    trainable: true,
    layers: [
      {
        class_name: "InputLayer",
        config: { name: "input_layer", batch_shape: [null, 784], dtype: "float32" },
        inbound_nodes: [],
      },
      {
        class_name: "Dense",
        config: {
          name: "dense",
          units: 128,
          activation: "relu",
          use_bias: true,
          trainable: true,
          dtype: "float32",
        },
        inbound_nodes: [],
      },
      {
        class_name: "Dense",
        config: {
          name: "output",
          units: 10,
          activation: "softmax",
          use_bias: true,
          trainable: true,
          dtype: "float32",
        },
        inbound_nodes: [],
      },
    ],
  },
};

test("sequential: node count excludes InputLayer", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.nodes.length).toBe(2);
});

test("sequential: graph has one input", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].name).toBe("input_layer");
  expect(graph.inputs[0].shape).toEqual([-1, 784]);
  expect(graph.inputs[0].dtype).toBe("float32");
});

test("sequential: graph has one output", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.outputs.length).toBe(1);
  expect(graph.outputs[0].name).toBe("output");
});

test("sequential: opTypes match class_name", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.nodes[0].opType).toBe("Dense");
  expect(graph.nodes[1].opType).toBe("Dense");
});

test("sequential: nodes are chained via synthetic tensor names", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  // first Dense reads InputLayer's output
  expect(graph.nodes[0].inputs[0]).toBe("input_layer");
  // second Dense reads first Dense's output
  expect(graph.nodes[1].inputs[0]).toBe("dense");
  expect(graph.nodes[0].outputs[0]).toBe("dense");
  expect(graph.nodes[1].outputs[0]).toBe("output");
});

test("sequential: attributes include units and activation, exclude name/dtype/trainable", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  const attrs = graph.nodes[0].attributes;
  expect(attrs["units"]).toBe(128);
  expect(attrs["activation"]).toBe("relu");
  expect(attrs["name"]).toBeUndefined();
  expect(attrs["dtype"]).toBeUndefined();
  expect(attrs["trainable"]).toBeUndefined();
});

test("sequential: model name from config", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.name).toBe("clf");
});

const FUNC_CONFIG = {
  class_name: "Functional",
  config: {
    name: "encoder",
    trainable: true,
    layers: [
      {
        class_name: "InputLayer",
        config: { name: "img", batch_shape: [null, 224, 224, 3], dtype: "float32" },
        inbound_nodes: [],
      },
      {
        class_name: "Conv2D",
        config: {
          name: "conv2d",
          filters: 64,
          kernel_size: [3, 3],
          padding: "same",
          activation: "relu",
          trainable: true,
          dtype: "float32",
        },
        inbound_nodes: [{ args: [{ keras_history: ["img", 0, 0] }], kwargs: {} }],
      },
      {
        class_name: "Flatten",
        config: { name: "flatten", trainable: true, dtype: "float32" },
        inbound_nodes: [{ args: [{ keras_history: ["conv2d", 0, 0] }], kwargs: {} }],
      },
    ],
  },
};

test("functional: node count excludes InputLayer", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": FUNC_CONFIG }));
  expect(graph.nodes.length).toBe(2);
});

test("functional: input from InputLayer config", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": FUNC_CONFIG }));
  expect(graph.inputs[0].name).toBe("img");
  expect(graph.inputs[0].shape).toEqual([-1, 224, 224, 3]);
  expect(graph.inputs[0].dtype).toBe("float32");
});

test("functional: edges resolved via inbound_nodes", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": FUNC_CONFIG }));
  expect(graph.nodes[0].inputs[0]).toBe("img"); // Conv2D ← InputLayer
  expect(graph.nodes[1].inputs[0]).toBe("conv2d"); // Flatten ← Conv2D
});

test("functional: last layer output is graph output", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": FUNC_CONFIG }));
  expect(graph.outputs.length).toBe(1);
  expect(graph.outputs[0].name).toBe("flatten");
});

// Merge layer: Concatenate takes two inputs
const MERGE_CONFIG = {
  class_name: "Functional",
  config: {
    name: "merger",
    trainable: true,
    layers: [
      {
        class_name: "InputLayer",
        config: { name: "a", batch_shape: [null, 32], dtype: "float32" },
        inbound_nodes: [],
      },
      {
        class_name: "InputLayer",
        config: { name: "b", batch_shape: [null, 32], dtype: "float32" },
        inbound_nodes: [],
      },
      {
        class_name: "Concatenate",
        config: { name: "concat", axis: -1, trainable: true, dtype: "float32" },
        inbound_nodes: [
          {
            args: [[{ keras_history: ["a", 0, 0] }, { keras_history: ["b", 0, 0] }]],
            kwargs: {},
          },
        ],
      },
    ],
  },
};

test("functional merge: Concatenate receives two inputs", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": MERGE_CONFIG }));
  const concat = graph.nodes.find((n) => n.name === "concat")!;
  expect(concat.inputs).toEqual(["a", "b"]);
});

test("functional merge: two InputLayer entries in graph inputs", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": MERGE_CONFIG }));
  expect(graph.inputs.length).toBe(2);
});

test("functional merge: Concatenate axis attribute", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": MERGE_CONFIG }));
  const concat = graph.nodes.find((n) => n.name === "concat")!;
  expect(concat.attributes["axis"]).toBe(-1);
});

import { parseModel } from "@wetron/core";

test("parseModel: dispatches .keras bytes to parseKeras", async () => {
  const zip = makeKerasZip({ "config.json": SEQ_CONFIG });
  const graph = await parseModel(zip, "model.keras");
  expect(graph.nodes.length).toBe(2);
  expect(graph.name).toBe("clf");
});

import { readFileSync } from "fs";
import { resolve } from "path";

const MOBILENET_PATH = resolve(import.meta.dir, "../../../test-models/mobilenet.keras");

test("MobileNetV2: 155 nodes, correct input shape, single output", () => {
  const bytes = new Uint8Array(readFileSync(MOBILENET_PATH));
  const graph = parseKeras(bytes);
  expect(graph.name).toBe("mobilenetv2_1.00_224");
  expect(graph.nodes.length).toBe(155);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].shape).toEqual([-1, 224, 224, 3]);
  expect(graph.inputs[0].dtype).toBe("float32");
  expect(graph.outputs.length).toBe(1);
  expect(graph.outputs[0].name).toBe("predictions");
});

test("MobileNetV2: edges wired — first layer reads from graph input", () => {
  const bytes = new Uint8Array(readFileSync(MOBILENET_PATH));
  const graph = parseKeras(bytes);
  expect(graph.nodes[0].inputs[0]).toBe("input_layer");
});
