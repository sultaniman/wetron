---
title: 'Weights'
description: 'Weight inspection API - WeightSource on ModelGraph, scalar and GGUF Q4_0 decoding, summary statistics, and TF2 checkpoint loading.'
lead: 'Lazily decode initializer bytes into typed arrays and summary statistics.'
weight: 30
---

```ts
import { decodeWeight, decodeFirstN, numericView, computeStats } from '@wetron/core';
import type { WeightSource, WeightStats } from '@wetron/core';
```

{{< themed-img light="images/property-panel-heatmap-light.png" dark="images/property-panel-heatmap-dark.png" alt="Property panel rendering a weight heatmap from WeightStats" class="themed-img--narrow" >}}

## ModelWeights

`ModelGraph.weights` is absent when the parser exposes no payloads. Otherwise it identifies available bytes or required external files.

```ts
type ModelWeights =
  | { readonly kind: 'available'; readonly source: WeightSource }
  | { readonly kind: 'external'; readonly format: 'savedmodel' | 'onnx' };
```

## WeightSource

```ts
interface WeightSource {
  readonly totalBytes: number;
  get(name: string): Uint8Array | undefined;
}
```

`get(name)` returns raw little-endian bytes for the named initializer or `undefined` if the name is unknown. The slice is a view into the original parser buffer - no copy is made.

## Parser support

| Format                                                 | `graph.weights` state                                         |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| ONNX                                                   | `available` for inline payloads; `external` for external data |
| TFLite                                                 | `available` from the referenced buffer table                  |
| GGUF                                                   | `available` for supported little-endian encoded payloads      |
| SavedModel (`saved_model.pb`)                          | `external` until `attachCheckpointToGraph`, then `available`  |
| Keras / TorchScript / ExecuTorch / `keras_metadata.pb` | absent unless a format-specific loader attaches bytes         |

## decodeWeight

```ts
function decodeWeight(
  bytes: Uint8Array,
  dtype: string,
  shape: readonly number[],
): Float64Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array | null;
```

Decodes the entire byte slice into a typed array sized to `shape`. Returns `null` for unknown dtypes.

Output element kind:

- `Float64Array` for floating-point scalar types, GGML `F16` / `F32` / `BF16` / `F64`, and GGML `Q4_0`
- `Int32Array` for signed integer types, `uint8`, `uint16`, `bool`, and GGML `I8` / `I16` / `I32`
- `Uint32Array` for `uint32`
- `BigInt64Array` or `BigUint64Array` for 64-bit integer types

Other GGML quantization formats return `null` until a decoder is implemented. Their encoded bytes remain available through `graph.weights.source` when `kind === "available"`.

## decodeFirstN

```ts
function decodeFirstN(
  bytes: Uint8Array,
  dtype: string,
  n: number,
): Float64Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array | null;
```

Same kind mapping as `decodeWeight`. Decodes the first `n` elements (or fewer if the byte slice is shorter). Use this for previews of large tensors.

## computeStats

```ts
function computeStats(values: NumericWeight): WeightStats;
```

Pass decoded values through `numericView()` first. Number-backed arrays retain their identity; bigint arrays widen once to `Float64Array`.

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
import { loadSavedModelWeights, loadSavedModelWeightsFromUrls, attachCheckpointToGraph } from '@wetron/savedmodel';
import type { LoadedCheckpoint } from '@wetron/savedmodel';

async function loadSavedModelWeights(indexFile: File, dataFile: File): Promise<LoadedCheckpoint>;

async function loadSavedModelWeightsFromUrls(indexUrl: string, ...dataUrls: string[]): Promise<LoadedCheckpoint>;

interface LoadedCheckpoint {
  readonly weights: WeightSource;
  readonly metas: ReadonlyMap<string, CheckpointMeta>;
  readonly fullNameToKey: ReadonlyMap<string, string>;
}

interface CheckpointMeta {
  readonly dtype: string;
  readonly shape: readonly number[];
  readonly shardId: number;
  readonly offset: number;
  readonly size: number;
}

function attachCheckpointToGraph(graph: ModelGraph, loaded: LoadedCheckpoint): ModelGraph;
```

`loadSavedModelWeights` reads the SavedModel checkpoint pair (`variables.index` + `variables.data-XXXXX-of-YYYYY`) and returns a `WeightSource` keyed by the SSTable key. `metas` retains each parsed entry's dtype, shape, shard, byte offset, and byte size, including the `_CHECKPOINTABLE_OBJECT_GRAPH` entry when present.

`loadSavedModelWeightsFromUrls` is the URL-based variant. Pass the index URL plus one data-shard URL per shard, in shard order (shard 0, 1, …). All URLs are fetched in parallel. Server must allow CORS (`Access-Control-Allow-Origin`). Throws `ParseError` if any response is not `ok`.

`attachCheckpointToGraph` re-keys the loaded `WeightSource` by graph node name. It walks each `VarHandleOp` node, resolves its `shared_name` against the checkpoint's object graph (`_CHECKPOINTABLE_OBJECT_GRAPH`) or directly against `<shared_name>/.ATTRIBUTES/VARIABLE_VALUE`, and returns a graph with `weights.kind === "available"`. `weights.source.get(nodeName)` returns the matching tensor bytes.

`parseSavedModel` returns `{ kind: "external", format: "savedmodel" }` when a checkpoint is required.

## ONNX external data loader

```ts
import { loadOnnxExternalWeightsFromUrl } from '@wetron/onnx';

async function loadOnnxExternalWeightsFromUrl(modelBytes: Uint8Array, baseUrl: string): Promise<WeightSource>;
```

For ONNX models whose initializers use `data_location = EXTERNAL`, fetches each unique external file once from `${baseUrl}/${location}` (where `location` is the filename recorded in the initializer's `external_data` entries) and returns a `WeightSource` that slices the fetched buffers by initializer name. Files are fetched in parallel; initializers sharing a `location` share one buffer.

Attach the returned source with `{ ...graph, weights: { kind: "available", source } }`. If any initializer is external, `parseOnnx` reports the model as external rather than exposing a partial source for its inline initializers.

Returns an empty `WeightSource` (`totalBytes: 0`, `get()` always `undefined`) if the model has no `EXTERNAL` initializers. Throws `ParseError` if any response is not `ok`. CORS rules from `parseModelFromUrl` apply.

## Example

```ts
import { parseModel } from '@wetron/core';
import { decodeFirstN, computeStats } from '@wetron/core';

const graph = await parseModel(bytes, file.name);
const weightBytes = graph.weights?.kind === 'available' ? graph.weights.source.get('conv1.weight') : undefined;
if (weightBytes) {
  const preview = decodeFirstN(weightBytes, 'float32', 4096);
  if (preview && preview instanceof Float64Array) {
    const stats = computeStats(numericView(preview));
    console.log(stats.min, stats.max, stats.mean, stats.std);
  }
}
```
