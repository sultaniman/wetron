// Synthetic Keras 2 + Keras 3 .keras fixtures with:
//   - root Functional containing 3 nested Functional sub-models (sub-graphs)
//   - real weight tensors in model.weights.h5 (vars/N per layer)
//   - realistic topology: shared feature extractor feeding two heads
//
// Outputs:
//   test-models/keras3_with_subgraphs.keras   (Keras 3 inbound_nodes format)
//   test-models/keras2_with_subgraphs.keras   (Keras 2 dict-format inbound_nodes)

import { writeFileSync } from "fs";
import { resolve } from "path";
import { zipSync } from "fflate";
import h5wasm from "h5wasm";

type Format = "keras2" | "keras3";

type InboundV = unknown[]; // a single inbound_nodes entry as serialized

type LayerEntry = {
  class_name: string;
  config: Record<string, unknown>;
  name: string;
  inbound_nodes: InboundV;
};

function inboundFor(format: Format, parents: string[]): InboundV {
  if (parents.length === 0) return [];
  if (format === "keras3") {
    // single call: args is [tensorRef] for one input, [[tensorRef, ...]] for merges
    if (parents.length === 1) {
      const ref = { class_name: "__keras_tensor__", config: { keras_history: [parents[0], 0, 0] } };
      return [{ args: [ref], kwargs: {} }];
    }
    const refs = parents.map((p) => ({
      class_name: "__keras_tensor__",
      config: { keras_history: [p, 0, 0] },
    }));
    return [{ args: [refs], kwargs: {} }];
  }
  // keras2 dict format
  const dict: Record<string, [string, number, number, Record<string, unknown>]> = {};
  parents.forEach((p, i) => {
    dict[String(i)] = [p, 0, 0, {}];
  });
  return [dict];
}

type WeightSpec = { class_name: string; shapes: number[][] };

const WEIGHT_SPECS: Record<string, (cfg: Record<string, unknown>) => number[][]> = {
  Conv2D: (cfg) => {
    const k = cfg["kernel_size"] as [number, number];
    const f = cfg["filters"] as number;
    const inCh = (cfg["_in_channels"] as number) ?? 3;
    return [
      [k[0], k[1], inCh, f], // kernel
      [f], // bias
    ];
  },
  Dense: (cfg) => {
    const units = cfg["units"] as number;
    const inUnits = (cfg["_in_units"] as number) ?? 128;
    return [
      [inUnits, units],
      [units],
    ];
  },
  BatchNormalization: (cfg) => {
    const axis = (cfg["_channels"] as number) ?? 32;
    return [[axis], [axis], [axis], [axis]]; // gamma, beta, moving_mean, moving_var
  },
};

function buildSubFunctional(
  format: Format,
  name: string,
  inputShape: number[],
  spec: Array<{ cls: string; name: string; cfg?: Record<string, unknown> }>,
): {
  config: Record<string, unknown>;
  weightLayers: Array<{ snakeKey: string; varShapes: number[][] }>;
} {
  const layers: LayerEntry[] = [];
  layers.push({
    class_name: "InputLayer",
    name: `${name}_input`,
    config: {
      name: `${name}_input`,
      dtype: "float32",
      batch_shape: inputShape,
      batch_input_shape: inputShape,
    },
    inbound_nodes: [],
  });

  let prev = `${name}_input`;
  const weightLayers: Array<{ snakeKey: string; varShapes: number[][] }> = [];
  const classCount = new Map<string, number>();

  for (const layer of spec) {
    const cfg = { name: layer.name, dtype: "float32", trainable: true, ...(layer.cfg ?? {}) };
    layers.push({
      class_name: layer.cls,
      name: layer.name,
      config: cfg,
      inbound_nodes: inboundFor(format, [prev]),
    });

    const wfn = WEIGHT_SPECS[layer.cls];
    if (wfn) {
      const snake = kerasSnakeCase(layer.cls);
      const n = classCount.get(snake) ?? 0;
      classCount.set(snake, n + 1);
      const snakeKey = n === 0 ? snake : `${snake}_${n}`;
      weightLayers.push({ snakeKey, varShapes: wfn(cfg) });
    }
    prev = layer.name;
  }

  const config = {
    class_name: "Functional",
    config: {
      name,
      trainable: true,
      layers,
      input_layers: [[`${name}_input`, 0, 0]],
      output_layers: [[prev, 0, 0]],
    },
  };
  return { config, weightLayers };
}

function kerasSnakeCase(s: string): string {
  return s.replace(/(.)([A-Z][a-z]+)/g, "$1_$2").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

async function writeH5(
  h5wasmModule: { File: new (p: string, m: string) => any; FS: any },
  subModels: Array<{ weightLayers: Array<{ snakeKey: string; varShapes: number[][] }> }>,
): Promise<Uint8Array> {
  const { File, FS } = h5wasmModule;
  const tmp = `/wetron_gen_${Date.now()}.h5`;
  FS.writeFile(tmp, new Uint8Array());
  const f = new File(tmp, "w");

  const root = f.create_group("layers");
  subModels.forEach((sub, idx) => {
    const fkey = idx === 0 ? "functional" : `functional_${idx}`;
    const subGroup = root.create_group(fkey);
    const layersGroup = subGroup.create_group("layers");
    for (const wl of sub.weightLayers) {
      const layerGroup = layersGroup.create_group(wl.snakeKey);
      const vars = layerGroup.create_group("vars");
      wl.varShapes.forEach((shape, vidx) => {
        const total = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(total);
        // deterministic synthetic values so tests can assert content
        for (let i = 0; i < total; i++) data[i] = (i * 0.01) % 1;
        vars.create_dataset({
          name: String(vidx),
          data,
          shape,
          dtype: "<f4",
        });
      });
    }
  });

  f.flush();
  f.close();
  const bytes = FS.readFile(tmp);
  FS.unlink(tmp);
  return new Uint8Array(bytes);
}

function buildRootFunctional(
  format: Format,
  rootName: string,
  subs: Array<{ name: string; config: Record<string, unknown> }>,
): Record<string, unknown> {
  const layers: LayerEntry[] = [];
  layers.push({
    class_name: "InputLayer",
    name: "input_1",
    config: {
      name: "input_1",
      dtype: "float32",
      batch_shape: [null, 32, 32, 3],
      batch_input_shape: [null, 32, 32, 3],
    },
    inbound_nodes: [],
  });

  // feature_extractor consumes input_1; classifier and regression both consume feature_extractor
  const featureName = subs[0].name;
  const classifierName = subs[1].name;
  const regressionName = subs[2].name;

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const parent = i === 0 ? "input_1" : featureName;
    layers.push({
      class_name: "Functional",
      name: sub.name,
      config: (sub.config as { config: Record<string, unknown> }).config,
      inbound_nodes: inboundFor(format, [parent]),
    });
  }

  return {
    class_name: "Functional",
    config: {
      name: rootName,
      trainable: true,
      layers,
      input_layers: [["input_1", 0, 0]],
      output_layers: [
        [classifierName, 0, 0],
        [regressionName, 0, 0],
      ],
    },
  };
}

async function generate(format: Format, outName: string): Promise<void> {
  const featureExtractor = buildSubFunctional(format, "feature_extractor", [null as unknown as number, 32, 32, 3], [
    { cls: "Conv2D", name: "fe_conv1", cfg: { filters: 32, kernel_size: [3, 3], padding: "same", _in_channels: 3 } },
    { cls: "BatchNormalization", name: "fe_bn1", cfg: { axis: -1, momentum: 0.99, epsilon: 0.001, _channels: 32 } },
    { cls: "Activation", name: "fe_relu1", cfg: { activation: "relu" } },
    { cls: "Conv2D", name: "fe_conv2", cfg: { filters: 64, kernel_size: [3, 3], padding: "same", _in_channels: 32 } },
    { cls: "BatchNormalization", name: "fe_bn2", cfg: { axis: -1, _channels: 64 } },
    { cls: "Activation", name: "fe_relu2", cfg: { activation: "relu" } },
    { cls: "MaxPooling2D", name: "fe_pool", cfg: { pool_size: [2, 2] } },
    { cls: "Conv2D", name: "fe_conv3", cfg: { filters: 128, kernel_size: [3, 3], padding: "same", _in_channels: 64 } },
    { cls: "BatchNormalization", name: "fe_bn3", cfg: { axis: -1, _channels: 128 } },
    { cls: "Activation", name: "fe_relu3", cfg: { activation: "relu" } },
    { cls: "GlobalAveragePooling2D", name: "fe_gap" },
  ]);

  const classifier = buildSubFunctional(format, "classifier", [null as unknown as number, 128], [
    { cls: "Dense", name: "cl_dense1", cfg: { units: 64, activation: "relu", _in_units: 128 } },
    { cls: "Dropout", name: "cl_drop1", cfg: { rate: 0.5 } },
    { cls: "Dense", name: "cl_dense2", cfg: { units: 10, activation: "softmax", _in_units: 64 } },
  ]);

  const regression = buildSubFunctional(format, "regression", [null as unknown as number, 128], [
    { cls: "Dense", name: "rg_dense1", cfg: { units: 32, activation: "relu", _in_units: 128 } },
    { cls: "Dense", name: "rg_dense2", cfg: { units: 1, _in_units: 32 } },
  ]);

  const root = buildRootFunctional(format, "branched_net", [
    { name: "feature_extractor", config: featureExtractor.config },
    { name: "classifier", config: classifier.config },
    { name: "regression", config: regression.config },
  ]);

  const config = {
    ...root,
    keras_version: format === "keras3" ? "3.4.1" : "2.13.1",
    backend: "tensorflow",
  };

  const h5wasmModule = await (async () => {
    const Module = await h5wasm.ready;
    return {
      File: (h5wasm as unknown as { File: unknown }).File as new (p: string, m: string) => any,
      FS: (Module as unknown as { FS: any }).FS,
    };
  })();

  const h5Bytes = await writeH5(h5wasmModule, [featureExtractor, classifier, regression]);

  const zipped = zipSync({
    "config.json": new TextEncoder().encode(JSON.stringify(config, null, 2)),
    "metadata.json": new TextEncoder().encode(
      JSON.stringify({ keras_version: config.keras_version, date_saved: "2026-05-27" }),
    ),
    "model.weights.h5": h5Bytes,
  });

  const dest = resolve(import.meta.dir, "..", "test-models", outName);
  writeFileSync(dest, zipped);
  console.log(
    `wrote ${dest} — h5=${h5Bytes.length}b, zip=${zipped.length}b`,
  );
}

await generate("keras3", "keras3_with_subgraphs.keras");
await generate("keras2", "keras2_with_subgraphs.keras");
