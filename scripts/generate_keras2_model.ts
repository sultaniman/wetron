// Synthetic Keras 2 Functional model with ~100 layers of mixed types,
// using the dict-style inbound_nodes format that wetron's parser must handle.
//
// Output: test-models/keras2_synthetic.keras

import { writeFileSync } from "fs";
import { resolve } from "path";
import { zipSync } from "fflate";

type Layer = {
  class_name: string;
  config: Record<string, unknown>;
  name: string;
  inbound_nodes: Array<Record<string, [string, number, number, Record<string, unknown>]>>;
};

const layers: Layer[] = [];

function add(
  class_name: string,
  name: string,
  parent: string | null,
  config: Record<string, unknown> = {},
): void {
  layers.push({
    class_name,
    name,
    config: { name, dtype: "float32", trainable: true, ...config },
    inbound_nodes:
      parent === null
        ? []
        : [{ inputs: [parent, 0, 0, {}] }],
  });
}

function addMerge(
  class_name: string,
  name: string,
  parents: string[],
  config: Record<string, unknown> = {},
): void {
  const inbound: Record<string, [string, number, number, Record<string, unknown>]> = {};
  parents.forEach((p, i) => {
    inbound[String(i)] = [p, 0, 0, {}];
  });
  layers.push({
    class_name,
    name,
    config: { name, dtype: "float32", trainable: true, ...config },
    inbound_nodes: [inbound],
  });
}

layers.push({
  class_name: "InputLayer",
  name: "input_1",
  config: {
    name: "input_1",
    dtype: "float32",
    batch_input_shape: [null, 32, 32, 3],
  },
  inbound_nodes: [],
});

let prev = "input_1";

const BLOCK_TYPES = [
  ["Conv2D", { filters: 32, kernel_size: [3, 3], padding: "same" }],
  ["BatchNormalization", { axis: -1, momentum: 0.99, epsilon: 0.001 }],
  ["Activation", { activation: "relu" }],
  ["Conv2D", { filters: 64, kernel_size: [3, 3], padding: "same" }],
  ["BatchNormalization", { axis: -1 }],
  ["Activation", { activation: "relu" }],
  ["MaxPooling2D", { pool_size: [2, 2] }],
  ["Dropout", { rate: 0.25 }],
] as const;

let counter = 0;

for (let block = 0; block < 11; block++) {
  for (const [cls, cfg] of BLOCK_TYPES) {
    const name = `${cls.toLowerCase()}_${counter++}`;
    add(cls, name, prev, cfg as Record<string, unknown>);
    prev = name;
  }
  if (block % 3 === 2) {
    const branchA = prev;
    const branchBName = `conv2d_branch_${block}`;
    add("Conv2D", branchBName, branchA, { filters: 64, kernel_size: [1, 1], padding: "same" });
    const mergeName = `add_${block}`;
    addMerge("Add", mergeName, [branchA, branchBName]);
    prev = mergeName;
  }
}

add("GlobalAveragePooling2D", "gap", prev);
prev = "gap";
add("Flatten", "flatten", prev);
prev = "flatten";
add("Dense", "dense_logits", prev, { units: 256, activation: "relu" });
prev = "dense_logits";
add("Dropout", "dropout_final", prev, { rate: 0.5 });
prev = "dropout_final";
add("Dense", "predictions", prev, { units: 10, activation: "softmax" });

const config = {
  class_name: "Functional",
  config: {
    name: "keras2_synthetic",
    trainable: true,
    layers,
    input_layers: [["input_1", 0, 0]],
    output_layers: [["predictions", 0, 0]],
  },
  keras_version: "2.13.1",
  backend: "tensorflow",
};

const out = zipSync({
  "config.json": new TextEncoder().encode(JSON.stringify(config, null, 2)),
  "metadata.json": new TextEncoder().encode(
    JSON.stringify({ keras_version: "2.13.1", date_saved: "2026-05-27" }),
  ),
});

const dest = resolve(import.meta.dir, "..", "test-models", "keras2_synthetic.keras");
writeFileSync(dest, out);
console.log(`wrote ${dest} — ${layers.length} layers`);
