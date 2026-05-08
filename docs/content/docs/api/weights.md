---
title: "Weights"
description: "Weight inspection API - WeightSource on ModelGraph, decodeWeight / decodeFirstN for typed-array views, computeStats for histogram + heatmap previews, loadSavedModelWeights for TF2 checkpoints."
lead: "Lazily decode initializer bytes into typed arrays and summary statistics."
weight: 30
---

```ts
import { decodeWeight, decodeFirstN, computeStats } from "@wetron/core";
import type { WeightSource, WeightStats } from "@wetron/core";
```

{{< themed-img light="images/property-panel-heatmap-light.png" dark="images/property-panel-heatmap-dark.png" alt="Property panel rendering a weight heatmap from WeightStats" class="themed-img--narrow" >}}

## WeightSource

Lives on `ModelGraph.weights`. Present when the parser surfaces initializer bytes.

```ts
interface WeightSource {
  readonly totalBytes: number;
  get(name: string): Uint8Array | undefined;
}
```

`get(name)` returns raw little-endian bytes for the named initializer or `undefined` if the name is unknown. The slice is a view into the original parser buffer - no copy is made.

## Parser support

| Format                                                 | `graph.weights` populated by                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| ONNX                                                   | `parseOnnx` (inline initializer payloads)                                |
| TFLite                                                 | `parseTflite` (buffer table referenced by tensors)                       |
| SavedModel (`saved_model.pb`)                          | `attachCheckpointToGraph` after `loadSavedModelWeights` (TF2 checkpoint) |
| Keras / TorchScript / ExecuTorch / `keras_metadata.pb` | not surfaced - weights live in separate files this stack does not load   |

## decodeWeight

```ts
function decodeWeight(
  bytes: Uint8Array,
  dtype: string,
  shape: readonly number[],
): Float64Array | Int32Array | BigInt64Array | null;
```

Decodes the entire byte slice into a typed array sized to `shape`. Returns `null` for unknown dtypes.

Output element kind:

- `Float64Array` for `float16`, `bfloat16`, `float32`, `float64`
- `Int32Array` for `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`, `bool`
- `BigInt64Array` for `int64`, `uint64`

## decodeFirstN

```ts
function decodeFirstN(
  bytes: Uint8Array,
  dtype: string,
  n: number,
): Float64Array | Int32Array | BigInt64Array | null;
```

Same kind mapping as `decodeWeight`. Decodes the first `n` elements (or fewer if the byte slice is shorter). Use this for previews of large tensors.

## computeStats

```ts
function computeStats(values: Float64Array | Int32Array): WeightStats;
```

Single-pass scan over a decoded array. The `BigInt64Array` output of `decodeWeight` is not a valid input - convert int64 weights to a numeric form first if you need stats.

```ts
interface WeightStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number;
  readonly zeros: number;
  readonly histogram: readonly number[]; // length 12, fixed-width bins between min and max
  readonly heatmap: readonly number[]; // length 128, 16 cols x 8 rows, mean of consecutive chunks
  readonly chunkSize: number; // values averaged per heatmap cell
}
```

The histogram has 12 bins between `min` and `max`. When `min === max`, the entire count lands in the middle bin. The heatmap is `16 × 8 = 128` cells; each cell averages `chunkSize = max(1, floor(count / 128))` consecutive values.

{{< themed-img light="images/property-panel-bar-plot-light.png" dark="images/property-panel-bar-plot-dark.png" alt="Property panel rendering a 12-bin histogram from WeightStats" class="themed-img--narrow" >}}

## TF2 SavedModel checkpoint loader

```ts
import { loadSavedModelWeights, attachCheckpointToGraph } from "@wetron/savedmodel";
import type { LoadedCheckpoint } from "@wetron/savedmodel";

async function loadSavedModelWeights(indexFile: File, dataFile: File): Promise<LoadedCheckpoint>;

interface LoadedCheckpoint {
  readonly weights: WeightSource;
  readonly metas: ReadonlyMap<string, { dtype: string; shape: readonly number[] }>;
  readonly fullNameToKey: ReadonlyMap<string, string>;
}

function attachCheckpointToGraph(graph: ModelGraph, loaded: LoadedCheckpoint): ModelGraph;
```

`loadSavedModelWeights` reads the SavedModel checkpoint pair (`variables.index` + `variables.data-00000-of-00001`) and returns a `WeightSource` keyed by the SSTable key plus dtype/shape metadata.

`attachCheckpointToGraph` re-keys the loaded `WeightSource` by graph node name. It walks each `VarHandleOp` node, resolves its `shared_name` against the checkpoint's object graph (`_CHECKPOINTABLE_OBJECT_GRAPH`) or directly against `<shared_name>/.ATTRIBUTES/VARIABLE_VALUE`, and returns a new `ModelGraph` whose `weights.get(nodeName)` returns the matching tensor bytes.

The flag `ModelGraph.hasExternalWeights` is set by `parseSavedModel` when at least one `VarHandleOp` is present, so a host app knows to prompt for the checkpoint files.

## Example

```ts
import { parseModel } from "@wetron/core";
import { decodeFirstN, computeStats } from "@wetron/core";

const graph = await parseModel(bytes, file.name);
const weightBytes = graph.weights?.get("conv1.weight");
if (weightBytes) {
  const preview = decodeFirstN(weightBytes, "float32", 4096);
  if (preview && preview instanceof Float64Array) {
    const stats = computeStats(preview);
    console.log(stats.min, stats.max, stats.mean, stats.std);
  }
}
```
