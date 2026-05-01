# wetron — Design

A TypeScript monorepo: parsers for ONNX + TFLite, shared IR, and a React rendering layer using ReactFlow.

---

## Goal

Five publishable packages under the `@wetron/` scope:

- `@wetron/core` — shared IR types, format detection, dtypes, layout transform, unified entry point
- `@wetron/onnx` — ONNX parser
- `@wetron/tflite` — TFLite parser
- `@wetron/react` — ReactFlow rendering layer
- `@wetron/svelte` — `@xyflow/svelte` rendering layer

Graph structure only — no weight deserialization. Browser-only target.

---

## Monorepo Layout

```
wetron/
  packages/
    core/         # shared IR types + format detection + dtypes + layout transform
    onnx/         # ONNX parser
    tflite/       # TFLite parser
    react/        # ReactFlow rendering layer
    svelte/       # @xyflow/svelte rendering layer
  test-models/    # .onnx and .tflite files
  netron-main/    # reference source (schema field layouts)
  docs/
```

Tooling: Bun as package manager + runtime, Bun workspaces, TypeScript, `bun test` for all packages. No pnpm, no Node.

---

## Architecture

### `@wetron/core`

**`src/ir.ts`** — readonly IR types, no dependencies:

- `ModelGraph` — `name`, `inputs`, `outputs`, `nodes`
- `GraphNode` — `name`, `opType`, `inputs: string[]`, `outputs: string[]`, `attributes: Record<string, AttributeValue>`
- `GraphValue` — `name`, `shape: number[] | null`, `dtype: string | null`
- `AttributeValue` — `string | number | boolean | number[] | string[]`
- `ParseError` — typed error class with `format` and `context` fields

**`src/dtypes.ts`** — exotic numeric type readers (no `DataView.prototype` patches):

- Exported functions: `readFloat16`, `readBfloat16`, `readFloat8e4m3fn`, `readFloat8e5m2`, `readFloat4e2m1`, `readInt4`, `readUint4`, `readIntBits`, `readUintBits`
- Native `DataView` types (`int8`–`uint64`, `float32`, `float64`) not reimplemented here — callers use `DataView` directly
- `float16`: `DataView.getFloat16` with feature-detected fallback
- `bfloat16`: shared-`ArrayBuffer` trick
- Sub-byte floats: lookup tables
- `int128`, `float80`, `float128`: stub with `RangeError`

**`src/detect.ts`** — magic-byte format detection:

```ts
type Format = "onnx" | "tflite" | "unknown";
function detectFormat(bytes: Uint8Array, filename?: string): Format;
```

- TFLite: `ODLF` magic at offset 4
- ONNX: protobuf field tag `0x08` at byte 0, or `.onnx` extension
- Magic bytes take priority over extension

**`src/transform.ts`** — framework-agnostic IR → graph layout (shared by all renderer packages):

```ts
export type GraphNodeData = {
  opType: string;
  name: string;
  inputs: string[];
  outputs: string[];
  attributes: Record<string, AttributeValue>;
};
function modelGraphToFlow(graph: ModelGraph): { nodes: Node<GraphNodeData>[]; edges: Edge[] };
```

- Each `GraphNode` → node with `type: 'graphNode'`
- Each output→input connection → edge
- `ModelGraph.inputs` / `.outputs` → nodes with `type: 'ioNode'`
- Runs dagre layout: top-to-bottom, 180×60 px node estimate
- Returns nodes with `position` filled in

**`src/index.ts`** — unified entry point:

```ts
async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;
```

- Uses `detectFormat`, dynamically imports `@wetron/onnx` or `@wetron/tflite`
- Throws `ParseError` if format is unknown
- Also re-exports `modelGraphToFlow` and `GraphNodeData`

---

### `@wetron/onnx`

**`src/onnx.proto`** — official ONNX proto bundled in the package (fetched from ONNX GitHub, committed to repo).

**`src/parse.ts`**:

```ts
async function parseOnnx(bytes: Uint8Array): Promise<ModelGraph>;
```

- Uses `protobufjs` to load `onnx.proto` at runtime
- Deserializes graph structure only — skips initializers >1 KB
- Maps ONNX dtypes to plain strings (`"float32"`, `"int64"`, etc.)
- Extracts node attributes as `AttributeValue`
- Throws `ParseError` with context on failure
- No `any` in public API

---

### `@wetron/tflite`

**`src/parse.ts`**:

```ts
function parseTflite(bytes: Uint8Array): ModelGraph;
```

- Sync — FlatBuffers needs no async
- Uses `flatbuffers` npm ByteBuffer API
- TypeScript decoder written against netron's `tflite-schema.js` field layout
- Maps TFLite `BuiltinOperator` enum codes to string names
- Extracts tensor shapes and dtypes
- Skips weight data entirely
- Throws `ParseError` on malformed input

---

### `@wetron/react`

**`src/ModelGraphView.tsx`**:

- Props: `graph: ModelGraph`, `onNodeClick?: (node: GraphNode) => void`
- Calls `modelGraphToFlow` from `@wetron/core` internally
- Renders `<ReactFlow>`, `<MiniMap>`, `<Controls>`, `<Background>`
- Two custom node types:
  - `graphNode`: rounded rect, bold `opType`, muted `name`, dtype badges on inputs/outputs
  - `ioNode`: distinct color (info/success semantic), shows tensor shape
- `fitView` on mount via `useReactFlow()`
- Fires `onNodeClick` with original `GraphNode` on selection

**`src/index.ts`** — exports `ModelGraphView`

---

### `@wetron/svelte`

**`src/ModelGraphView.svelte`**:

- Same props as React variant: `graph: ModelGraph`, `onNodeClick?: (node: GraphNode) => void`
- Calls `modelGraphToFlow` from `@wetron/core` internally
- Renders using `@xyflow/svelte` with `<SvelteFlow>`, `<MiniMap>`, `<Controls>`, `<Background>`
- Two custom node types mirroring the React variants (`graphNode`, `ioNode`)
- `fitView` on mount
- Fires `onNodeClick` on node selection

**`src/index.ts`** — exports `ModelGraphView`

---

## Error Handling

- `ParseError` (defined in `@wetron/core`) carries `format: string` and `context: string`
- `detectFormat` returns `"unknown"` — never throws
- `parseModel` throws `ParseError` on unknown format
- Parsers throw `ParseError` for truncated files, unknown op types, missing required fields

---

## Testing

Bun's built-in test runner (`bun test`) across all packages. All test files use `import { test, expect } from "bun:test"`.

- **`@wetron/onnx`**: assert `ModelGraph` shape from `test-models/mnist-12.onnx` — node count, input/output names + shapes, no undefined `opType`
- **`@wetron/tflite`**: same pattern against a sample `.tflite`
- **`@wetron/react`**: `@testing-library/react` — parse ONNX model, render `<ModelGraphView>`, assert node count
- No `any` in public API surface across all packages

---

## Browser-Only Constraints

Applied throughout all phases:

- `File.arrayBuffer()` for file inputs — no `FileReader`
- `fetch().arrayBuffer()` for URLs — no `XMLHttpRequest`
- `TextDecoder`/`TextEncoder` — no manual UTF-8 loops
- `DecompressionStream` for zip/gzip — no bundled decompressors
- `DataView` for binary reads — no `BinaryStream` wrappers
- No `DataView.prototype` or `BigInt.prototype` patches
- `BigInt` → `number` via standalone `bigIntToNumber(v)` utility (throws `RangeError` if out of safe range)

---

## Phases

| Phase | Package          | Deliverable                                                  |
| ----- | ---------------- | ------------------------------------------------------------ |
| 0     | —                | Repo scaffold (Bun workspaces, tsconfig, package.json files) |
| 1     | `@wetron/core`   | `ir.ts`, `dtypes.ts`                                         |
| 2     | `@wetron/onnx`   | `parse.ts` + tests                                           |
| 3     | `@wetron/tflite` | `parse.ts` + tests                                           |
| 4     | `@wetron/core`   | `detect.ts`, `transform.ts`                                  |
| 5     | `@wetron/react`  | `ModelGraphView.tsx`, `index.ts`, tests                      |
| 6     | `@wetron/svelte` | `ModelGraphView.svelte`, `index.ts`, tests                   |
| 7     | `@wetron/core`   | `index.ts` (unified entry)                                   |

---

## Checkpoints After Each Phase

- [ ] `parseOnnx` / `parseTflite` round-trips test models without throwing
- [ ] Node count matches netron UI for the same file
- [ ] No `any` in public API surface
- [ ] `bun test` passes clean
- [ ] After Phase 5: `<ModelGraphView>` renders visibly in a browser with correct node count
