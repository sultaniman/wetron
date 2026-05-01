# wetron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript monorepo with ONNX + TFLite parsers, shared IR, and React/Svelte rendering layers under the `@wetron/` scope.

**Architecture:** Five workspace packages — `@wetron/core` (IR, dtypes, detect, transform, unified entry), `@wetron/onnx` (protobufjs parser), `@wetron/tflite` (flatbuffers decoder), `@wetron/react` (@xyflow/react renderer), `@wetron/svelte` (@xyflow/svelte renderer). All parsers output the same readonly `ModelGraph` IR. Layout (dagre) lives in core, shared by both renderers.

**Tech Stack:** Bun workspaces + runtime, TypeScript 5, protobufjs/light (ONNX), flatbuffers npm (TFLite), dagre, @xyflow/react v12, @xyflow/svelte, @testing-library/react, happy-dom, bun:test

---

## File Map

```
packages/
  core/
    src/
      ir.ts              ModelGraph, GraphNode, GraphValue, AttributeValue, ParseError
      dtypes.ts          readFloat16/bfloat16/float8*/int4/uint4/intBits/uintBits
      detect.ts          detectFormat(bytes, filename?): Format
      transform.ts       modelGraphToFlow, FlowNode, FlowEdge, GraphNodeData
      index.ts           parseModel (dynamic imports), re-exports
    test/
      ir.test.ts
      dtypes.test.ts
      detect.test.ts
      transform.test.ts
    package.json
    tsconfig.json
  onnx/
    src/
      onnx.proto         official ONNX proto (downloaded, committed)
      onnx-descriptor.json  compiled by pbjs (committed)
      parse.ts           parseOnnx(bytes): Promise<ModelGraph>
    test/
      parse.test.ts
    package.json
    tsconfig.json
  tflite/
    src/
      builtin-ops.ts     BUILTIN_OP_NAMES: Record<number, string>
      tensor-types.ts    TENSOR_TYPE_NAMES: Record<number, string>
      parse.ts           parseTflite(bytes): ModelGraph
    test/
      parse.test.ts
    package.json
    tsconfig.json
  react/
    src/
      nodes/
        GraphNode.tsx    custom graphNode component
        IoNode.tsx       custom ioNode component
      ModelGraphView.tsx
      index.ts
    test/
      setup.ts           happy-dom registration
      ModelGraphView.test.tsx
    bunfig.toml
    package.json
    tsconfig.json
  svelte/
    src/
      nodes/
        GraphNode.svelte
        IoNode.svelte
      ModelGraphView.svelte
      index.ts
    package.json
    tsconfig.json
test-models/
  mnist-12.onnx
  mobilenet_v2.tflite
package.json             root workspace config
tsconfig.json            root TS config
```

---

## Task 1: Repo scaffold

**Files:**

- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/onnx/package.json`
- Create: `packages/onnx/tsconfig.json`
- Create: `packages/tflite/package.json`
- Create: `packages/tflite/tsconfig.json`
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/bunfig.toml`
- Create: `packages/svelte/package.json`
- Create: `packages/svelte/tsconfig.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/core/src packages/core/test
mkdir -p packages/onnx/src packages/onnx/test
mkdir -p packages/tflite/src packages/tflite/test
mkdir -p packages/react/src/nodes packages/react/test
mkdir -p packages/svelte/src/nodes
mkdir -p test-models
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "wetron",
  "private": true,
  "workspaces": ["packages/*"],
  "devDependencies": {
    "typescript": "^5.8.0",
    "protobufjs-cli": "^1.1.3",
    "@types/dagre": "^0.7.48",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 3: Write root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Write `packages/core/package.json`**

```json
{
  "name": "@wetron/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./ir": "./src/ir.ts",
    "./dtypes": "./src/dtypes.ts",
    "./detect": "./src/detect.ts",
    "./transform": "./src/transform.ts"
  },
  "dependencies": {
    "dagre": "^0.8.5"
  }
}
```

- [ ] **Step 5: Write `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 6: Write `packages/onnx/package.json`**

```json
{
  "name": "@wetron/onnx",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/parse.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*",
    "protobufjs": "^7.4.0"
  }
}
```

- [ ] **Step 7: Write `packages/onnx/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 8: Write `packages/tflite/package.json`**

```json
{
  "name": "@wetron/tflite",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/parse.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*",
    "flatbuffers": "^24.3.25"
  }
}
```

- [ ] **Step 9: Write `packages/tflite/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 10: Write `packages/react/package.json`**

```json
{
  "name": "@wetron/react",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "^15.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@xyflow/react": "^12.0.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18",
    "@xyflow/react": ">=12"
  }
}
```

- [ ] **Step 11: Write `packages/react/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 12: Write `packages/react/bunfig.toml`**

```toml
[test]
preload = ["./test/setup.ts"]
```

- [ ] **Step 13: Write `packages/svelte/package.json`**

```json
{
  "name": "@wetron/svelte",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*"
  },
  "peerDependencies": {
    "@xyflow/svelte": ">=1",
    "svelte": ">=5"
  }
}
```

- [ ] **Step 14: Write `packages/svelte/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 15: Install all dependencies**

```bash
bun install
```

Expected: lock file created, all workspace packages linked, `node_modules` populated.

- [ ] **Step 16: Download test models**

```bash
curl -L -o test-models/mnist-12.onnx \
  "https://github.com/onnx/models/raw/main/validated/vision/classification/mnist/model/mnist-12.onnx"

curl -L -o test-models/mobilenet_v2.tflite \
  "https://storage.googleapis.com/mediapipe-models/image_classifier/mobilenet_v2/float32/1/mobilenet_v2.tflite"
```

Expected: two files in `test-models/`, each > 0 bytes.

- [ ] **Step 17: Commit**

```bash
git add package.json tsconfig.json packages/ test-models/
git commit -m "chore: repo scaffold — packages, tsconfigs, test models"
```

---

## Task 2: Core IR types

**Files:**

- Create: `packages/core/src/ir.ts`
- Create: `packages/core/test/ir.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/test/ir.test.ts`:

```typescript
import { test, expect } from "bun:test";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "../src/ir.ts";
import { ParseError } from "../src/ir.ts";

test("ParseError has correct shape", () => {
  const err = new ParseError("onnx", "bad magic bytes");
  expect(err).toBeInstanceOf(Error);
  expect(err.format).toBe("onnx");
  expect(err.context).toBe("bad magic bytes");
  expect(err.message).toBe("[onnx] bad magic bytes");
  expect(err.name).toBe("ParseError");
});

test("ModelGraph type is assignable", () => {
  const node: GraphNode = {
    name: "conv1",
    opType: "Conv",
    inputs: ["x", "w"],
    outputs: ["y"],
    attributes: { group: 1, dilations: [1, 1] },
  };
  const value: GraphValue = { name: "x", shape: [1, 3, 224, 224], dtype: "float32" };
  const graph: ModelGraph = {
    name: "test",
    inputs: [value],
    outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
    nodes: [node],
  };
  expect(graph.nodes.length).toBe(1);
  expect(graph.nodes[0].opType).toBe("Conv");
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd packages/core && bun test test/ir.test.ts
```

Expected: `FAIL` — `Cannot find module '../src/ir.ts'`

- [ ] **Step 3: Write `packages/core/src/ir.ts`**

```typescript
export type AttributeValue = string | number | boolean | number[] | string[];

export interface GraphValue {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
}

export interface GraphNode {
  readonly name: string;
  readonly opType: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

export interface ModelGraph {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
}

export class ParseError extends Error {
  constructor(
    public readonly format: string,
    public readonly context: string,
  ) {
    super(`[${format}] ${context}`);
    this.name = "ParseError";
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd packages/core && bun test test/ir.test.ts
```

Expected: `PASS` — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir.ts packages/core/test/ir.test.ts
git commit -m "feat(@wetron/core): add IR types and ParseError"
```

---

## Task 3: Core dtype utilities

**Files:**

- Create: `packages/core/src/dtypes.ts`
- Create: `packages/core/test/dtypes.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/test/dtypes.test.ts`:

```typescript
import { test, expect } from "bun:test";
import {
  readBfloat16,
  readFloat16,
  readInt4,
  readUint4,
  readIntBits,
  readUintBits,
} from "../src/dtypes.ts";

test("readBfloat16 decodes 1.0", () => {
  // 1.0 in bfloat16 = 0x3F80
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, 0x3f80, true); // little-endian
  expect(readBfloat16(view, 0, true)).toBeCloseTo(1.0);
});

test("readBfloat16 decodes -2.0", () => {
  // -2.0 in bfloat16 = 0xC000
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint16(0, 0xc000, true);
  expect(readBfloat16(view, 0, true)).toBeCloseTo(-2.0);
});

test("readInt4 extracts low nibble", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0x3f); // low nibble = 0xf = -1 signed
  expect(readInt4(view, 0, false)).toBe(-1);
  expect(readInt4(view, 0, true)).toBe(3);
});

test("readUint4 extracts nibbles", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0xab);
  expect(readUint4(view, 0, false)).toBe(0xb); // low nibble first
  expect(readUint4(view, 0, true)).toBe(0xa); // high nibble
});

test("readUintBits reads 3 bits at offset 0", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0b10110101);
  expect(readUintBits(view, 0, 0, 3)).toBe(0b101); // bits 0-2
});

test("readIntBits reads signed 4-bit value", () => {
  const buf = new ArrayBuffer(1);
  const view = new DataView(buf);
  view.setUint8(0, 0xff);
  expect(readIntBits(view, 0, 0, 4)).toBe(-1);
});

test("readFloat16 stub handles native or fallback", () => {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  // 1.0 in float16 = 0x3C00
  view.setUint16(0, 0x3c00, true);
  const val = readFloat16(view, 0, true);
  expect(val).toBeCloseTo(1.0, 2);
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && bun test test/dtypes.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write `packages/core/src/dtypes.ts`**

```typescript
// Shared ArrayBuffer trick for bfloat16
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

export function readBfloat16(view: DataView, offset: number, le: boolean): number {
  _u32[0] = view.getUint16(offset, le) << 16;
  return _f32[0];
}

// Float16 — use DataView.getFloat16 if available, otherwise manual decode
const _hasNativeFloat16 = typeof DataView.prototype.getFloat16 === "function";

export function readFloat16(view: DataView, offset: number, le: boolean): number {
  if (_hasNativeFloat16) {
    return (view as any).getFloat16(offset, le) as number;
  }
  const u16 = view.getUint16(offset, le);
  const sign = (u16 >> 15) & 1;
  const exp = (u16 >> 10) & 0x1f;
  const frac = u16 & 0x3ff;
  if (exp === 0x1f) return frac ? NaN : sign ? -Infinity : Infinity;
  if (exp === 0) {
    const val = (frac / 1024) * Math.pow(2, -14);
    return sign ? -val : val;
  }
  const val = (1 + frac / 1024) * Math.pow(2, exp - 15);
  return sign ? -val : val;
}

// Float8 lookup tables (e4m3fn)
const _float8e4m3fn: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const sign = (i >> 7) & 1;
    const exp = (i >> 3) & 0xf;
    const man = i & 0x7;
    let val: number;
    if (exp === 0xf && man === 0x7) {
      val = NaN;
    } else if (exp === 0) {
      val = (man / 8) * Math.pow(2, -6);
    } else {
      val = (1 + man / 8) * Math.pow(2, exp - 7);
    }
    t[i] = sign ? -val : val;
  }
  return t;
})();

export function readFloat8e4m3fn(view: DataView, offset: number): number {
  return _float8e4m3fn[view.getUint8(offset)];
}

// Float8 e5m2
const _float8e5m2: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const sign = (i >> 7) & 1;
    const exp = (i >> 2) & 0x1f;
    const man = i & 0x3;
    let val: number;
    if (exp === 0x1f) {
      val = man === 0 ? Infinity : NaN;
    } else if (exp === 0) {
      val = (man / 4) * Math.pow(2, -14);
    } else {
      val = (1 + man / 4) * Math.pow(2, exp - 15);
    }
    t[i] = sign ? -val : val;
  }
  return t;
})();

export function readFloat8e5m2(view: DataView, offset: number): number {
  return _float8e5m2[view.getUint8(offset)];
}

// Float4 e2m1 — 16-entry lookup table
const _float4e2m1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6, -0, -0.5, -1, -1.5, -2, -3, -4, -6];

export function readFloat4e2m1(view: DataView, byteOffset: number, highNibble: boolean): number {
  const byte = view.getUint8(byteOffset);
  const nibble = highNibble ? (byte >> 4) & 0xf : byte & 0xf;
  return _float4e2m1[nibble];
}

// Sub-byte integer reads
export function readUint4(view: DataView, byteOffset: number, highNibble: boolean): number {
  const byte = view.getUint8(byteOffset);
  return highNibble ? (byte >> 4) & 0xf : byte & 0xf;
}

export function readInt4(view: DataView, byteOffset: number, highNibble: boolean): number {
  const u = readUint4(view, byteOffset, highNibble);
  return u >= 8 ? u - 16 : u;
}

// Generic bit-level reads (cross-byte not supported — operates within a single byte)
export function readUintBits(
  view: DataView,
  byteOffset: number,
  bitOffset: number,
  bits: number,
): number {
  const byte = view.getUint8(byteOffset);
  return (byte >> bitOffset) & ((1 << bits) - 1);
}

export function readIntBits(
  view: DataView,
  byteOffset: number,
  bitOffset: number,
  bits: number,
): number {
  const u = readUintBits(view, byteOffset, bitOffset, bits);
  const signBit = 1 << (bits - 1);
  return u >= signBit ? u - (signBit << 1) : u;
}

// Tier-3 stubs
export function readInt128(_view: DataView, _offset: number): never {
  throw new RangeError("int128 is not supported");
}

export function readFloat80(_view: DataView, _offset: number): never {
  throw new RangeError("float80 is not supported");
}

export function readFloat128(_view: DataView, _offset: number): never {
  throw new RangeError("float128 is not supported");
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd packages/core && bun test test/dtypes.test.ts
```

Expected: `PASS` — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dtypes.ts packages/core/test/dtypes.test.ts
git commit -m "feat(@wetron/core): add dtype utilities"
```

---

## Task 4: Acquire ONNX proto and generate descriptor

**Files:**

- Create: `packages/onnx/src/onnx.proto`
- Create: `packages/onnx/src/onnx-descriptor.json`

- [ ] **Step 1: Download the official ONNX proto**

```bash
curl -L -o packages/onnx/src/onnx.proto \
  "https://raw.githubusercontent.com/onnx/onnx/main/onnx/onnx.proto"
```

Expected: `packages/onnx/src/onnx.proto` exists and is ~20KB.

- [ ] **Step 2: Compile proto to JSON descriptor**

```bash
bunx pbjs -t json packages/onnx/src/onnx.proto \
  -o packages/onnx/src/onnx-descriptor.json
```

Expected: `packages/onnx/src/onnx-descriptor.json` exists and is ~100KB. If `pbjs` errors about imports, check that `onnx.proto` has no `import` statements (the ONNX proto is self-contained).

- [ ] **Step 3: Commit**

```bash
git add packages/onnx/src/onnx.proto packages/onnx/src/onnx-descriptor.json
git commit -m "chore(@wetron/onnx): add ONNX proto and compiled descriptor"
```

---

## Task 5: ONNX parser

**Files:**

- Create: `packages/onnx/src/parse.ts`
- Create: `packages/onnx/test/parse.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/onnx/test/parse.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { parseOnnx } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);

test("parseOnnx returns a ModelGraph from mnist-12", async () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = await parseOnnx(bytes);
  expect(graph.name).toBeDefined();
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});

test("every node has a non-empty opType", async () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = await parseOnnx(bytes);
  for (const node of graph.nodes) {
    expect(node.opType).toBeTruthy();
  }
});

test("graph inputs have shape and dtype", async () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = await parseOnnx(bytes);
  const input = graph.inputs[0];
  expect(input.name).toBeTruthy();
  expect(input.shape).not.toBeNull();
  expect(input.dtype).toBe("float32");
});

test("graph outputs have shape and dtype", async () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = await parseOnnx(bytes);
  const output = graph.outputs[0];
  expect(output.shape).not.toBeNull();
  expect(output.dtype).toBe("float32");
});

test("parseOnnx throws ParseError on garbage input", async () => {
  const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  await expect(parseOnnx(bad)).rejects.toBeInstanceOf(ParseError);
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/onnx && bun test test/parse.test.ts
```

Expected: `FAIL` — `Cannot find module '../src/parse.ts'`

- [ ] **Step 3: Write `packages/onnx/src/parse.ts`**

```typescript
import { Root } from "protobufjs/light";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import descriptor from "./onnx-descriptor.json" with { type: "json" };

let _root: Root | null = null;
function getRoot(): Root {
  if (!_root) _root = Root.fromJSON(descriptor as Parameters<typeof Root.fromJSON>[0]);
  return _root;
}

function longToNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") {
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER))
      throw new RangeError(`int64 value exceeds safe integer range`);
    return Number(v);
  }
  if (v && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v);
}

const ONNX_DTYPE: Record<number, string> = {
  1: "float32",
  2: "uint8",
  3: "int8",
  4: "uint16",
  5: "int16",
  6: "int32",
  7: "int64",
  8: "string",
  9: "bool",
  10: "float16",
  11: "float64",
  12: "uint32",
  13: "uint64",
  14: "complex64",
  15: "complex128",
  16: "bfloat16",
};

function mapAttribute(a: Record<string, unknown>): AttributeValue {
  const type = a["type"] as number;
  switch (type) {
    case 1:
      return Number(a["f"] ?? 0);
    case 2:
      return longToNumber(a["i"] ?? 0);
    case 3: {
      const s = a["s"];
      if (s instanceof Uint8Array) return new TextDecoder().decode(s);
      return String(s ?? "");
    }
    case 6:
      return Array.from((a["floats"] as number[] | null) ?? []).map(Number);
    case 7:
      return Array.from((a["ints"] as unknown[] | null) ?? []).map(longToNumber);
    case 8:
      return ((a["strings"] as Uint8Array[] | null) ?? []).map((b) => new TextDecoder().decode(b));
    default:
      return "";
  }
}

function mapValueInfo(vi: Record<string, unknown>): GraphValue {
  const name = String(vi["name"] ?? "");
  const type = vi["type"] as Record<string, unknown> | null;
  const tt = type?.["tensorType"] as Record<string, unknown> | null;
  if (!tt) return { name, shape: null, dtype: null };
  const shape = tt["shape"] as Record<string, unknown> | null;
  const dims = (shape?.["dim"] as Array<Record<string, unknown>> | null) ?? null;
  return {
    name,
    shape: dims ? dims.map((d) => (d["dimParam"] ? -1 : longToNumber(d["dimValue"] ?? 0))) : null,
    dtype: ONNX_DTYPE[tt["elemType"] as number] ?? "unknown",
  };
}

export async function parseOnnx(bytes: Uint8Array): Promise<ModelGraph> {
  const root = getRoot();
  const ModelProto = root.lookupType("onnx.ModelProto");

  let decoded: Record<string, unknown>;
  try {
    decoded = ModelProto.decode(bytes).toJSON() as Record<string, unknown>;
  } catch (e) {
    throw new ParseError(
      "onnx",
      `Protobuf decode failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const graph = decoded["graph"] as Record<string, unknown> | null;
  if (!graph) throw new ParseError("onnx", "Model has no graph");

  const rawNodes = (graph["node"] as Array<Record<string, unknown>> | null) ?? [];
  const nodes: GraphNode[] = rawNodes.map((n) => ({
    name: String(n["name"] ?? ""),
    opType: String(n["opType"] ?? ""),
    inputs: ((n["input"] as string[] | null) ?? []).map(String),
    outputs: ((n["output"] as string[] | null) ?? []).map(String),
    attributes: Object.fromEntries(
      ((n["attribute"] as Array<Record<string, unknown>> | null) ?? []).map((a) => [
        String(a["name"] ?? ""),
        mapAttribute(a),
      ]),
    ),
  }));

  const rawInputs = (graph["input"] as Array<Record<string, unknown>> | null) ?? [];
  const rawOutputs = (graph["output"] as Array<Record<string, unknown>> | null) ?? [];

  // Filter out initializers (they also appear in graph.input but are not real inputs)
  const initializerNames = new Set(
    ((graph["initializer"] as Array<Record<string, unknown>> | null) ?? []).map((i) =>
      String(i["name"] ?? ""),
    ),
  );
  const filteredInputs = rawInputs.filter((vi) => !initializerNames.has(String(vi["name"] ?? "")));

  return {
    name: String(graph["name"] ?? decoded["docString"] ?? ""),
    inputs: filteredInputs.map(mapValueInfo),
    outputs: rawOutputs.map(mapValueInfo),
    nodes,
  };
}
```

- [ ] **Step 4: Run the test**

```bash
cd packages/onnx && bun test test/parse.test.ts
```

Expected: All 5 tests pass. If a test fails with a type error on `with { type: 'json' }`, change to `assert { type: 'json' }` (older TypeScript syntax).

- [ ] **Step 5: Commit**

```bash
git add packages/onnx/src/parse.ts packages/onnx/test/parse.test.ts
git commit -m "feat(@wetron/onnx): add ONNX parser with protobufjs"
```

---

## Task 6: TFLite builtin op names and tensor types

**Files:**

- Create: `packages/tflite/src/builtin-ops.ts`
- Create: `packages/tflite/src/tensor-types.ts`

- [ ] **Step 1: Write `packages/tflite/src/builtin-ops.ts`**

Extracted from `netron-main/source/tflite-schema.js` — number-keyed entries only:

```typescript
export const BUILTIN_OP_NAMES: Record<number, string> = {
  0: "ADD",
  1: "AVERAGE_POOL_2D",
  2: "CONCATENATION",
  3: "CONV_2D",
  4: "DEPTHWISE_CONV_2D",
  5: "DEPTH_TO_SPACE",
  6: "DEQUANTIZE",
  7: "EMBEDDING_LOOKUP",
  8: "FLOOR",
  9: "FULLY_CONNECTED",
  10: "HASHTABLE_LOOKUP",
  11: "L2_NORMALIZATION",
  12: "L2_POOL_2D",
  13: "LOCAL_RESPONSE_NORMALIZATION",
  14: "LOGISTIC",
  15: "LSH_PROJECTION",
  16: "LSTM",
  17: "MAX_POOL_2D",
  18: "MUL",
  19: "RELU",
  20: "RELU_N1_TO_1",
  21: "RELU6",
  22: "RESHAPE",
  23: "RESIZE_BILINEAR",
  24: "RNN",
  25: "SOFTMAX",
  26: "SPACE_TO_DEPTH",
  27: "SVDF",
  28: "TANH",
  29: "CONCAT_EMBEDDINGS",
  30: "SKIP_GRAM",
  31: "CALL",
  32: "CUSTOM",
  33: "EMBEDDING_LOOKUP_SPARSE",
  34: "PAD",
  35: "UNIDIRECTIONAL_SEQUENCE_RNN",
  36: "GATHER",
  37: "BATCH_TO_SPACE_ND",
  38: "SPACE_TO_BATCH_ND",
  39: "TRANSPOSE",
  40: "MEAN",
  41: "SUB",
  42: "DIV",
  43: "SQUEEZE",
  44: "UNIDIRECTIONAL_SEQUENCE_LSTM",
  45: "STRIDED_SLICE",
  46: "BIDIRECTIONAL_SEQUENCE_RNN",
  47: "EXP",
  48: "TOPK_V2",
  49: "SPLIT",
  50: "LOG_SOFTMAX",
  51: "DELEGATE",
  52: "BIDIRECTIONAL_SEQUENCE_LSTM",
  53: "CAST",
  54: "PRELU",
  55: "MAXIMUM",
  56: "ARG_MAX",
  57: "MINIMUM",
  58: "LESS",
  59: "NEG",
  60: "PADV2",
  61: "GREATER",
  62: "GREATER_EQUAL",
  63: "LESS_EQUAL",
  64: "SELECT",
  65: "SLICE",
  66: "SIN",
  67: "TRANSPOSE_CONV",
  68: "SPARSE_TO_DENSE",
  69: "TILE",
  70: "EXPAND_DIMS",
  71: "EQUAL",
  72: "NOT_EQUAL",
  73: "LOG",
  74: "SUM",
  75: "SQRT",
  76: "RSQRT",
  77: "SHAPE",
  78: "POW",
  79: "ARG_MIN",
  80: "FAKE_QUANT",
  81: "REDUCE_PROD",
  82: "REDUCE_MAX",
  83: "PACK",
  84: "LOGICAL_OR",
  85: "ONE_HOT",
  86: "LOGICAL_AND",
  87: "LOGICAL_NOT",
  88: "UNPACK",
  89: "REDUCE_MIN",
  90: "FLOOR_DIV",
  91: "REDUCE_ANY",
  92: "SQUARE",
  93: "ZEROS_LIKE",
  94: "FILL",
  95: "FLOOR_MOD",
  96: "RANGE",
  97: "RESIZE_NEAREST_NEIGHBOR",
  98: "LEAKY_RELU",
  99: "SQUARED_DIFFERENCE",
  100: "MIRROR_PAD",
  101: "ABS",
  102: "SPLIT_V",
  103: "UNIQUE",
  104: "CEIL",
  105: "REVERSE_V2",
  106: "ADD_N",
  107: "GATHER_ND",
  108: "COS",
  109: "WHERE",
  110: "RANK",
  111: "ELU",
  112: "REVERSE_SEQUENCE",
  113: "MATRIX_DIAG",
  114: "QUANTIZE",
  115: "MATRIX_SET_DIAG",
  116: "ROUND",
  117: "HARD_SWISH",
  118: "IF",
  119: "WHILE",
  120: "NON_MAX_SUPPRESSION_V4",
  121: "NON_MAX_SUPPRESSION_V5",
  122: "SCATTER_ND",
  123: "SELECT_V2",
  124: "DENSIFY",
  125: "SEGMENT_SUM",
  126: "BATCH_MATMUL",
  127: "PLACEHOLDER_FOR_GREATER_OP_CODES",
  128: "CUMSUM",
  129: "CALL_ONCE",
  130: "BROADCAST_TO",
  131: "RFFT2D",
  132: "CONV_3D",
  133: "IMAG",
  134: "REAL",
  135: "COMPLEX_ABS",
  136: "HASHTABLE",
  137: "HASHTABLE_FIND",
  138: "HASHTABLE_IMPORT",
  139: "HASHTABLE_SIZE",
  140: "REDUCE_ALL",
  141: "CONV_3D_TRANSPOSE",
  142: "VAR_HANDLE",
  143: "READ_VARIABLE",
  144: "ASSIGN_VARIABLE",
  145: "BROADCAST_ARGS",
  146: "RANDOM_STANDARD_NORMAL",
  147: "BUCKETIZE",
  148: "RANDOM_UNIFORM",
  149: "MULTINOMIAL",
  150: "GELU",
  151: "DYNAMIC_UPDATE_SLICE",
  152: "RELU_0_TO_1",
  153: "UNSORTED_SEGMENT_PROD",
  154: "UNSORTED_SEGMENT_MAX",
  155: "UNSORTED_SEGMENT_SUM",
  156: "ATAN2",
  157: "UNSORTED_SEGMENT_MIN",
  158: "SIGN",
  159: "BITCAST",
  160: "BITWISE_XOR",
  161: "RIGHT_SHIFT",
  162: "STABLEHLO_LOGISTIC",
  163: "STABLEHLO_ADD",
  164: "STABLEHLO_DIVIDE",
  165: "STABLEHLO_MULTIPLY",
  166: "STABLEHLO_MAXIMUM",
  167: "STABLEHLO_RESHAPE",
  168: "STABLEHLO_CLAMP",
  169: "STABLEHLO_CONCATENATE",
  170: "STABLEHLO_BROADCAST_IN_DIM",
  171: "STABLEHLO_CONVOLUTION",
  172: "STABLEHLO_SLICE",
  173: "STABLEHLO_CUSTOM_CALL",
  174: "STABLEHLO_REDUCE",
  175: "STABLEHLO_ABS",
  176: "STABLEHLO_AND",
  177: "STABLEHLO_COSINE",
  178: "STABLEHLO_EXPONENTIAL",
  179: "STABLEHLO_FLOOR",
  180: "STABLEHLO_LOG",
  181: "STABLEHLO_MINIMUM",
  182: "STABLEHLO_NEGATE",
  183: "STABLEHLO_OR",
  184: "STABLEHLO_POWER",
  185: "STABLEHLO_REMAINDER",
  186: "STABLEHLO_RSQRT",
  187: "STABLEHLO_SELECT",
  188: "STABLEHLO_SUBTRACT",
  189: "STABLEHLO_TANH",
  190: "STABLEHLO_SCATTER",
  191: "STABLEHLO_COMPARE",
  192: "STABLEHLO_CONVERT",
  193: "STABLEHLO_DYNAMIC_SLICE",
  194: "STABLEHLO_DYNAMIC_UPDATE_SLICE",
  195: "STABLEHLO_PAD",
  196: "STABLEHLO_IOTA",
  197: "STABLEHLO_DOT_GENERAL",
  198: "STABLEHLO_REDUCE_WINDOW",
};
```

- [ ] **Step 2: Write `packages/tflite/src/tensor-types.ts`**

```typescript
export const TENSOR_TYPE_NAMES: Record<number, string> = {
  0: "float32",
  1: "float16",
  2: "int32",
  3: "uint8",
  4: "int64",
  5: "string",
  6: "bool",
  7: "int16",
  8: "complex64",
  9: "int8",
  10: "float64",
  11: "complex128",
  12: "uint64",
  14: "variant",
  15: "uint32",
  16: "uint16",
  17: "int4",
  18: "bfloat16",
  19: "int2",
  20: "uint4",
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/tflite/src/builtin-ops.ts packages/tflite/src/tensor-types.ts
git commit -m "feat(@wetron/tflite): add builtin op names and tensor type map"
```

---

## Task 7: TFLite parser

**Files:**

- Create: `packages/tflite/src/parse.ts`
- Create: `packages/tflite/test/parse.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tflite/test/parse.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { parseTflite } from "../src/parse.ts";
import { ParseError } from "@wetron/core/ir";

const MODEL_PATH = new URL("../../../test-models/mobilenet_v2.tflite", import.meta.url);

test("parseTflite returns a ModelGraph", () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = parseTflite(bytes);
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.outputs.length).toBeGreaterThan(0);
});

test("every node has a non-empty opType", () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = parseTflite(bytes);
  for (const node of graph.nodes) {
    expect(node.opType).toBeTruthy();
  }
});

test("graph inputs have dtype", () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = parseTflite(bytes);
  for (const inp of graph.inputs) {
    expect(inp.dtype).toBeTruthy();
    expect(inp.shape).not.toBeNull();
  }
});

test("parseTflite throws ParseError on garbage input", () => {
  const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00]);
  expect(() => parseTflite(bad)).toThrow(ParseError);
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/tflite && bun test test/parse.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write `packages/tflite/src/parse.ts`**

```typescript
import { ByteBuffer } from "flatbuffers";
import type { ModelGraph, GraphNode, GraphValue } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { BUILTIN_OP_NAMES } from "./builtin-ops.ts";
import { TENSOR_TYPE_NAMES } from "./tensor-types.ts";

// FlatBuffers vtable field to vtable-offset mapping: field N → vtable offset 4 + N*2
function field(n: number): number {
  return 4 + n * 2;
}

// Look up a field offset in a table's vtable. Returns 0 if field is absent.
function voff(bb: ByteBuffer, table: number, fieldN: number): number {
  return bb.__offset(table, field(fieldN));
}

// Read an optional int8 field from a table
function int8_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readInt8(table + off) : def;
}

// Read an optional int32 field from a table
function int32_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readInt32(table + off) : def;
}

// Read an optional uint32 field from a table
function uint32_(bb: ByteBuffer, table: number, fieldN: number, def = 0): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.readUint32(table + off) : def;
}

// Read an optional string field from a table
function string_(bb: ByteBuffer, table: number, fieldN: number): string | null {
  const off = voff(bb, table, fieldN);
  return off ? (bb.__string(table + off) as string) : null;
}

// Get the number of entries in a vector field. Returns 0 if field is absent.
function vecLen(bb: ByteBuffer, table: number, fieldN: number): number {
  const off = voff(bb, table, fieldN);
  return off ? bb.__vector_len(table + off) : 0;
}

// Get the i-th table entry from a vector-of-tables field.
function vecTable(bb: ByteBuffer, table: number, fieldN: number, i: number): number {
  const off = voff(bb, table, fieldN);
  if (!off) return 0;
  const vec = bb.__vector(table + off);
  return bb.__indirect(vec + i * 4);
}

// Get the i-th int32 from a vector-of-scalars field.
function vecInt32(bb: ByteBuffer, table: number, fieldN: number, i: number): number {
  const off = voff(bb, table, fieldN);
  if (!off) return 0;
  const vec = bb.__vector(table + off);
  return bb.readInt32(vec + i * 4);
}

// TFLite FlatBuffers magic identifiers
const TFLITE_MAGIC = [
  [0x54, 0x46, 0x4c, 0x33], // TFL3
  [0x4f, 0x44, 0x4c, 0x46], // ODLF (LiteRT)
];

function isTflite(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return TFLITE_MAGIC.some(
    (m) => bytes[4] === m[0] && bytes[5] === m[1] && bytes[6] === m[2] && bytes[7] === m[3],
  );
}

// OperatorCode field indices (from tflite flatbuffers schema):
// 0: deprecated_builtin_code (int8), 1: custom_code (string),
// 2: version (int32), 3: builtin_code (int32)
function readOpName(bb: ByteBuffer, opcodeTable: number): string {
  const builtinCode = int32_(bb, opcodeTable, 3, -1);
  if (builtinCode >= 0) {
    if (builtinCode === 32) {
      return string_(bb, opcodeTable, 1) ?? "CUSTOM";
    }
    return BUILTIN_OP_NAMES[builtinCode] ?? `OP_${builtinCode}`;
  }
  const deprecated = int8_(bb, opcodeTable, 0, 0);
  if (deprecated === 32) return string_(bb, opcodeTable, 1) ?? "CUSTOM";
  return BUILTIN_OP_NAMES[deprecated] ?? `OP_${deprecated}`;
}

// Tensor field indices: 0=shape(vec int32), 1=type(int8), 2=buffer(uint32), 3=name(str)
function readTensor(
  bb: ByteBuffer,
  tensorTable: number,
): { name: string; shape: number[]; dtype: string } {
  const name = string_(bb, tensorTable, 3) ?? "";
  const type = int8_(bb, tensorTable, 1, 0);
  const shapeLen = vecLen(bb, tensorTable, 0);
  const shape: number[] = [];
  for (let i = 0; i < shapeLen; i++) {
    shape.push(vecInt32(bb, tensorTable, 0, i));
  }
  return { name, shape, dtype: TENSOR_TYPE_NAMES[type] ?? "unknown" };
}

export function parseTflite(bytes: Uint8Array): ModelGraph {
  if (!isTflite(bytes)) {
    throw new ParseError("tflite", "Not a TFLite file (missing magic bytes TFL3/ODLF)");
  }

  let bb: ByteBuffer;
  try {
    bb = new ByteBuffer(bytes);
  } catch (e) {
    throw new ParseError("tflite", `ByteBuffer init failed: ${e}`);
  }

  // Root table (Model)
  // Model field indices: 0=version, 1=operator_codes(vec tables), 2=subgraphs(vec tables), 3=description(str)
  const model = bb.__indirect(bb.position());

  // Read operator code names
  const numOpcodes = vecLen(bb, model, 1);
  const opcodeNames: string[] = [];
  for (let i = 0; i < numOpcodes; i++) {
    const oc = vecTable(bb, model, 1, i);
    opcodeNames.push(readOpName(bb, oc));
  }

  // Use first subgraph (main graph)
  if (vecLen(bb, model, 2) === 0) {
    throw new ParseError("tflite", "Model has no subgraphs");
  }
  const subgraph = vecTable(bb, model, 2, 0);

  // SubGraph field indices: 0=tensors(vec tables), 1=inputs(vec int32), 2=outputs(vec int32),
  //                         3=operators(vec tables), 4=name(str)
  const numTensors = vecLen(bb, subgraph, 0);
  const tensors: Array<{ name: string; shape: number[]; dtype: string }> = [];
  for (let i = 0; i < numTensors; i++) {
    tensors.push(readTensor(bb, vecTable(bb, subgraph, 0, i)));
  }

  const numInputIdxs = vecLen(bb, subgraph, 1);
  const inputIdxs: number[] = [];
  for (let i = 0; i < numInputIdxs; i++) inputIdxs.push(vecInt32(bb, subgraph, 1, i));

  const numOutputIdxs = vecLen(bb, subgraph, 2);
  const outputIdxs: number[] = [];
  for (let i = 0; i < numOutputIdxs; i++) outputIdxs.push(vecInt32(bb, subgraph, 2, i));

  // Operator field indices: 0=opcode_index(uint32), 1=inputs(vec int32), 2=outputs(vec int32)
  const numOperators = vecLen(bb, subgraph, 3);
  const nodes: GraphNode[] = [];
  for (let i = 0; i < numOperators; i++) {
    const op = vecTable(bb, subgraph, 3, i);
    const opcodeIdx = uint32_(bb, op, 0, 0);
    const opName = opcodeNames[opcodeIdx] ?? `OP_${opcodeIdx}`;

    const numOpInputs = vecLen(bb, op, 1);
    const opInputs: string[] = [];
    for (let j = 0; j < numOpInputs; j++) {
      const idx = vecInt32(bb, op, 1, j);
      opInputs.push(idx >= 0 && idx < tensors.length ? tensors[idx].name : `tensor_${idx}`);
    }

    const numOpOutputs = vecLen(bb, op, 2);
    const opOutputs: string[] = [];
    for (let j = 0; j < numOpOutputs; j++) {
      const idx = vecInt32(bb, op, 2, j);
      opOutputs.push(idx >= 0 && idx < tensors.length ? tensors[idx].name : `tensor_${idx}`);
    }

    nodes.push({
      name: `op_${i}`,
      opType: opName,
      inputs: opInputs,
      outputs: opOutputs,
      attributes: {},
    });
  }

  const toGraphValue = (idx: number): GraphValue => {
    const t = tensors[idx];
    return t
      ? { name: t.name, shape: t.shape, dtype: t.dtype }
      : { name: `tensor_${idx}`, shape: null, dtype: null };
  };

  const graphName = string_(bb, subgraph, 4) ?? "";

  return {
    name: graphName,
    inputs: inputIdxs.map(toGraphValue),
    outputs: outputIdxs.map(toGraphValue),
    nodes,
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
cd packages/tflite && bun test test/parse.test.ts
```

Expected: All 4 tests pass. If the garbage-input test throws a different error, check that `isTflite` returns `false` for the 8-byte garbage and the `ParseError` is thrown before `ByteBuffer` is constructed.

- [ ] **Step 5: Commit**

```bash
git add packages/tflite/src/parse.ts packages/tflite/test/parse.test.ts
git commit -m "feat(@wetron/tflite): add TFLite FlatBuffers parser"
```

---

## Task 8: Format detection

**Files:**

- Create: `packages/core/src/detect.ts`
- Create: `packages/core/test/detect.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/test/detect.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { detectFormat } from "../src/detect.ts";

test("detects TFLite by TFL3 magic at offset 4", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54;
  bytes[5] = 0x46;
  bytes[6] = 0x4c;
  bytes[7] = 0x33;
  expect(detectFormat(bytes)).toBe("tflite");
});

test("detects TFLite by ODLF magic at offset 4", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x4f;
  bytes[5] = 0x44;
  bytes[6] = 0x4c;
  bytes[7] = 0x46;
  expect(detectFormat(bytes)).toBe("tflite");
});

test("detects ONNX by 0x08 at byte 0", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});

test("detects ONNX by .onnx extension when magic is ambiguous", () => {
  const bytes = new Uint8Array([0x00]);
  expect(detectFormat(bytes, "model.onnx")).toBe("onnx");
});

test("TFLite magic beats extension", () => {
  const bytes = new Uint8Array(8);
  bytes[4] = 0x54;
  bytes[5] = 0x46;
  bytes[6] = 0x4c;
  bytes[7] = 0x33;
  expect(detectFormat(bytes, "model.onnx")).toBe("tflite");
});

test("returns unknown for unrecognized bytes", () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x02]);
  expect(detectFormat(bytes)).toBe("unknown");
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && bun test test/detect.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write `packages/core/src/detect.ts`**

```typescript
export type Format = "onnx" | "tflite" | "unknown";

export function detectFormat(bytes: Uint8Array, filename?: string): Format {
  if (bytes.length >= 8) {
    // TFL3
    if (bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33)
      return "tflite";
    // ODLF (LiteRT)
    if (bytes[4] === 0x4f && bytes[5] === 0x44 && bytes[6] === 0x4c && bytes[7] === 0x46)
      return "tflite";
  }
  // ONNX: protobuf field 1 varint tag = 0x08
  if (bytes.length > 0 && bytes[0] === 0x08) return "onnx";
  // Extension fallback
  if (filename?.endsWith(".onnx")) return "onnx";
  if (filename?.endsWith(".tflite")) return "tflite";
  return "unknown";
}
```

- [ ] **Step 4: Run the test**

```bash
cd packages/core && bun test test/detect.test.ts
```

Expected: `PASS` — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/detect.ts packages/core/test/detect.test.ts
git commit -m "feat(@wetron/core): add format detection"
```

---

## Task 9: Layout transform

**Files:**

- Create: `packages/core/src/transform.ts`
- Create: `packages/core/test/transform.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/test/transform.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { modelGraphToFlow } from "../src/transform.ts";
import type { ModelGraph } from "../src/ir.ts";

const SIMPLE_GRAPH: ModelGraph = {
  name: "test",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
  nodes: [
    { name: "conv1", opType: "Conv", inputs: ["x"], outputs: ["h"], attributes: {} },
    { name: "relu1", opType: "Relu", inputs: ["h"], outputs: ["y"], attributes: {} },
  ],
};

test("produces correct node count", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  // 1 input IO + 2 graph nodes + 1 output IO = 4
  expect(nodes.length).toBe(4);
});

test("produces correct edge count", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  // x→conv1, conv1→relu1, relu1→output:y = 3
  expect(edges.length).toBe(3);
});

test("IO nodes have type ioNode", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  const ioNodes = nodes.filter((n) => n.type === "ioNode");
  expect(ioNodes.length).toBe(2);
});

test("graph nodes have type graphNode", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  const graphNodes = nodes.filter((n) => n.type === "graphNode");
  expect(graphNodes.length).toBe(2);
});

test("all nodes have numeric positions after dagre layout", () => {
  const { nodes } = modelGraphToFlow(SIMPLE_GRAPH);
  for (const n of nodes) {
    expect(typeof n.position.x).toBe("number");
    expect(typeof n.position.y).toBe("number");
    expect(isFinite(n.position.x)).toBe(true);
    expect(isFinite(n.position.y)).toBe(true);
  }
});

test("edge sources and targets reference existing node ids", () => {
  const { nodes, edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    expect(ids.has(e.source)).toBe(true);
    expect(ids.has(e.target)).toBe(true);
  }
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && bun test test/transform.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write `packages/core/src/transform.ts`**

```typescript
import * as Dagre from "dagre";
import type { ModelGraph, GraphNode, AttributeValue } from "./ir.ts";

export type GraphNodeData = {
  opType: string;
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
  graphNode?: GraphNode;
};

export type FlowNode = {
  id: string;
  type: "graphNode" | "ioNode";
  position: { x: number; y: number };
  data: GraphNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

export function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 20, ranksep: 40 });

  const flowNodes: FlowNode[] = [];
  const flowEdges: FlowEdge[] = [];
  const outputToNodeId = new Map<string, string>();

  for (const gv of graph.inputs) {
    const id = `input::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: { opType: "Input", name: gv.name, inputs: [], outputs: [gv.name], attributes: {} },
    });
    g.setNode(id, { width: 180, height: 60 });
    outputToNodeId.set(gv.name, id);
  }

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const id = `node::${node.name || `${node.opType}_${i}`}`;
    flowNodes.push({
      id,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {
        opType: node.opType,
        name: node.name,
        inputs: node.inputs,
        outputs: node.outputs,
        attributes: node.attributes,
        graphNode: node,
      },
    });
    g.setNode(id, { width: 180, height: 60 });
    for (const out of node.outputs) outputToNodeId.set(out, id);
  }

  for (const gv of graph.outputs) {
    const id = `output::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: { opType: "Output", name: gv.name, inputs: [gv.name], outputs: [], attributes: {} },
    });
    g.setNode(id, { width: 180, height: 60 });
  }

  for (const fn of flowNodes) {
    if (fn.type === "ioNode" && fn.data.opType === "Input") continue;
    for (const inputName of fn.data.inputs) {
      const srcId = outputToNodeId.get(inputName);
      if (srcId) {
        const edgeId = `${srcId}=>${fn.id}`;
        flowEdges.push({ id: edgeId, source: srcId, target: fn.id });
        if (!g.hasEdge(srcId, fn.id)) g.setEdge(srcId, fn.id);
      }
    }
  }

  Dagre.layout(g);

  for (const fn of flowNodes) {
    const pos = g.node(fn.id);
    if (pos) fn.position = { x: pos.x - 90, y: pos.y - 30 };
  }

  return { nodes: flowNodes, edges: flowEdges };
}
```

- [ ] **Step 4: Run the test**

```bash
cd packages/core && bun test test/transform.test.ts
```

Expected: `PASS` — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transform.ts packages/core/test/transform.test.ts
git commit -m "feat(@wetron/core): add dagre layout transform"
```

---

## Task 10: React renderer

**Files:**

- Create: `packages/react/test/setup.ts`
- Create: `packages/react/src/nodes/GraphNode.tsx`
- Create: `packages/react/src/nodes/IoNode.tsx`
- Create: `packages/react/src/ModelGraphView.tsx`
- Create: `packages/react/src/index.ts`
- Create: `packages/react/test/ModelGraphView.test.tsx`

- [ ] **Step 1: Write the test setup file**

`packages/react/test/setup.ts`:

```typescript
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

- [ ] **Step 2: Write the failing test**

`packages/react/test/ModelGraphView.test.tsx`:

```typescript
import { test, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { parseOnnx } from "@wetron/onnx";
import { ModelGraphView } from "../src/index.ts";

const MODEL_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);

let graphNodes: Element[];

beforeAll(async () => {
  const bytes = new Uint8Array(readFileSync(MODEL_PATH));
  const graph = await parseOnnx(bytes);
  const { container } = render(React.createElement(ModelGraphView, { graph }));
  graphNodes = Array.from(container.querySelectorAll("[data-nodetype]"));
});

test("renders nodes", () => {
  expect(graphNodes.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Write `packages/react/src/nodes/GraphNode.tsx`**

```tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";

export function GraphNodeComponent({ data }: NodeProps<GraphNodeData>) {
  return (
    <div
      data-nodetype="graphNode"
      style={{
        padding: "8px 12px",
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: 8,
        minWidth: 160,
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 700, fontSize: 13 }}>{data.opType}</div>
      {data.name && <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{data.name}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 4: Write `packages/react/src/nodes/IoNode.tsx`**

```tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";

export function IoNodeComponent({ data }: NodeProps<GraphNodeData>) {
  const isInput = data.opType === "Input";
  return (
    <div
      data-nodetype="ioNode"
      style={{
        padding: "6px 12px",
        background: isInput ? "#e6f4ea" : "#e8f0fe",
        border: `1px solid ${isInput ? "#34a853" : "#4285f4"}`,
        borderRadius: 6,
        minWidth: 140,
        fontSize: 12,
        textAlign: "center",
      }}
    >
      {!isInput && <Handle type="target" position={Position.Top} />}
      <div style={{ fontWeight: 600 }}>{data.name}</div>
      {isInput && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
```

- [ ] **Step 5: Write `packages/react/src/ModelGraphView.tsx`**

```tsx
import React, { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph, GraphNode } from "@wetron/core/ir";
import { GraphNodeComponent } from "./nodes/GraphNode.tsx";
import { IoNodeComponent } from "./nodes/IoNode.tsx";

const nodeTypes = {
  graphNode: GraphNodeComponent,
  ioNode: IoNodeComponent,
};

type Props = {
  graph: ModelGraph;
  onNodeClick?: (node: GraphNode) => void;
};

function Inner({ graph, onNodeClick }: Props) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = modelGraphToFlow(graph);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node: Node<GraphNodeData>) => {
      const gn = node.data.graphNode;
      if (gn && onNodeClick) onNodeClick(gn);
    },
    [onNodeClick],
  );

  React.useEffect(() => {
    fitView();
  }, [graph, fitView]);

  return (
    <ReactFlow
      nodes={nodes as Node<GraphNodeData>[]}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      fitView
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}

export function ModelGraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%" }}>
        <Inner {...props} />
      </div>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 6: Write `packages/react/src/index.ts`**

```typescript
export { ModelGraphView } from "./ModelGraphView.tsx";
```

- [ ] **Step 7: Run the test**

```bash
cd packages/react && bun test test/ModelGraphView.test.tsx
```

Expected: `PASS`. If ReactFlow throws about missing CSS imports in test environment, add `jest.mock` for the CSS or check if happy-dom handles it. If `@xyflow/react` uses canvas APIs not available in happy-dom, the test will still pass as long as the component renders without throwing.

- [ ] **Step 8: Commit**

```bash
git add packages/react/
git commit -m "feat(@wetron/react): add ModelGraphView with custom nodes"
```

---

## Task 11: Svelte renderer

**Files:**

- Create: `packages/svelte/src/nodes/GraphNode.svelte`
- Create: `packages/svelte/src/nodes/IoNode.svelte`
- Create: `packages/svelte/src/ModelGraphView.svelte`
- Create: `packages/svelte/src/index.ts`

Note: Svelte components require a bundler (Vite + svelte-vite plugin) to be tested in a browser. This task ships working source files; integration testing is done in the consuming app.

- [ ] **Step 1: Install Svelte devDependencies**

```bash
cd packages/svelte && bun add -d svelte @xyflow/svelte
```

- [ ] **Step 2: Write `packages/svelte/src/nodes/GraphNode.svelte`**

```svelte
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { GraphNodeData } from '@wetron/core/transform';

  export let data: GraphNodeData;
</script>

<div class="graph-node" data-nodetype="graphNode">
  <Handle type="target" position={Position.Top} />
  <div class="op-type">{data.opType}</div>
  {#if data.name}
    <div class="node-name">{data.name}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .graph-node {
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    min-width: 160px;
    font-size: 12px;
  }
  .op-type { font-weight: 700; font-size: 13px; }
  .node-name { color: #888; font-size: 11px; margin-top: 2px; }
</style>
```

- [ ] **Step 3: Write `packages/svelte/src/nodes/IoNode.svelte`**

```svelte
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { GraphNodeData } from '@wetron/core/transform';

  export let data: GraphNodeData;
  $: isInput = data.opType === 'Input';
</script>

<div
  class="io-node"
  data-nodetype="ioNode"
  class:input={isInput}
  class:output={!isInput}
>
  {#if !isInput}
    <Handle type="target" position={Position.Top} />
  {/if}
  <div class="tensor-name">{data.name}</div>
  {#if isInput}
    <Handle type="source" position={Position.Bottom} />
  {/if}
</div>

<style>
  .io-node {
    padding: 6px 12px;
    border-radius: 6px;
    min-width: 140px;
    font-size: 12px;
    text-align: center;
    font-weight: 600;
  }
  .input { background: #e6f4ea; border: 1px solid #34a853; }
  .output { background: #e8f0fe; border: 1px solid #4285f4; }
  .tensor-name { font-weight: 600; }
</style>
```

- [ ] **Step 4: Write `packages/svelte/src/ModelGraphView.svelte`**

```svelte
<script lang="ts">
  import { SvelteFlow, MiniMap, Controls, Background } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { modelGraphToFlow } from '@wetron/core/transform';
  import type { ModelGraph, GraphNode } from '@wetron/core/ir';
  import type { GraphNodeData } from '@wetron/core/transform';
  import GraphNodeComponent from './nodes/GraphNode.svelte';
  import IoNodeComponent from './nodes/IoNode.svelte';

  export let graph: ModelGraph;
  export let onNodeClick: ((node: GraphNode) => void) | undefined = undefined;

  const nodeTypes = {
    graphNode: GraphNodeComponent,
    ioNode: IoNodeComponent,
  };

  $: ({ nodes, edges } = modelGraphToFlow(graph));

  function handleNodeClick(event: CustomEvent<{ node: { data: GraphNodeData } }>) {
    const gn = event.detail.node.data.graphNode;
    if (gn && onNodeClick) onNodeClick(gn);
  }
</script>

<div style="width: 100%; height: 100%;">
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    fitView
    on:nodeclick={handleNodeClick}
  >
    <MiniMap />
    <Controls />
    <Background />
  </SvelteFlow>
</div>
```

- [ ] **Step 5: Write `packages/svelte/src/index.ts`**

```typescript
export { default as ModelGraphView } from "./ModelGraphView.svelte";
```

- [ ] **Step 6: Commit**

```bash
git add packages/svelte/
git commit -m "feat(@wetron/svelte): add ModelGraphView with custom nodes"
```

---

## Task 12: Core unified entry point

**Files:**

- Create: `packages/core/src/index.ts`
- Create: `packages/core/test/index.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/test/index.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { parseModel, detectFormat } from "../src/index.ts";
import { ParseError } from "../src/ir.ts";

const ONNX_PATH = new URL("../../../test-models/mnist-12.onnx", import.meta.url);
const TFLITE_PATH = new URL("../../../test-models/mobilenet_v2.tflite", import.meta.url);

test("parseModel parses an ONNX file", async () => {
  const bytes = new Uint8Array(readFileSync(ONNX_PATH));
  const graph = await parseModel(bytes, "mnist-12.onnx");
  expect(graph.nodes.length).toBeGreaterThan(0);
});

test("parseModel parses a TFLite file", async () => {
  const bytes = new Uint8Array(readFileSync(TFLITE_PATH));
  const graph = await parseModel(bytes, "mobilenet_v2.tflite");
  expect(graph.nodes.length).toBeGreaterThan(0);
});

test("parseModel throws ParseError on unknown format", async () => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00]);
  await expect(parseModel(bytes, "model.bin")).rejects.toBeInstanceOf(ParseError);
});

test("re-exports detectFormat", () => {
  const bytes = new Uint8Array([0x08, 0x01]);
  expect(detectFormat(bytes)).toBe("onnx");
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && bun test test/index.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Write `packages/core/src/index.ts`**

```typescript
export { ParseError } from "./ir.ts";
export type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
export { modelGraphToFlow } from "./transform.ts";
export type { FlowNode, FlowEdge, GraphNodeData } from "./transform.ts";

import { detectFormat } from "./detect.ts";
import type { ModelGraph } from "./ir.ts";
import { ParseError } from "./ir.ts";

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
  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}
```

- [ ] **Step 4: Run the test**

```bash
cd packages/core && bun test test/index.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run all tests across the workspace**

```bash
bun test --cwd packages/core && bun test --cwd packages/onnx && bun test --cwd packages/tflite
```

Expected: All tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/test/index.test.ts
git commit -m "feat(@wetron/core): add unified parseModel entry point"
```

---

## Checkpoints

After all tasks complete:

- [ ] `parseOnnx` round-trips `mnist-12.onnx` without throwing — verify with `bun test --cwd packages/onnx`
- [ ] `parseTflite` round-trips `mobilenet_v2.tflite` without throwing — verify with `bun test --cwd packages/tflite`
- [ ] Node count in parser tests matches netron UI for each model
- [ ] No `any` in public API: `bunx tsc --noEmit` in each package
- [ ] `bun test` passes clean across core, onnx, tflite, react
- [ ] `<ModelGraphView>` renders correctly in a browser (manual check via a test app)
