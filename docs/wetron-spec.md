# netron-parser — Implementation Plan

A TypeScript monorepo: parsers for ONNX + TFLite, shared IR, and a React rendering layer using ReactFlow.

---

## Goal

A TypeScript monorepo with three publishable packages:

- `@netron-parser/core` — shared IR types, format detection, unified entry point
- `@netron-parser/onnx` — ONNX parser
- `@netron-parser/tflite` — TFLite parser
- `@netron-parser/react` — ReactFlow rendering layer

Graph structure only — no weight deserialization.

---

## Phase 0 — Repo setup (you, ~30 min)

```bash
mkdir netron-parser && cd netron-parser
pnpm init
pnpm add -D typescript tsx vitest @types/node
pnpm add protobufjs flatbuffers
pnpm add reactflow @reactflow/layout dagre @types/dagre
pnpm add react react-dom @types/react @types/react-dom
```

Monorepo layout:

```
netron-parser/
  packages/
    core/         # shared IR types + format detection
    onnx/         # ONNX parser
    tflite/       # TFLite parser
    react/        # ReactFlow rendering layer
  test-models/    # .onnx and .tflite files
```

Grab test models:

- ONNX: `wget https://github.com/onnx/models/raw/main/validated/vision/classification/mnist/model/mnist-12.onnx`
- TFLite: any `.tflite` from https://www.tensorflow.org/lite/models

---

## Phase 1 — Shared IR (Claude Code, ~1 session)

Create `packages/core/src/ir.ts`:

> Define a minimal TypeScript IR for a neural network graph. Requirements:
>
> - `ModelGraph` with `name`, `inputs`, `outputs`, `nodes`
> - `GraphNode` with `name`, `opType`, `inputs: string[]`, `outputs: string[]`, `attributes: Record<string, AttributeValue>`
> - `GraphValue` with `name`, `shape: number[] | null`, `dtype: string | null`
> - `AttributeValue` = union of `string | number | boolean | number[] | string[]`
> - Everything readonly
> - No dependencies outside this file

Review carefully — this interface is load-bearing for everything else.

---

## Phase 2 — ONNX parser (Claude Code, ~1–2 sessions)

**Session 1 — codegen:**

> I have `onnx.proto` from the ONNX repo (attach it). Generate a `protobufjs`-based TypeScript parser in `packages/onnx/src/parse.ts` that:
>
> - Exports `parseOnnx(bytes: Uint8Array): Promise<ModelGraph>`
> - Uses the `ModelGraph` IR from `@netron-parser/core`
> - Deserializes graph structure only — skip tensor data, skip initializers larger than 1KB
> - Maps ONNX dtypes to plain strings (`"float32"`, `"int64"`, etc.)
> - Extracts node attributes as `AttributeValue`
> - Throws a typed `ParseError` with context on failure

**Session 2 — tests:**

> Write Vitest tests for `parseOnnx` using the file at `test-models/mnist-12.onnx`. Tests should assert:
>
> - Returns a `ModelGraph`
> - Has the correct number of nodes
> - Input/output names and shapes are correct
> - No node has undefined opType
>
> Run them and fix failures.

---

## Phase 3 — TFLite parser (Claude Code, ~1 session)

> I have `schema.fbs` from the TensorFlow Lite repo (attach it). Generate a TypeScript parser in `packages/tflite/src/parse.ts` that:
>
> - Exports `parseTflite(bytes: Uint8Array): ModelGraph` (sync — FlatBuffers needs no async)
> - Uses the same `ModelGraph` IR from `@netron-parser/core`
> - Uses the `flatbuffers` npm package for deserialization
> - Maps TFLite builtin op codes to string names using the `BuiltinOperator` enum from the schema
> - Extracts tensor shapes and dtypes
> - Skips weight data entirely
>
> Then write Vitest tests against `test-models/your-model.tflite`.

---

## Phase 4 — Format detection (Claude Code, ~30 min)

> Write `packages/core/src/detect.ts` that exports:
>
> ```ts
> type Format = "onnx" | "tflite" | "unknown";
> function detectFormat(bytes: Uint8Array, filename?: string): Format;
> ```
>
> Detection rules:
>
> - TFLite: FlatBuffers magic bytes at offset 4 (`ODLF`)
> - ONNX: protobuf field tag `0x08` at byte 0, or `.onnx` extension
> - Prefer magic bytes over extension

---

## Phase 5 — ReactFlow renderer (Claude Code, ~1–2 sessions)

**Session 1 — IR → ReactFlow transform + layout:**

> Write `packages/react/src/transform.ts` that exports:
>
> ```ts
> function modelGraphToFlow(graph: ModelGraph): {
>   nodes: Node<GraphNodeData>[];
>   edges: Edge[];
> };
> ```
>
> Requirements:
>
> - Each `GraphNode` becomes a ReactFlow `Node` with `type: 'graphNode'`
> - Each connection between a `GraphNode` output and another `GraphNode` input becomes an `Edge`
> - `ModelGraph.inputs` become nodes with `type: 'ioNode'` and a distinct style
> - `ModelGraph.outputs` same
> - `GraphNodeData` should carry `opType`, `name`, `inputs`, `outputs`, `attributes`
> - After building nodes/edges, run dagre layout:
>   - Direction: top-to-bottom
>   - Node size estimate: 180px wide, 60px tall
>   - Return nodes with `position` filled in

**Session 2 — React component:**

> Write `packages/react/src/ModelGraphView.tsx`:
>
> - Props: `graph: ModelGraph`, `onNodeClick?: (node: GraphNode) => void`
> - Calls `modelGraphToFlow` internally
> - Renders with `<ReactFlow>`, `<MiniMap>`, `<Controls>`, `<Background>`
> - Registers two custom node types:
>   - `graphNode`: rounded rect, bold `opType` label, muted `name` below, small dtype badges on inputs/outputs
>   - `ioNode`: distinct color (use info/success semantic colors), shows tensor shape
> - Calls `onNodeClick` with the original `GraphNode` when a node is selected
> - Fits view on mount via `useReactFlow().fitView()`
> - Export as default, export `GraphNodeData` type

**Session 3 — wiring:**

> Write `packages/react/src/index.ts` that exports:
>
> - `ModelGraphView` (default + named)
> - `modelGraphToFlow`
> - `GraphNodeData`
>
> Write a minimal `packages/react/test/ModelGraphView.test.tsx` using `@testing-library/react` that:
>
> - Parses `test-models/mnist-12.onnx`
> - Passes the result to `<ModelGraphView>`
> - Asserts the correct number of nodes are rendered

---

## Phase 6 — Unified entry point (Claude Code, ~30 min)

> Write `packages/core/src/index.ts` that exports a single convenience function:
>
> ```ts
> async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph>;
> ```
>
> - Uses `detectFormat` to pick the right parser
> - Dynamically imports `@netron-parser/onnx` or `@netron-parser/tflite` so unused parsers are not bundled
> - Throws `ParseError` with format info if detection fails

---

## Checkpoints after each phase

Before moving on, verify manually:

- [ ] `parseOnnx` / `parseTflite` round-trips test models without throwing
- [ ] Node count matches what netron's UI shows for the same file
- [ ] No `any` in the public API surface
- [ ] `pnpm vitest run` passes clean
- [ ] After Phase 5: `<ModelGraphView>` renders visibly in a browser with correct node count

---

## What to watch for

**Over-copying netron internals.** Claude Code will sometimes reproduce netron's `onnx.Context` / `onnx.ProtoReader` nesting if you give it the source as context. Push back: "flatten this, the public API is just `parseOnnx(bytes)`."

**Missing error handling.** First drafts assume well-formed input. Ask explicitly: "add validation for truncated files, unknown op types, and missing required fields."

**ReactFlow node overlap.** Dagre's default node size estimate is often wrong, causing overlapping nodes. If this happens: "the nodes are overlapping — increase the dagre node width to 200 and height to 80 and rerun layout."

**Large graph performance.** For models with 500+ nodes ReactFlow will get sluggish. Not a concern for the initial use case but if it comes up: "add a `maxNodes` prop that truncates the graph and shows a warning banner."

---

## Appendix — Lean on the platform

Apply these throughout all phases. When Claude Code produces a hand-rolled implementation of something below, push back and use the native version instead.

### Binary parsing — no manual type definitions

Netron defines its own `BinaryStream`, patches `DataView.prototype` with a large family of custom numeric types, and monkey-patches `BigInt.prototype`. You don't need most of this. The full dtype registry it ships covers three tiers.

#### Tier 1 — Native `DataView`, no shim needed

Use directly in parsers. Do not reimplement.

| Type      | `DataView` method | Notes                                                             |
| --------- | ----------------- | ----------------------------------------------------------------- |
| `int8`    | `getInt8`         | baseline                                                          |
| `int16`   | `getInt16`        | baseline                                                          |
| `int32`   | `getInt32`        | baseline                                                          |
| `int64`   | `getBigInt64`     | baseline Chrome 67+                                               |
| `uint8`   | `getUint8`        | baseline                                                          |
| `uint16`  | `getUint16`       | baseline                                                          |
| `uint32`  | `getUint32`       | baseline                                                          |
| `uint64`  | `getBigUint64`    | baseline                                                          |
| `float32` | `getFloat32`      | baseline                                                          |
| `float64` | `getFloat64`      | baseline                                                          |
| `float16` | `getFloat16`      | Chrome 120+, Safari 18.2+ — feature-detect, shim only as fallback |

`getBigInt64` / `getBigUint64` return `BigInt`, not `number`. Netron patches `BigInt.prototype.toNumber()` for this — don't do that. Use a standalone utility instead:

```ts
function bigIntToNumber(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER))
    throw new RangeError(`64-bit value 0x${v.toString(16)} exceeds safe integer`);
  return Number(v);
}
```

Zero-copy slices work natively too — no `BinaryStream` wrapper needed:

```ts
const view = new DataView(bytes.buffer);
const chunk = new Uint8Array(bytes.buffer, offset, length); // zero copy
```

#### Tier 2 — Needs a shim, scoped to `dtypes.ts`

Real deployed formats (PyTorch quantization, ONNX INT4, OCP MX floats). All go in `packages/core/src/dtypes.ts` as standalone exported functions. Never patch `DataView.prototype`.

| Type                                                                                   | Bytes | What it is                                            | Shim strategy                           |
| -------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------- | --------------------------------------- |
| `bfloat16`                                                                             | 2     | Upper 16 bits of float32, used everywhere in training | Shared `ArrayBuffer` trick — 3 lines    |
| `float8e4m3fn`                                                                         | 1     | OCP MX float8, H100 training                          | Bit manipulation → float32              |
| `float8e5m2`                                                                           | 1     | OCP MX float8 variant                                 | Same                                    |
| `float8e4m3fnuz`, `float8e5m2fnuz`, `float8e4m3b11fnuz`, `float8e3m4`, `float8e8m0fnu` | 1     | Various float8 dialects                               | Same family — port from netron as-is    |
| `float4e2m1fn`                                                                         | 0.5   | MX float4, two values packed per byte                 | 16-entry lookup table                   |
| `float6e2m3fn`, `float6e3m2fn`                                                         | 0.75  | MX float6, sub-byte packed                            | Same pattern                            |
| `int4` / `uint4`                                                                       | 0.5   | ONNX quantization, sub-byte                           | `readUintBits(view, byteOffset, 4, le)` |
| `quint4x2`, `quint2x4`                                                                 | 1     | Packed quantized — two/four values per byte           | Same `readUintBits` with bit offset     |
| `int48`                                                                                | 6     | Obscure, some ONNX ops                                | `uint32 + uint16` — port from netron    |

The `bfloat16` shim for reference:

```ts
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
export function readBfloat16(view: DataView, offset: number, le: boolean): number {
  _u32[0] = view.getUint16(offset, le) << 16;
  return _f32[0];
}
```

#### Tier 3 — Stub with `RangeError`, revisit if needed

Not encountered in ONNX or TFLite graphs in practice.

| Type                  | Notes                                          |
| --------------------- | ---------------------------------------------- |
| `int128` / `uint128`  | Only appears in some MLIR/TOSA ops             |
| `float80`             | x87 extended precision — not used in ML models |
| `float128`            | Theoretical — not used in ML models            |
| `complex<float32/64>` | Port as pairs of primitives if needed          |

### Compression / archive handling

Netron ships its own `zip.js` and `tar.js`. Use the platform instead:

```ts
const ds = new DecompressionStream("deflate-raw"); // or 'gzip', 'deflate'
const decompressed = await new Response(stream.pipeThrough(ds)).arrayBuffer();
```

`DecompressionStream` is baseline across Chrome, Firefox, Safari. No dependency needed.

### File / stream I/O

Netron uses `XMLHttpRequest` and `FileReader` everywhere. Both are legacy.

```ts
// fetch a remote model
const bytes = new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()));

// read a File from an <input> or drag-drop
const bytes = new Uint8Array(await file.arrayBuffer());

// stream a large file without loading it all
const reader = file.stream().getReader();
```

No `FileReader`, no `XMLHttpRequest`, no callback hell.

### Text encoding / decoding

Netron has manual UTF-8 decode loops in several parsers. Use:

```ts
const decoder = new TextDecoder("utf-8");
const str = decoder.decode(uint8array);

const encoder = new TextEncoder();
const bytes = encoder.encode(str);
```

Both are available in workers too.

### Protobuf / FlatBuffers

Don't use netron's hand-rolled `protobuf.js` or `flatbuffers.js`. Use the canonical packages:

```ts
import protobuf from "protobufjs"; // or protobufjs/light for smaller bundle
import { ByteBuffer } from "flatbuffers";
```

Both handle `Uint8Array` input directly, no wrapper needed.

### Worker communication

For Darkroom's use case (desktop Tauri app, single model at a time) dagre layout for a typical model takes <50ms on the main thread — a worker is not worth the complexity. If you ever need one:

```ts
const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
  type: "module",
});
```

### `dtypes.ts` prompt for Claude Code

> Write `packages/core/src/dtypes.ts`. Do not patch `DataView.prototype`. Export individual functions: `readFloat16`, `readBfloat16`, `readFloat8e4m3fn`, `readFloat8e5m2`, `readFloat4e2m1`, `readInt4`, `readUint4`, `readIntBits(view, byteOffset, bits, le)`, `readUintBits(view, byteOffset, bits, le)`. For types natively supported by `DataView` (`int8` through `uint64`, `float32`, `float64`) do not reimplement them here — callers use `DataView` directly. For `float16` use `DataView.getFloat16` with a feature-detected fallback. Use lookup tables for sub-byte float types. Use the shared-`ArrayBuffer` trick for `bfloat16`. Stub `int128`, `float80`, `float128` with a thrown `RangeError`.

### Instruction to add to every Claude Code session

Append this to every prompt in Phases 2–5:

> Prefer native Web Platform APIs over hand-rolled implementations. Use `DataView` for binary reads, `fetch` + `.arrayBuffer()` for I/O, `file.arrayBuffer()` for File inputs, `TextDecoder`/`TextEncoder` for strings, and `DecompressionStream` for zip/gzip. Do not patch `DataView.prototype` or `BigInt.prototype`. For exotic numeric types (`bfloat16`, `float8*`, `float4*`, `int4`, `uint4`, sub-byte packed types) import from `@netron-parser/core/dtypes` — do not inline shims in parsers.
