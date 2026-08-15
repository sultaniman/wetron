---
title: 'Adding a Parser'
description: 'Step-by-step guide to adding a new model format parser to the Wetron monorepo - package setup, IR integration, format detection, and testing.'
lead: 'Each format is an independent package. Adding one follows a consistent pattern.'
weight: 10
---

## Steps

### 1. Create the package

```
packages/<format>/
  src/
    index.ts      # re-exports the parse function
    parse.ts      # parser implementation
  test/
    parse.test.ts
  package.json
  tsconfig.json
  tsup.config.ts
```

### 2. Implement the parse function

```ts
// packages/<format>/src/parse.ts
import type { ModelGraph, GraphNode, GraphValue, ParseWarning } from '@wetron/common/ir';
import { ParseError } from '@wetron/common/ir';

export function parse<Format>(bytes: Uint8Array): ModelGraph {
  // ...
  throw new ParseError('<format>', 'human-readable reason');
}
```

Rules:

- Import IR types from `@wetron/common/ir` - never redefine them.
- Import exotic dtype readers from `@wetron/common/dtypes` - never inline shims.
- Use native Web APIs: `DataView`, `TextDecoder`, `DecompressionStream`.
- Use `protobufjs` for protobuf formats, `flatbuffers` for FlatBuffers formats.
- Set `ModelGraph.fileSizeBytes` to `bytes.byteLength`. For inline initializer bytes, set `ModelGraph.weights` to `{ kind: "available", source }`, where `source` has `totalBytes` and `get(name)`. For required sidecar files, use `{ kind: "external", format }`. Return raw little-endian byte slices; decoding lives in `@wetron/core/weight-decoder`.
- Attach non-fatal issues as `warnings` on the returned `ModelGraph` rather than throwing.

### 3. Register format detection

Add magic byte detection to `packages/core/src/detect.ts`:

```ts
// Example: detect "ET12" at offset 4
if (bytes[4] === 0x45 && bytes[5] === 0x54 && bytes[6] === 0x31 && bytes[7] === 0x32) {
  return 'myformat';
}
```

`detectFormat` must always return a `Format` string - never throw.

### 4. Add to the unified entry

Add a dynamic import branch to `packages/core/src/index.ts`:

```ts
case "myformat": {
  const { parseMyFormat } = await import("@wetron/myformat");
  return parseMyFormat(bytes);
}
```

### 5. Write tests

```ts
// packages/<format>/test/parse.test.ts
import { test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseMyFormat } from '../src/index.ts';

test('parses test model', () => {
  const bytes = new Uint8Array(readFileSync('../../test-models/model.ext'));
  const graph = parseMyFormat(bytes);
  expect(graph.nodes.length).toBe(42); // must match Netron's node count
  expect(graph.inputs.length).toBeGreaterThan(0);
  expect(graph.nodes.every((n) => n.opType)).toBe(true);
});
```

Add a real model file to `test-models/`. Node count must match what Netron shows for the same file - use `netron-main/` as a reference for schema field layouts.

## Package.json template

```json
{
  "name": "@wetron/<format>",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "dependencies": {
    "@wetron/core": "workspace:*"
  }
}
```

## What NOT to do

- Don't decode weight tensors inside the parser - expose raw bytes via `WeightSource` and let consumers call `decodeWeight` / `decodeFirstN` from `@wetron/core` on demand.
- Don't copy netron's internal reader classes - `parseMyFormat(bytes)` is the entire public API.
- Don't inline dtype shims - import from `@wetron/common/dtypes`.
- Don't patch `DataView.prototype` or `BigInt.prototype`.
- Don't throw from `detectFormat` - return `"unknown"`.
- Don't skip failing tests - fix them before reporting done.
