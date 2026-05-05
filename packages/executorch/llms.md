# @wetron/executorch

ExecuTorch model parser. Reads `.pte` FlatBuffers files and returns a `ModelGraph` IR. Graph structure only - no weight tensors are deserialized.

## API

```ts
function parseExecutorch(bytes: Uint8Array): ModelGraph; // synchronous
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input or missing `ET12` identifier.

## What gets parsed

- Root `Program` table -> first `ExecutionPlan`
- Operator list from `ExecutionPlan.operators` - name + overload -> `op_type` string
- `EValue` list scanned for Tensor entries -> shape and dtype for `tensorShapes`
- `Chain` instructions -> `KernelCall` entries -> operator index resolved to op type
- Inputs/outputs from `ExecutionPlan.inputs` and `ExecutionPlan.outputs` value indices

## ScalarType mapping

| ExecuTorch enum | dtype string |
| --------------- | ------------ |
| 0               | `uint8`      |
| 1               | `int8`       |
| 2               | `int16`      |
| 3               | `int32`      |
| 4               | `int64`      |
| 5               | `float16`    |
| 6               | `float32`    |
| 7               | `float64`    |
| 11              | `bool`       |

## Graph construction

KernelCall arguments are categorised by whether their EValue index was already produced by a prior instruction. First occurrence -> output tensor; subsequent occurrence -> input tensor. This matches the ExecuTorch execution model where each value index is written exactly once.

## Implementation notes

- Uses `flatbuffers` npm package for FlatBuffers decoding via raw vtable offsets.
- Detected by `ET12` at bytes 4-7.
- Only the first execution plan is parsed (multi-plan programs are rare in practice).
- Non-fatal per-instruction errors are attached as `warnings` on the returned `ModelGraph`.
- `ModelGraph.initializers` is always empty - constant buffers are not parsed.
