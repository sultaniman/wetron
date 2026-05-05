# @wetron/core

Shared foundation for the wetron monorepo. Provides the IR types all parsers produce, format detection, dtype utilities, Dagre-based layout transform, and the unified `parseModel` entry point that dispatches to the right parser.

## Install

```bash
bun add @wetron/core
```

## API

```ts
// Detect format from magic bytes - never throws, returns "unknown" on no match
type Format = "onnx" | "tflite" | "keras" | "torchscript" | "executorch" | "savedmodel" | "unknown";
function detectFormat(bytes: Uint8Array, filename?: string): Format;

// Parse a model file - dispatches to the right parser based on format detection
async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;

// Convert IR to ReactFlow / SvelteFlow nodes and edges (Dagre layout, top-to-bottom)
function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] };

// Op category from opType string
function opCategory(opType: string): OpCategory;

// Named input slot labels for known ops (e.g. Conv -> ["X","W","B"])
function opInputLabels(opType: string): readonly string[];
```

## Sub-path exports

| Path                       | Contents                                           |
| -------------------------- | -------------------------------------------------- |
| `@wetron/core/ir`          | IR types and `ParseError`                          |
| `@wetron/core/dtypes`      | Exotic numeric readers (bfloat16, float8, int4, …) |
| `@wetron/core/detect`      | `detectFormat` standalone                          |
| `@wetron/core/transform`   | `modelGraphToFlow` and flow types                  |
| `@wetron/core/edge-path`   | Edge routing geometry                              |
| `@wetron/core/panel-utils` | Property panel helpers                             |

## IR types

```ts
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
  readonly opsets?: ReadonlyMap<string, number>;
  readonly warnings?: readonly ParseWarning[];
}

interface GraphNode {
  readonly name: string;
  readonly opType: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

interface GraphValue {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
}
```

## Format detection

| Format             | Detection                                      |
| ------------------ | ---------------------------------------------- |
| SavedModel         | `.pb` filename extension (checked before ONNX) |
| ONNX               | protobuf field 1 varint tag `0x08`             |
| TFLite             | `TFL3` or `ODLF` at offset 4                   |
| Keras              | ZIP magic + `config.json` entry                |
| TorchScript ZIP    | ZIP magic + `bytecode.pkl`                     |
| TorchScript Mobile | `PTMF` at offset 4                             |
| ExecuTorch         | `ET12` at offset 4                             |
