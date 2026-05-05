# @wetron/executorch

ExecuTorch model parser for wetron. Reads `.pte` FlatBuffers files and returns a `ModelGraph` IR. Graph structure only - no weight tensors are deserialized.

## Install

```bash
bun add @wetron/executorch
```

Included automatically when you install `@wetron/core` or `@wetron/react`.

## API

```ts
import { parseExecutorch } from "@wetron/executorch";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseExecutorch(bytes); // synchronous
```

Throws `ParseError` from `@wetron/core/ir` on malformed input or missing `ET12` identifier.

## What gets parsed

- First `ExecutionPlan` from the root `Program` table
- Operator list -> op type strings
- `EValue` tensor entries -> shapes and dtypes
- `KernelCall` instructions -> operator calls

## dtype mapping

| ExecuTorch enum | dtype     |
| --------------- | --------- |
| 0               | `uint8`   |
| 1               | `int8`    |
| 2               | `int16`   |
| 3               | `int32`   |
| 4               | `int64`   |
| 5               | `float16` |
| 6               | `float32` |
| 7               | `float64` |
| 11              | `bool`    |

## Notes

- Only the first execution plan is parsed.
- `ModelGraph.initializers` is always empty.
- Non-fatal per-instruction errors are attached as `warnings`.
