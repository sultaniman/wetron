# Keras Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `@wetron/keras` parser package that reads `.keras` (Keras 3 ZIP format) files and produces a `ModelGraph`, wired into the existing `parseModel` dispatcher.

**Architecture:** The `.keras` file is a ZIP archive - extract `config.json` with `fflate`, then walk the layer list to build wetron IR. Sequential models are a linear chain; Functional models use each layer's `inbound_nodes` to reconstruct the DAG. Subclassed models (no serializable config) are out of scope.

**Tech Stack:** TypeScript, Bun workspaces, `bun test`, `fflate` (ZIP extraction), `@wetron/core` IR types.

---

## Codebase context

### Monorepo layout

```
wetron/
  packages/
    core/src/
      ir.ts          ← ModelGraph, GraphNode, GraphValue, AttributeValue, ParseError
      detect.ts      ← detectFormat(bytes, filename?) -> Format
      categories.ts  ← opCategory(opType) -> OpCategory  (CATEGORY_MAP Record)
      index.ts       ← parseModel(bytes, filename?) entry point
    onnx/src/parse.ts   ← reference: async parseOnnx(bytes)
    tflite/src/parse.ts ← reference: sync parseTflite(bytes)
    keras/             ← NEW package (this plan)
  apps/demo/src/App.tsx ← file input accept attribute
  test-models/          ← .onnx, .tflite fixtures live here
```

### Key types (packages/core/src/ir.ts)

```ts
type AttributeValue = string | number | boolean | readonly number[] | readonly string[];

interface GraphValue {
  name: string;
  shape: readonly number[] | null;
  dtype: string | null;
}
interface GraphNode {
  name: string;
  opType: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
}
interface ModelGraph {
  name: string;
  inputs: readonly GraphValue[];
  outputs: readonly GraphValue[];
  nodes: readonly GraphNode[];
}

class ParseError extends Error {
  constructor(format: string, context: string);
}
```

### Existing detect.ts (packages/core/src/detect.ts)

```ts
export type Format = "onnx" | "tflite" | "unknown";

export function detectFormat(bytes: Uint8Array, filename?: string): Format {
  if (bytes.length >= 8) {
    if (bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33)
      return "tflite"; // TFL3
    if (bytes[4] === 0x4f && bytes[5] === 0x44 && bytes[6] === 0x4c && bytes[7] === 0x46)
      return "tflite"; // ODLF
  }
  if (bytes.length > 0 && bytes[0] === 0x08) return "onnx";
  if (filename?.endsWith(".onnx")) return "onnx";
  if (filename?.endsWith(".tflite")) return "tflite";
  return "unknown";
}
```

### Existing parseModel (packages/core/src/index.ts)

```ts
export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  if (format === "onnx") {
    const { parseOnnx } = await import("@wetron/onnx");
    return parseOnnx(bytes);
  }
  if (format === "tflite") {
    const { parseTflite } = await import("@wetron/tflite");
    return parseTflite(bytes);
  }
  throw new ParseError("unknown", `Cannot detect format...`);
}
```

### Existing categories.ts structure (packages/core/src/categories.ts)

```ts
const CATEGORY_MAP: Record<string, OpCategory> = {
  // ONNX PascalCase entries …
  Conv: "conv",
  Relu: "activation",
  BatchNormalization: "normalization" /* … */,
  // TFLite UPPER_SNAKE_CASE entries …
  CONV_2D: "conv",
  RELU: "activation" /* … */,
};
export function opCategory(opType: string): OpCategory {
  return CATEGORY_MAP[opType] ?? "unknown";
}
```

### .keras ZIP structure

A `.keras` file is a standard ZIP archive containing:

- **`config.json`** - JSON model architecture (the only file we need)
- `model.weights.h5` - binary weights (ignored)
- `metadata.json` - version metadata (ignored)

### config.json format (Keras 3)

**Sequential model:**

```json
{
  "class_name": "Sequential",
  "config": {
    "name": "my_model",
    "trainable": true,
    "layers": [
      {
        "class_name": "InputLayer",
        "config": { "name": "input_layer", "batch_shape": [null, 784], "dtype": "float32" },
        "inbound_nodes": []
      },
      {
        "class_name": "Dense",
        "config": {
          "name": "dense",
          "units": 128,
          "activation": "relu",
          "use_bias": true,
          "trainable": true,
          "dtype": "float32"
        },
        "inbound_nodes": []
      },
      {
        "class_name": "Dense",
        "config": {
          "name": "output",
          "units": 10,
          "activation": "softmax",
          "use_bias": true,
          "trainable": true,
          "dtype": "float32"
        },
        "inbound_nodes": []
      }
    ]
  }
}
```

Sequential `inbound_nodes` are always `[]`; connectivity comes from layer order.

**Functional model:**

```json
{
  "class_name": "Functional",
  "config": {
    "name": "encoder",
    "trainable": true,
    "layers": [
      {
        "class_name": "InputLayer",
        "config": { "name": "img", "batch_shape": [null, 224, 224, 3], "dtype": "float32" },
        "inbound_nodes": []
      },
      {
        "class_name": "Conv2D",
        "config": {
          "name": "conv2d",
          "filters": 64,
          "kernel_size": [3, 3],
          "strides": [1, 1],
          "padding": "same",
          "activation": "relu",
          "use_bias": true,
          "trainable": true,
          "dtype": "float32"
        },
        "inbound_nodes": [{ "args": [{ "keras_history": ["img", 0, 0] }], "kwargs": {} }]
      }
    ]
  }
}
```

**Merge layer (multiple inputs):**

```json
{
  "class_name": "Concatenate",
  "config": { "name": "concat", "axis": -1, "trainable": true, "dtype": "float32" },
  "inbound_nodes": [
    {
      "args": [[{ "keras_history": ["branch_a", 0, 0] }, { "keras_history": ["branch_b", 0, 0] }]],
      "kwargs": {}
    }
  ]
}
```

`inbound_nodes[0].args[0]` is:

- An **object** `{ keras_history: [name, nodeIdx, tensorIdx] }` -> single input
- An **array** of such objects -> multiple inputs (merge layers)

### Tensor naming convention

Keras config doesn't assign explicit tensor names like ONNX does. We synthesise them:

- Each layer's output tensor: `{layerName}/output`
- InputLayer's output `{layerName}/output` becomes a graph input tensor name

---

## File structure

| File                                | Action | Responsibility                                       |
| ----------------------------------- | ------ | ---------------------------------------------------- |
| `packages/keras/package.json`       | Create | Package metadata, `fflate` dep                       |
| `packages/keras/tsconfig.json`      | Create | Extends root tsconfig                                |
| `packages/keras/src/index.ts`       | Create | Re-export `parseKeras`                               |
| `packages/keras/src/parse.ts`       | Create | ZIP extraction + Sequential + Functional IR builders |
| `packages/keras/test/parse.test.ts` | Create | All tests for the package                            |
| `packages/core/src/detect.ts`       | Modify | Add `'keras'` to `Format`, add ZIP magic bytes check |
| `packages/core/src/categories.ts`   | Modify | Add ~45 Keras `class_name` -> `OpCategory` entries   |
| `packages/core/src/index.ts`        | Modify | Add `parseKeras` branch in `parseModel`              |
| `apps/demo/src/App.tsx`             | Modify | Add `.keras` to file `accept` attribute              |

---

## Task 1: Package scaffold

**Files:**

- Create: `packages/keras/package.json`
- Create: `packages/keras/tsconfig.json`
- Create: `packages/keras/src/index.ts`
- Create: `packages/keras/src/parse.ts`
- Create: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/keras/test/parse.test.ts
import { test, expect } from "bun:test";
import { parseKeras } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

test("parseKeras throws ParseError on garbage bytes", () => {
  expect(() => parseKeras(new Uint8Array([0x00, 0x01, 0x02]))).toThrow(ParseError);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test packages/keras
```

Expected: error - `Cannot find module '../src/parse.ts'`

- [ ] **Step 3: Create package files**

```json
// packages/keras/package.json
{
  "name": "@wetron/keras",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*",
    "fflate": "^0.8.2"
  }
}
```

```json
// packages/keras/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

```ts
// packages/keras/src/index.ts
export { parseKeras } from "./parse.ts";
```

```ts
// packages/keras/src/parse.ts
import type { ModelGraph } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";

export function parseKeras(_bytes: Uint8Array): ModelGraph {
  throw new ParseError("keras", "Not implemented");
}
```

- [ ] **Step 4: Install fflate**

```bash
bun add fflate --cwd packages/keras
```

- [ ] **Step 5: Run test - expect it to pass**

```bash
bun test packages/keras
```

Expected: 1 pass

- [ ] **Step 6: Commit**

```bash
git add packages/keras/package.json packages/keras/tsconfig.json packages/keras/src/index.ts packages/keras/src/parse.ts packages/keras/test/parse.test.ts
git commit -m "feat(@wetron/keras): scaffold package with stub parseKeras"
```

---

## Task 2: ZIP extraction and config parsing

**Files:**

- Modify: `packages/keras/src/parse.ts`
- Modify: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Add tests for ZIP and JSON parsing**

Append to `packages/keras/test/parse.test.ts`:

```ts
import { zipSync } from "fflate";

function makeKerasZip(files: Record<string, unknown>): Uint8Array {
  const enc = new TextEncoder();
  const zipped: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipped[name] = enc.encode(typeof content === "string" ? content : JSON.stringify(content));
  }
  return zipSync(zipped);
}

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/keras
```

Expected: 3 fail (parseKeras throws ParseError on garbage is still 1 pass)

- [ ] **Step 3: Implement ZIP extraction in parse.ts**

Replace `packages/keras/src/parse.ts` with:

```ts
import { unzipSync } from "fflate";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";

type KerasInboundNode = {
  args: unknown[];
  kwargs: Record<string, unknown>;
};

type KerasLayerEntry = {
  class_name: string;
  config: Record<string, unknown>;
  inbound_nodes: KerasInboundNode[];
};

type KerasModelConfig = {
  class_name: string;
  config: {
    name: string;
    layers: KerasLayerEntry[];
  };
};

const SKIP_CONFIG_KEYS = new Set([
  "name",
  "dtype",
  "trainable",
  "batch_input_shape",
  "batch_shape",
]);

function extractAttributes(config: Record<string, unknown>): Record<string, AttributeValue> {
  const result: Record<string, AttributeValue> = {};
  for (const [key, val] of Object.entries(config)) {
    if (SKIP_CONFIG_KEYS.has(key)) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    } else if (Array.isArray(val) && val.length > 0) {
      if (val.every((v): v is number => typeof v === "number")) result[key] = val;
      else if (val.every((v): v is string => typeof v === "string")) result[key] = val;
    }
  }
  return result;
}

function buildSequential(_model: KerasModelConfig): ModelGraph {
  throw new ParseError("keras", "Sequential not implemented");
}

function buildFunctional(_model: KerasModelConfig): ModelGraph {
  throw new ParseError("keras", "Functional not implemented");
}

export function parseKeras(bytes: Uint8Array): ModelGraph {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new ParseError(
      "keras",
      `ZIP extraction failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const configBytes = files["config.json"];
  if (!configBytes) throw new ParseError("keras", "config.json not found in .keras archive");

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(configBytes));
  } catch (e) {
    throw new ParseError(
      "keras",
      `config.json parse failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const model = raw as KerasModelConfig;
  if (!model?.config?.layers) throw new ParseError("keras", "config.json missing config.layers");

  if (model.class_name === "Sequential") return buildSequential(model);
  if (model.class_name === "Functional") return buildFunctional(model);
  throw new ParseError("keras", `Unsupported model class: ${model.class_name}`);
}
```

- [ ] **Step 4: Run tests - all 4 should pass**

```bash
bun test packages/keras
```

Expected: 4 pass

- [ ] **Step 5: Commit**

```bash
git add packages/keras/src/parse.ts packages/keras/test/parse.test.ts
git commit -m "feat(@wetron/keras): ZIP extraction and config.json parsing"
```

---

## Task 3: Sequential model IR

**Files:**

- Modify: `packages/keras/src/parse.ts` (implement `buildSequential`)
- Modify: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Add Sequential model tests**

The test uses the `makeKerasZip` helper already defined in Task 2.

Append to `packages/keras/test/parse.test.ts`:

```ts
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
  expect(graph.nodes[0].inputs[0]).toBe("input_layer/output");
  // second Dense reads first Dense's output
  expect(graph.nodes[1].inputs[0]).toBe("dense/output");
  expect(graph.nodes[0].outputs[0]).toBe("dense/output");
  expect(graph.nodes[1].outputs[0]).toBe("output/output");
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
```

- [ ] **Step 2: Run tests to verify 6 new tests fail**

```bash
bun test packages/keras
```

Expected: 4 pass, 6 fail (buildSequential throws ParseError)

- [ ] **Step 3: Implement buildSequential in parse.ts**

Replace the stub `buildSequential` function:

```ts
function buildSequential(model: KerasModelConfig): ModelGraph {
  const { layers } = model.config;
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  let prevOutput = "";

  for (const layer of layers) {
    const layerName = layer.config["name"] as string;
    const outTensor = `${layerName}/output`;

    if (layer.class_name === "InputLayer") {
      const batchShape = (layer.config["batch_shape"] as (number | null)[] | null) ?? null;
      inputs.push({
        name: layerName,
        shape: batchShape ? batchShape.map((d) => d ?? -1) : null,
        dtype: (layer.config["dtype"] as string | null) ?? null,
      });
      prevOutput = outTensor;
      continue;
    }

    nodes.push({
      name: layerName,
      opType: layer.class_name,
      inputs: prevOutput ? [prevOutput] : [],
      outputs: [outTensor],
      attributes: extractAttributes(layer.config),
    });
    prevOutput = outTensor;
  }

  const lastNonInput = [...layers].reverse().find((l) => l.class_name !== "InputLayer");
  const outputs: GraphValue[] = lastNonInput
    ? [
        {
          name: lastNonInput.config["name"] as string,
          shape: null,
          dtype: null,
        },
      ]
    : [];

  return { name: model.config.name, inputs, outputs, nodes };
}
```

- [ ] **Step 4: Run tests - all 10 should pass**

```bash
bun test packages/keras
```

Expected: 10 pass

- [ ] **Step 5: Commit**

```bash
git add packages/keras/src/parse.ts packages/keras/test/parse.test.ts
git commit -m "feat(@wetron/keras): Sequential model -> ModelGraph IR"
```

---

## Task 4: Functional model IR

**Files:**

- Modify: `packages/keras/src/parse.ts` (implement `buildFunctional` + `resolveInbounds`)
- Modify: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Add Functional model tests**

Append to `packages/keras/test/parse.test.ts`:

```ts
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
  expect(graph.nodes[0].inputs[0]).toBe("img/output"); // Conv2D ← InputLayer
  expect(graph.nodes[1].inputs[0]).toBe("conv2d/output"); // Flatten ← Conv2D
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
  expect(concat.inputs).toEqual(["a/output", "b/output"]);
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
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
bun test packages/keras
```

Expected: 10 pass, 7 fail

- [ ] **Step 3: Implement resolveInbounds and buildFunctional in parse.ts**

Replace the stub `buildFunctional` function and add `resolveInbounds` helper before it:

```ts
function resolveInbounds(
  inboundNodes: KerasInboundNode[],
  outputMap: Map<string, string>,
): string[] {
  if (!inboundNodes.length) return [];
  const firstArg = inboundNodes[0].args[0];
  if (firstArg == null) return [];

  // Merge layer: args[0] is an array of keras_history objects
  if (Array.isArray(firstArg)) {
    return (firstArg as unknown[]).flatMap((item) => {
      const kh = (item as { keras_history?: unknown }).keras_history;
      if (!Array.isArray(kh)) return [];
      const tensor = outputMap.get(String(kh[0]));
      return tensor ? [tensor] : [];
    });
  }

  // Single input layer
  const kh = (firstArg as { keras_history?: unknown }).keras_history;
  if (!Array.isArray(kh)) return [];
  const tensor = outputMap.get(String(kh[0]));
  return tensor ? [tensor] : [];
}

function buildFunctional(model: KerasModelConfig): ModelGraph {
  const { layers } = model.config;
  const nodes: GraphNode[] = [];
  const inputs: GraphValue[] = [];
  const outputMap = new Map<string, string>(); // layerName -> synthetic output tensor name
  const consumedTensors = new Set<string>();

  for (const layer of layers) {
    const layerName = layer.config["name"] as string;
    const outTensor = `${layerName}/output`;
    outputMap.set(layerName, outTensor);

    if (layer.class_name === "InputLayer") {
      const batchShape = (layer.config["batch_shape"] as (number | null)[] | null) ?? null;
      inputs.push({
        name: layerName,
        shape: batchShape ? batchShape.map((d) => d ?? -1) : null,
        dtype: (layer.config["dtype"] as string | null) ?? null,
      });
      continue;
    }

    const inputTensors = resolveInbounds(layer.inbound_nodes, outputMap);
    inputTensors.forEach((t) => consumedTensors.add(t));

    nodes.push({
      name: layerName,
      opType: layer.class_name,
      inputs: inputTensors,
      outputs: [outTensor],
      attributes: extractAttributes(layer.config),
    });
  }

  // Graph outputs: layer outputs that are never consumed as another layer's input
  const outputs: GraphValue[] = nodes
    .filter((n) => !consumedTensors.has(n.outputs[0]))
    .map((n) => ({ name: n.name, shape: null, dtype: null }));

  return { name: model.config.name, inputs, outputs, nodes };
}
```

- [ ] **Step 4: Run tests - all 17 should pass**

```bash
bun test packages/keras
```

Expected: 17 pass

- [ ] **Step 5: Commit**

```bash
git add packages/keras/src/parse.ts packages/keras/test/parse.test.ts
git commit -m "feat(@wetron/keras): Functional model IR with merge layer support"
```

---

## Task 5: Keras layer categories

**Files:**

- Modify: `packages/core/src/categories.ts`
- Modify: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Add category tests**

Append to `packages/keras/test/parse.test.ts`:

```ts
import { opCategory } from "@wetron/core";

test("categories: Keras conv layers -> conv", () => {
  for (const op of [
    "Conv1D",
    "Conv2D",
    "Conv3D",
    "Conv2DTranspose",
    "DepthwiseConv2D",
    "SeparableConv2D",
    "Dense",
  ]) {
    expect(opCategory(op)).toBe("conv");
  }
});

test("categories: Keras activation layers -> activation", () => {
  for (const op of ["Activation", "ReLU", "LeakyReLU", "PReLU", "ELU", "Softmax", "Sigmoid"]) {
    expect(opCategory(op)).toBe("activation");
  }
});

test("categories: Keras normalization layers -> normalization", () => {
  for (const op of [
    "BatchNormalization",
    "LayerNormalization",
    "GroupNormalization",
    "UnitNormalization",
  ]) {
    expect(opCategory(op)).toBe("normalization");
  }
});

test("categories: Keras pooling layers -> pooling", () => {
  for (const op of [
    "MaxPooling1D",
    "MaxPooling2D",
    "MaxPooling3D",
    "AveragePooling2D",
    "GlobalMaxPooling2D",
    "GlobalAveragePooling2D",
  ]) {
    expect(opCategory(op)).toBe("pooling");
  }
});

test("categories: Keras reshape layers -> reshape", () => {
  for (const op of [
    "Flatten",
    "Reshape",
    "Permute",
    "RepeatVector",
    "ZeroPadding2D",
    "Cropping2D",
    "UpSampling2D",
  ]) {
    expect(opCategory(op)).toBe("reshape");
  }
});

test("categories: Keras math layers -> math", () => {
  for (const op of ["Add", "Subtract", "Multiply", "Average", "Maximum", "Minimum", "Dot"]) {
    expect(opCategory(op)).toBe("math");
  }
});

test("categories: Keras merge layers -> merge", () => {
  expect(opCategory("Concatenate")).toBe("merge");
});

test("categories: Keras attention layers -> attention", () => {
  for (const op of ["MultiHeadAttention", "Attention", "AdditiveAttention"]) {
    expect(opCategory(op)).toBe("attention");
  }
});

test("categories: Keras recurrent layers -> recurrent", () => {
  for (const op of ["LSTM", "GRU", "SimpleRNN", "Bidirectional", "TimeDistributed", "ConvLSTM2D"]) {
    expect(opCategory(op)).toBe("recurrent");
  }
});
```

- [ ] **Step 2: Run tests to see 9 new tests fail**

```bash
bun test packages/keras
```

Expected: 17 pass, 9 fail

- [ ] **Step 3: Add Keras entries to CATEGORY_MAP in packages/core/src/categories.ts**

Add the following block at the end of `CATEGORY_MAP`, after the existing TFLite entries and before the closing `};`:

```ts
  // Keras (class_name values)
  Conv1D: 'conv',
  Conv2D: 'conv',
  Conv3D: 'conv',
  Conv1DTranspose: 'conv',
  Conv2DTranspose: 'conv',
  Conv3DTranspose: 'conv',
  DepthwiseConv1D: 'conv',
  DepthwiseConv2D: 'conv',
  SeparableConv1D: 'conv',
  SeparableConv2D: 'conv',
  Dense: 'conv',

  Activation: 'activation',
  ReLU: 'activation',
  LeakyReLU: 'activation',
  PReLU: 'activation',
  ELU: 'activation',
  ThresholdedReLU: 'activation',
  Softmax: 'activation',
  Sigmoid: 'activation',

  BatchNormalization: 'normalization',
  LayerNormalization: 'normalization',
  GroupNormalization: 'normalization',
  UnitNormalization: 'normalization',

  MaxPooling1D: 'pooling',
  MaxPooling2D: 'pooling',
  MaxPooling3D: 'pooling',
  AveragePooling1D: 'pooling',
  AveragePooling2D: 'pooling',
  AveragePooling3D: 'pooling',
  GlobalMaxPooling1D: 'pooling',
  GlobalMaxPooling2D: 'pooling',
  GlobalMaxPooling3D: 'pooling',
  GlobalAveragePooling1D: 'pooling',
  GlobalAveragePooling2D: 'pooling',
  GlobalAveragePooling3D: 'pooling',

  Flatten: 'reshape',
  Reshape: 'reshape',
  Permute: 'reshape',
  RepeatVector: 'reshape',
  ZeroPadding1D: 'reshape',
  ZeroPadding2D: 'reshape',
  ZeroPadding3D: 'reshape',
  Cropping1D: 'reshape',
  Cropping2D: 'reshape',
  Cropping3D: 'reshape',
  UpSampling1D: 'reshape',
  UpSampling2D: 'reshape',
  UpSampling3D: 'reshape',

  Add: 'math',
  Subtract: 'math',
  Multiply: 'math',
  Average: 'math',
  Maximum: 'math',
  Minimum: 'math',
  Dot: 'math',

  Concatenate: 'merge',

  MultiHeadAttention: 'attention',
  Attention: 'attention',
  AdditiveAttention: 'attention',

  LSTM: 'recurrent',
  GRU: 'recurrent',
  SimpleRNN: 'recurrent',
  Bidirectional: 'recurrent',
  TimeDistributed: 'recurrent',
  ConvLSTM1D: 'recurrent',
  ConvLSTM2D: 'recurrent',
  ConvLSTM3D: 'recurrent',
```

- [ ] **Step 4: Run the full test suite - all tests should pass**

```bash
bun test
```

Expected: all existing tests still pass + 9 new category tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/categories.ts packages/keras/test/parse.test.ts
git commit -m "feat(@wetron/core): add Keras layer category mappings"
```

---

## Task 6: Format detection, parseModel dispatch, demo wiring

**Files:**

- Modify: `packages/core/src/detect.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `packages/keras/test/parse.test.ts`

- [ ] **Step 1: Add detection and end-to-end dispatch tests**

Append to `packages/keras/test/parse.test.ts`:

```ts
import { detectFormat } from "@wetron/core/detect";
import { parseModel } from "@wetron/core";

test("detectFormat: ZIP magic bytes -> keras", () => {
  const zip = makeKerasZip({ "config.json": "{}" });
  expect(detectFormat(zip)).toBe("keras");
});

test("detectFormat: .keras extension with unknown bytes -> keras", () => {
  expect(detectFormat(new Uint8Array([0x00, 0x00, 0x00, 0x00]), "model.keras")).toBe("keras");
});

test("detectFormat: ONNX bytes still detected as onnx, not affected by keras addition", () => {
  expect(detectFormat(new Uint8Array([0x08, 0x00]))).toBe("onnx");
});

test("parseModel: dispatches .keras bytes to parseKeras", async () => {
  const zip = makeKerasZip({ "config.json": SEQ_CONFIG });
  const graph = await parseModel(zip, "model.keras");
  expect(graph.nodes.length).toBe(2);
  expect(graph.name).toBe("clf");
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
bun test packages/keras
```

Expected: 26 pass, 4 fail (`detectFormat` returns `'unknown'`, `parseModel` throws)

- [ ] **Step 3: Update detect.ts**

Replace `packages/core/src/detect.ts` with:

```ts
export type Format = "onnx" | "tflite" | "keras" | "unknown";

export function detectFormat(bytes: Uint8Array, filename?: string): Format {
  if (bytes.length >= 8) {
    // TFL3
    if (bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33)
      return "tflite";
    // ODLF (LiteRT)
    if (bytes[4] === 0x4f && bytes[5] === 0x44 && bytes[6] === 0x4c && bytes[7] === 0x46)
      return "tflite";
  }
  // ZIP magic bytes PK\x03\x04 - .keras archives
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
    return "keras";
  // ONNX: protobuf field 1 varint tag = 0x08
  if (bytes.length > 0 && bytes[0] === 0x08) return "onnx";
  // Extension fallback
  if (filename?.endsWith(".onnx")) return "onnx";
  if (filename?.endsWith(".tflite")) return "tflite";
  if (filename?.endsWith(".keras")) return "keras";
  return "unknown";
}
```

- [ ] **Step 4: Update parseModel in packages/core/src/index.ts**

Add the keras branch after the existing tflite branch. The complete updated `parseModel` function:

```ts
export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  if (format === "onnx") {
    const { parseOnnx } = await import("@wetron/onnx");
    return parseOnnx(bytes);
  }
  if (format === "tflite") {
    const { parseTflite } = await import("@wetron/tflite");
    return parseTflite(bytes);
  }
  if (format === "keras") {
    const { parseKeras } = await import("@wetron/keras");
    return parseKeras(bytes);
  }
  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}
```

Also update the `Format` re-export at the top of `packages/core/src/index.ts` if it re-exports from `detect.ts`. The existing file has:

```ts
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
```

These will automatically pick up the new `'keras'` value - no change needed there.

- [ ] **Step 5: Add @wetron/keras to core's workspace dependency**

The dynamic `import('@wetron/keras')` inside `parseModel` requires the core package to declare it as a dependency. Add to `packages/core/package.json`:

Check the current content of `packages/core/package.json` first:

```bash
cat packages/core/package.json
```

Add `"@wetron/keras": "workspace:*"` to the `"dependencies"` object. (Add alongside existing entries.)

- [ ] **Step 6: Update demo file input to accept .keras**

In `apps/demo/src/App.tsx`, find the file input element:

```tsx
<input type="file" accept=".onnx,.tflite" style={{ display: "none" }} onChange={onFileChange} />
```

Change `accept` to:

```tsx
accept = ".onnx,.tflite,.keras";
```

- [ ] **Step 7: Run the full test suite**

```bash
bun test
```

Expected: all tests pass (including the 4 new ones)

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/detect.ts packages/core/src/index.ts packages/core/package.json apps/demo/src/App.tsx packages/keras/test/parse.test.ts
git commit -m "feat: wire @wetron/keras into parseModel dispatch and demo file input"
```

---

## Self-review

**Spec coverage check:**

- ✅ `.keras` ZIP parsing - Task 2
- ✅ Sequential model IR - Task 3
- ✅ Functional model IR - Task 4
- ✅ Merge layer (multiple inputs) - Task 4
- ✅ Keras layer -> category mappings - Task 5
- ✅ Format detection via ZIP magic bytes - Task 6
- ✅ `parseModel` dispatch - Task 6
- ✅ Demo app wiring - Task 6
- ✅ `ParseError` on unsupported model class (subclassed) - Task 2

**Out of scope (documented non-goals):**

- `.h5` / HDF5 format - requires WASM or incomplete pure-JS library
- Subclassed Keras models - no serializable config
- Nested model layers (e.g. `TimeDistributed` wrapping a full sub-model) - outer layer appears as a single node; inner config is not expanded

**Placeholder scan:** No TBD, no "add appropriate error handling", no "similar to Task N" - each task has complete code.

**Type consistency check:**

- `KerasLayerEntry.config` is `Record<string, unknown>` throughout ✅
- `extractAttributes` returns `Record<string, AttributeValue>` used in all GraphNode constructions ✅
- `resolveInbounds` returns `string[]` and is used in `buildFunctional` only ✅
- `buildSequential` and `buildFunctional` both return `ModelGraph` ✅
- `parseKeras` signature: `(bytes: Uint8Array): ModelGraph` - synchronous, consistent with `parseTflite` ✅
