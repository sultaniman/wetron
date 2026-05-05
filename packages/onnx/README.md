# @wetron/onnx

ONNX model parser for wetron. Reads `.onnx` files and returns a `ModelGraph` IR. Graph structure only - no weight tensors are deserialized.

## Install

```bash
bun add @wetron/onnx
```

Included automatically when you install `@wetron/core` or `@wetron/react`.

## API

```ts
import { parseOnnx } from "@wetron/onnx";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseOnnx(bytes);
```

Throws `ParseError` from `@wetron/core/ir` on malformed input.

## What gets parsed

- All nodes with op type, inputs, outputs, and attributes
- Initializer shapes and dtypes (raw weight data is not read)
- Intermediate tensor shapes from `value_info`
- Opset versions per domain

## dtype mapping

| ONNX enum | dtype      |
| --------- | ---------- |
| 1         | `float32`  |
| 2         | `uint8`    |
| 3         | `int8`     |
| 6         | `int32`    |
| 7         | `int64`    |
| 10        | `float16`  |
| 11        | `float64`  |
| 16        | `bfloat16` |
