# @wetron/core

Shared foundation for the wetron monorepo. Provides the IR types all parsers produce, format detection, dtype utilities, Dagre-based layout transform, and the unified `parseModel` entry point that dispatches to parser packages.

## Exports

```ts
// Unified entry — detects format from magic bytes, dynamic-imports the right parser
async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;

// Format detection — never throws, returns "unknown" on no match
type Format = "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown";
function detectFormat(bytes: Uint8Array, filename?: string): Format;

// IR → ReactFlow / SvelteFlow nodes and edges, Dagre layout applied (top-to-bottom)
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

// Named input slot labels for known ops (e.g. Conv → ["X","W","B"])
function opInputLabels(opType: string): readonly string[];
```

## Sub-path exports

- `@wetron/core/ir` — IR types and `ParseError`
- `@wetron/core/dtypes` — exotic numeric readers (bfloat16, float8, int4, …)
- `@wetron/core/detect` — `detectFormat` standalone
- `@wetron/core/transform` — `modelGraphToFlow` and flow types
- `@wetron/core/edge-path` — edge routing geometry
- `@wetron/core/panel-utils` — property panel helpers

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
  readonly opsets?: ReadonlyMap<string, number>; // domain → version (ONNX only; "" = ai.onnx)
  readonly warnings?: readonly ParseWarning[];
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

- No weight deserialization — graph structure only.
- `detectFormat` always returns `Format`, never throws.
- Do not patch `DataView.prototype` or `BigInt.prototype`.
- Use `bigIntToNumber(v: bigint): number` from `@wetron/core/dtypes` for BigInt → number (throws `RangeError` if outside safe integer range).
- All exotic dtype readers live in `@wetron/core/dtypes` — parsers import from there, never inline shims.
