---
title: "ExecuTorch"
description: "ExecuTorch .pte parser for Wetron — reads FlatBuffers execution plans from ET12 files, extracting operator chains with tensor shapes and dtypes."
lead: "Parses `.pte` FlatBuffers files produced by ExecuTorch."
weight: 50
---

```ts
import { parseExecutorch } from "@wetron/executorch";

const graph = parseExecutorch(bytes: Uint8Array): ModelGraph
```

Synchronous. Detected by `ET12` at bytes 4–7.

## What is parsed

- Root `Program` table → first `ExecutionPlan`
- Operator list — name + overload → `opType` string (e.g. `aten.conv2d.default`)
- `EValue` list scanned for Tensor entries → shape and dtype for `tensorShapes`
- `Chain` instructions → `KernelCall` entries → operator index resolved to op type
- `ExecutionPlan.inputs` and `.outputs` → graph inputs and outputs

## ScalarType mapping

| ExecuTorch enum | dtype |
|---|---|
| 0 | `uint8` |
| 1 | `int8` |
| 2 | `int16` |
| 3 | `int32` |
| 4 | `int64` |
| 5 | `float16` |
| 6 | `float32` |
| 7 | `float64` |
| 11 | `bool` |

## Graph construction

KernelCall arguments are categorised by whether their EValue index was already produced by a prior instruction:

- First occurrence of an index → output tensor of this node
- Subsequent occurrence → input tensor

This matches the ExecuTorch execution model where each value index is written exactly once.

## Notes

- Only the first execution plan is parsed (multi-plan programs are rare in practice).
- Non-fatal per-instruction errors are attached as `warnings`.
- `ModelGraph.initializers` is always empty — constant buffers are not parsed.
- Uses the `flatbuffers` npm package with raw vtable offset decoding.
