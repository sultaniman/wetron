# @wetron/core

Shared foundation for the wetron monorepo. Provides the IR types all parsers produce, format detection, dtype utilities, Dagre-based layout transform, and the unified `parseModel` entry point that dispatches to parser packages.

## Exports

```ts
// Unified entry - detects format from magic bytes, dynamic-imports the right parser
async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;

// Format detection - never throws, returns "unknown" on no match
type Format = "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown";
function detectFormat(bytes: Uint8Array, filename?: string): Format;

// IR -> ReactFlow / SvelteFlow nodes and edges, Dagre layout applied (top-to-bottom)
function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] };

// Op category from opType string
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

// Weight inspection helpers (consumed by @wetron/react WeightPanel)
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

function computeStats(values: Float64Array | Int32Array): WeightStats;

interface WeightStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number; // population standard deviation
  readonly zeros: number;
  readonly histogram: readonly number[]; // 12 fixed-width bins between min and max
  readonly heatmap: readonly number[]; // 16 cols x 8 rows of mean-of-chunk values, length 128
  readonly chunkSize: number; // number of consecutive values aggregated per heatmap cell
}
```

## Sub-path exports

- `@wetron/core/ir` - IR types and `ParseError`
- `@wetron/core/dtypes` - exotic numeric readers (bfloat16, float8, int4, …)
- `@wetron/core/detect` - `detectFormat` standalone
- `@wetron/core/transform` - `modelGraphToFlow` and flow types
- `@wetron/core/edge-path` - edge routing geometry
- `@wetron/core/panel-utils` - property panel helpers

## IR types (`@wetron/core/ir`)

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
  readonly fileSizeBytes: number; // size of the source file; drives the >20 MB lazy-load gate in the WeightPanel
  readonly weights?: WeightSource; // lazy accessor for initializer bytes; undefined for parsers that don't surface weights
  readonly warnings?: readonly ParseWarning[];
}

interface WeightSource {
  readonly totalBytes: number; // sum of all initializer byte lengths
  get(name: string): Uint8Array | undefined; // returns bytes for one initializer, or undefined for unknown / unsupported
}

interface ParseWarning {
  readonly code: string;
  readonly context: string;
  readonly nodeIndex?: number;
}

class ParseError extends Error {
  readonly format: string; // format string or "unknown"
  readonly context: string; // human-readable failure description
}
```

## Flow types (`@wetron/core/transform`)

```ts
type GraphNodeData = {
  opType: string;
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
  graphNode?: GraphNode; // set for op nodes
  graphValue?: GraphValue; // set for I/O nodes
  shape?: readonly number[] | null;
  dtype?: string | null;
  weightInputs?: readonly {
    slot: number;
    label: string;
    name: string;
    shape: readonly number[];
    dtype: string;
  }[];
};

type FlowNode = {
  id: string;
  type: "graphNode" | "ioNode";
  position: { x: number; y: number };
  data: GraphNodeData;
  initialWidth: number;
  initialHeight: number;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: "modelEdge";
  data: { tensorName: string; sourceOpType: string };
};
```

## Format detection (magic bytes)

| Format             | Detection                                       |
| ------------------ | ----------------------------------------------- |
| ONNX               | protobuf field 1 varint tag `0x08`              |
| TFLite             | `TFL3` or `ODLF` at offset 4                    |
| Keras              | ZIP magic `PK\x03\x04` + `.keras` extension     |
| TorchScript ZIP    | ZIP magic `PK\x03\x04` + `.pt`/`.ptl` extension |
| TorchScript Mobile | `PTMF` at offset 4                              |
| ExecuTorch         | `ET12` at offset 4                              |
| SavedModel         | `.pb` filename extension (checked before ONNX)  |

## Constraints

- Parsers never copy weight bytes eagerly. ONNX and TFLite expose them through `WeightSource.get(name)` (zero-copy slices into the input `Uint8Array` for TFLite; protobufjs-decoded `raw_data` / typed-arrays for ONNX). Other parsers leave `weights` undefined.
- `detectFormat` always returns `Format`, never throws.
- Do not patch `DataView.prototype` or `BigInt.prototype`.
- Use `bigIntToNumber(v: bigint): number` from `@wetron/core/dtypes` for BigInt -> number (throws `RangeError` if outside safe integer range).
- All exotic dtype readers live in `@wetron/core/dtypes` - parsers import from there, never inline shims.

## Weight inspection pipeline

Used by `@wetron/react`'s `WeightPanel` to render an initializer's stats, distribution histogram, heatmap, and a virtualized values grid:

1. Caller decides whether to load: gate on `graph.fileSizeBytes <= 20 MiB` (small models auto-on) or wait for explicit user action (large models).
2. `bytes = graph.weights.get(name)` - O(1) lookup; returns the raw bytes or `undefined`.
3. `decoded = decodeWeight(bytes, dtype, shape)` - typed-array view in C-order. `decodeFirstN` is available for cases that only need a preview without materializing the rest.
4. `stats = computeStats(decoded)` - single pass for `min/max/sum/sumSq/zeros`, second linear pass for the 12-bin histogram, third linear pass for the 128-cell heatmap (16 x 8). `chunkSize = floor(n / 128)` consecutive values are averaged per heatmap cell; the last cell may be a partial chunk.

`computeStats` accepts `Float64Array | Int32Array`. For `BigInt64Array` (int64 weights), the caller must coerce to a `Float64Array` first (one-time `Number(v)` per element); precision degrades above 2^53 but int64 weights are rare in practice.
