import { test, expect } from "vitest";
import { parseKeras, parseKerasWithWeights } from "../src/parse.ts";
import { ParseError } from "@wetron/common/ir";
import { zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeKerasZip(files: Record<string, unknown>): Uint8Array {
  const enc = new TextEncoder();
  const zipped: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipped[name] = enc.encode(typeof content === "string" ? content : JSON.stringify(content));
  }
  return zipSync(zipped);
}

test("throws ParseError on garbage, missing config.json, invalid JSON, unsupported class", () => {
  expect(() => parseKeras(new Uint8Array([0x00, 0x01, 0x02]))).toThrow(ParseError);
  expect(() => parseKeras(makeKerasZip({ "metadata.json": "{}" }))).toThrow(ParseError);
  expect(() => parseKeras(makeKerasZip({ "config.json": "not json {{{" }))).toThrow(ParseError);
  expect(() =>
    parseKeras(
      makeKerasZip({
        "config.json": { class_name: "MyCustomModel", config: { name: "x", layers: [] } },
      }),
    ),
  ).toThrow(ParseError);
});

test("parseKerasWithWeights warns when model.weights.h5 cannot be loaded", async () => {
  const graph = await parseKerasWithWeights(
    makeKerasZip({
      "config.json": SEQ_CONFIG,
      "model.weights.h5": "not an HDF5 file",
    }),
  );

  expect(graph.nodes.length).toBe(2);
  expect(graph.weights).toBeUndefined();
  expect(graph.warnings).toEqual([expect.objectContaining({ code: "keras-weight-load-failed" })]);
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

test("sequential: 2 nodes chained, input shape, attributes filtered", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": SEQ_CONFIG }));
  expect(graph.name).toBe("clf");
  expect(graph.nodes.length).toBe(2);
  expect(graph.inputs[0].shape).toEqual([-1, 784]);
  expect(graph.nodes[0].inputs[0]).toBe("input_layer");
  expect(graph.nodes[1].inputs[0]).toBe("dense");
  expect(graph.nodes[0].attributes["units"]).toBe(128);
  expect(graph.nodes[0].attributes["name"]).toBeUndefined();
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

test("functional: edges resolved via inbound_nodes", () => {
  const graph = parseKeras(makeKerasZip({ "config.json": FUNC_CONFIG }));
  expect(graph.nodes.length).toBe(2);
  expect(graph.nodes[0].inputs[0]).toBe("img");
  expect(graph.nodes[1].inputs[0]).toBe("conv2d");
});

test("functional merge: Concatenate receives two inputs from two InputLayers", () => {
  const config = {
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
  const graph = parseKeras(makeKerasZip({ "config.json": config }));
  const concat = graph.nodes.find((n) => n.name === "concat")!;
  expect(concat.inputs).toEqual(["a", "b"]);
  expect(graph.inputs.length).toBe(2);
});

test("MobileNetV2: 155 nodes, correct input, single output", () => {
  const bytes = new Uint8Array(
    readFileSync(resolve(__dirname, "../../../test-models/mobilenet.keras")),
  );
  const graph = parseKeras(bytes);
  expect(graph.name).toBe("mobilenetv2_1.00_224");
  expect(graph.nodes.length).toBe(155);
  expect(graph.inputs[0].shape).toEqual([-1, 224, 224, 3]);
  expect(graph.nodes[0].inputs[0]).toBe("input_layer");
});

for (const [label, fixture] of [
  ["Keras 3", "keras3_with_subgraphs"],
  ["Keras 2", "keras2_with_subgraphs"],
] as const) {
  test(`${label} fixture: structure has 3 Functional sub-graphs`, () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(__dirname, "../../../test-models/", `${fixture}.keras`)),
    );
    const g = parseKeras(bytes);
    expect(g.name).toBe("branched_net");
    expect(g.nodes.length).toBe(3);
    expect(g.warnings ?? []).toEqual([]);

    const fe = g.nodes.find((n) => n.name === "feature_extractor")!;
    const cl = g.nodes.find((n) => n.name === "classifier")!;
    const rg = g.nodes.find((n) => n.name === "regression")!;
    expect(fe.opType).toBe("Functional");
    expect(cl.opType).toBe("Functional");
    expect(rg.opType).toBe("Functional");
    expect(fe.subGraph?.nodes.length).toBe(11);
    expect(cl.subGraph?.nodes.length).toBe(3);
    expect(rg.subGraph?.nodes.length).toBe(2);

    expect(fe.inputs).toEqual(["input_1"]);
    expect(cl.inputs).toEqual(["feature_extractor"]);
    expect(rg.inputs).toEqual(["feature_extractor"]);
  });

  test(`${label} fixture: parseKerasWithWeights loads tensors into sub-graphs`, async () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(__dirname, "../../../test-models/", `${fixture}.keras`)),
    );
    const g = await parseKerasWithWeights(bytes);
    expect(g.weights).toBeDefined();
    expect(g.initializers.size).toBe(26);

    const fe = g.nodes.find((n) => n.name === "feature_extractor")!.subGraph!;
    expect(fe.initializers.size).toBe(18);
    const conv1 = fe.nodes.find((n) => n.name === "fe_conv1")!;
    expect(conv1.inputs.length).toBeGreaterThan(1);
    const kernelKey = conv1.inputs.find((k) => fe.initializers.has(k))!;
    expect(fe.initializers.get(kernelKey)).toEqual({ shape: [3, 3, 3, 32], dtype: "float32" });
  });
}

test("Keras 2 dict-format inbound_nodes: 99 nodes, merge edges resolve", () => {
  const bytes = new Uint8Array(
    readFileSync(resolve(__dirname, "../../../test-models/keras2_synthetic.keras")),
  );
  const graph = parseKeras(bytes);
  expect(graph.name).toBe("keras2_synthetic");
  expect(graph.nodes.length).toBe(99);
  expect(graph.inputs.length).toBe(1);
  expect(graph.inputs[0].name).toBe("input_1");
  expect(graph.outputs.map((o) => o.name)).toEqual(["predictions"]);
  expect(graph.warnings ?? []).toEqual([]);
  expect(graph.nodes[0].inputs[0]).toBe("input_1");

  const merges = graph.nodes.filter((n) => n.opType === "Add");
  expect(merges.length).toBe(3);
  for (const m of merges) {
    expect(m.inputs.length).toBe(2);
  }
});
