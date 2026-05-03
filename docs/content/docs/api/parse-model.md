---
title: "parseModel / detectFormat"
description: "Unified model parser entry point that auto-detects format from magic bytes, and the standalone detectFormat function that never throws."
lead: "Auto-detects format from magic bytes and dispatches to the right parser."
weight: 10
---

## parseModel

```ts
import { parseModel } from "@wetron/core";

async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;
```

Inspects the buffer's magic bytes (with filename extension as a tiebreaker) to identify the format, then dynamically imports and calls the matching parser package.

Throws `ParseError` if the format cannot be detected or parsing fails.

## Direct parser imports

Call parsers directly to avoid the auto-detection overhead, or if you want to exclude specific parsers from your bundle:

```ts
import { parseOnnx } from "@wetron/onnx";
import { parseTflite } from "@wetron/tflite";
import { parseKeras } from "@wetron/keras";
import { parseTorchscript } from "@wetron/torchscript";
import { parseExecutorch } from "@wetron/executorch";

const graph = await parseOnnx(bytes); // async
const graph = parseTflite(bytes); // sync
const graph = await parseKeras(bytes); // async (ZIP extraction)
const graph = parseTorchscript(bytes); // sync
const graph = parseExecutorch(bytes); // sync
```

## detectFormat

```ts
import { detectFormat } from "@wetron/core";

type Format = "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "unknown";

function detectFormat(bytes: Uint8Array, filename?: string): Format;
```

Returns a format string — never throws. Useful for showing format badges in a UI before parsing.

| Format        | Magic bytes                                                    |
| ------------- | -------------------------------------------------------------- |
| `onnx`        | protobuf field 1 varint tag `0x08`                             |
| `tflite`      | `TFL3` or `ODLF` at offset 4                                   |
| `keras`       | ZIP magic `PK\x03\x04` + `config.json` entry                   |
| `torchscript` | ZIP magic `PK\x03\x04` + `bytecode.pkl`, or `PTMF` at offset 4 |
| `executorch`  | `ET12` at offset 4                                             |
| `unknown`     | no match                                                       |

## modelGraphToFlow

```ts
import { modelGraphToFlow } from "@wetron/core";

function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] };
```

Converts a `ModelGraph` to layout-positioned `FlowNode[]` and `FlowEdge[]` ready for ReactFlow or SvelteFlow. Dagre is applied top-to-bottom. Used internally by the renderer packages — call it directly only if you're building a custom renderer.

## opCategory

```ts
import { opCategory } from "@wetron/core";

type OpCategory =
  | "input"
  | "output"
  | "conv"
  | "activation"
  | "normalization"
  | "pooling"
  | "reshape"
  | "math"
  | "reduction"
  | "merge"
  | "attention"
  | "recurrent"
  | "quantization"
  | "constant"
  | "logic"
  | "unknown";

function opCategory(opType: string): OpCategory;
```

Maps an op type string to a semantic category. Used by the renderer to assign node colours.

## opInputLabels

```ts
import { opInputLabels } from "@wetron/core";

function opInputLabels(opType: string): readonly string[];
```

Returns named input slot labels for known ops (e.g. `Conv` → `["X", "W", "B"]`). Returns an empty array for unrecognised ops.
