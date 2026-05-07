# wetron

Browser-native neural network model visualizer. Parses ONNX, TFLite, Keras, TorchScript, ExecuTorch, and TensorFlow SavedModel files into a shared IR and renders the computation graph. ONNX and TFLite expose initializer bytes via `ModelGraph.weights`; TF2 SavedModel weights load from the external checkpoint pair via `loadSavedModelWeights`. Decoded values feed `computeStats` for histogram + heatmap previews in the property panel.

## Packages

- `@wetron/core` - shared IR types, format detection, dtype utilities, Dagre layout, unified `parseModel` entry point
- `@wetron/onnx` - ONNX parser (protobufjs)
- `@wetron/tflite` - TFLite parser (flatbuffers), synchronous
- `@wetron/keras` - Keras `.keras` archive parser (fflate)
- `@wetron/torchscript` - TorchScript Mobile and ZIP-based parser (flatbuffers + custom bytecode decoder)
- `@wetron/executorch` - ExecuTorch `.pte` parser (flatbuffers)
- `@wetron/savedmodel` - TensorFlow SavedModel `.pb` parser (protobufjs); handles both `saved_model.pb` TF op graphs and `keras_metadata.pb` Keras layer graphs
- `@wetron/react` - React components: `ModelGraphView`, `NodePropertyPanel` (peer: react 18+, @xyflow/react 12+, @phosphor-icons/react 2+, @base-ui/react 1+)
- `@wetron/svelte` - Svelte components: `ModelGraphView`, `NodePropertyPanel` (peer: svelte 5+, @xyflow/svelte 1.5+, phosphor-svelte 3+)
- `@wetron/tokens` - design tokens: category colors, CSS vars - zero dependencies, all types inlined

## Core IR types (`@wetron/core/ir`)

```ts
type AttributeValue = string | number | boolean | readonly number[] | readonly string[];

interface GraphValue {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
}

interface GraphNode {
  readonly name: string;
  readonly opType: string;
  readonly domain?: string; // operator domain (ONNX only; absent = standard ai.onnx)
  readonly inputs: readonly string[]; // tensor names consumed
  readonly outputs: readonly string[]; // tensor names produced
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

interface ModelGraph {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
  readonly initializers: ReadonlyMap<string, { shape: readonly number[]; dtype: string }>;
  readonly tensorShapes: ReadonlyMap<
    string,
    { shape: readonly number[] | null; dtype: string | null }
  >;
  readonly opsets?: ReadonlyMap<string, number>; // domain -> version (ONNX only; "" = ai.onnx)
  readonly fileSizeBytes: number; // size of source file; used for the >20MB weight gate
  readonly weights?: WeightSource; // present when the parser surfaces initializer bytes
  readonly hasExternalWeights?: boolean; // TF2 SavedModel: true when weights live in a checkpoint pair
  readonly warnings?: readonly ParseWarning[];
}

interface WeightSource {
  readonly totalBytes: number;
  get(name: string): Uint8Array | undefined; // raw initializer bytes; undefined if unknown
}

interface ParseWarning {
  readonly code: string;
  readonly context: string;
  readonly nodeIndex?: number;
}

class ParseError extends Error {
  readonly format: string; // "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown"
  readonly context: string; // human-readable description of failure
}
```

## Public API (`@wetron/core`)

```ts
// Unified entry - detects format from magic bytes, dispatches to parser
async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;

// Format detection - never throws, returns "unknown" on no match
type Format = "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown";
function detectFormat(bytes: Uint8Array, filename?: string): Format;

// IR -> ReactFlow / SvelteFlow nodes and edges with Dagre layout applied
function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] };

// Op category classification
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

// Named input slot labels for known ops (e.g. Conv -> ["X","W","B"])
function opInputLabels(opType: string): readonly string[];

// Search filter - returns the set of node names matching the query (op type or name substring)
function filterGraph(graph: ModelGraph, query: string): ReadonlySet<string>;

// Weight inspection - decode raw initializer bytes from a WeightSource into typed arrays.
// Returns null for unknown dtypes. Output element kind: f64 for floats, i32 for ints up to 32 bits, i64 for int64/uint64.
function decodeWeight(
  bytes: Uint8Array,
  dtype: string,
  shape: readonly number[],
): Float64Array | Int32Array | BigInt64Array | null;
function decodeFirstN(
  bytes: Uint8Array,
  dtype: string,
  n: number,
): Float64Array | Int32Array | BigInt64Array | null;

// Single-pass statistics over a decoded array - 12-bin histogram, 16x8 heatmap, count/min/max/mean/std/zeros
interface WeightStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number;
  readonly zeros: number;
  readonly histogram: readonly number[]; // 12 fixed-width bins between min and max
  readonly heatmap: readonly number[]; // 16 cols x 8 rows = 128, mean-of-chunk values
  readonly chunkSize: number;
}
function computeStats(values: Float64Array | Int32Array): WeightStats;
```

## Parser APIs

```ts
// @wetron/onnx
function parseOnnx(bytes: Uint8Array): ModelGraph; // sync

// @wetron/tflite
function parseTflite(bytes: Uint8Array): ModelGraph; // sync

// @wetron/keras
function parseKeras(bytes: Uint8Array): ModelGraph; // sync

// @wetron/torchscript
function parseTorchscript(bytes: Uint8Array): ModelGraph; // sync; handles ZIP and FlatBuffers Mobile

// @wetron/executorch
function parseExecutorch(bytes: Uint8Array): ModelGraph; // sync

// @wetron/savedmodel
function parseSavedModel(bytes: Uint8Array): ModelGraph; // sync; handles saved_model.pb and keras_metadata.pb

// TF2 checkpoint pair (variables.index + variables.data-00000-of-00001) -> WeightSource
function loadSavedModelWeights(indexFile: File, dataFile: File): Promise<LoadedCheckpoint>;
// Re-key the loaded WeightSource by graph node names (resolves VarHandleOp shared_name)
function attachCheckpointToGraph(graph: ModelGraph, loaded: LoadedCheckpoint): ModelGraph;
```

## Format detection (magic bytes)

| Format             | Detection                                       |
| ------------------ | ----------------------------------------------- |
| ONNX               | protobuf field 1 varint tag `0x08`              |
| TFLite             | `TFL3` or `ODLF` at offset 4                    |
| Keras              | ZIP magic `PK\x03\x04` + `config.json` entry    |
| TorchScript ZIP    | ZIP magic `PK\x03\x04` + `.pt`/`.ptl` extension |
| TorchScript Mobile | `PTMF` at offset 4                              |
| ExecuTorch         | `ET12` at offset 4                              |
| SavedModel         | `.pb` filename extension (checked before ONNX)  |

## Architecture rules

- All IR types live in `@wetron/core/src/ir.ts` - parsers import from there.
- Exotic dtype readers (bfloat16, float8, int4, etc.) live in `@wetron/core/src/dtypes.ts` - never inline in parsers.
- `detectFormat` must always return a `Format` string, never throw.
- Weight bytes are exposed only through `WeightSource.get(name)` - parsers never preload or cache the entire weight payload.
- No patching of `DataView.prototype` or `BigInt.prototype`.
- Use `bigIntToNumber(v)` from `@wetron/core/dtypes` for BigInt -> number (throws RangeError if out of safe range).

## Platform constraints (browser-only)

- Binary reads: `DataView` methods only
- File input: `file.arrayBuffer()`
- Remote fetch: `fetch().arrayBuffer()`
- Text: `TextDecoder` / `TextEncoder`
- Decompression: `DecompressionStream` (or `fflate` for ZIP in Keras/TorchScript)
- No `FileReader`, `XMLHttpRequest`, Node.js APIs, or manual UTF-8 loops

## Adding a parser

1. Create `packages/<format>/src/parse.ts` - export a single parse function returning `ModelGraph`.
2. Import IR types from `@wetron/core/ir`, dtype readers from `@wetron/core/dtypes`.
3. Register magic bytes in `@wetron/core/src/detect.ts` and add a dynamic import branch in `@wetron/core/src/index.ts`.
4. Test against real model files in `test-models/` - node count must match netron's UI for the same file.
