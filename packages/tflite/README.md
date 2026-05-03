# @wetron/tflite

TFLite model parser for wetron. Reads `.tflite` flatbuffer files and returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## Install

```bash
bun add @wetron/tflite
```

Included automatically when you install `@wetron/core` or `@wetron/react`.

## API

```ts
import { parseTflite } from "@wetron/tflite";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseTflite(bytes); // synchronous
```

Throws `ParseError` from `@wetron/core/ir` on malformed input.

## What gets parsed

- All subgraph operators with op type, inputs, and outputs
- Tensor shapes and dtypes
- Both `TFL3` (TFLite) and `ODLF` (LiteRT) magic bytes supported
- Custom ops resolved via their `custom_code` string

## dtype mapping

| TFLite enum | dtype      |
| ----------- | ---------- |
| 0           | `float32`  |
| 1           | `int32`    |
| 2           | `uint8`    |
| 3           | `int64`    |
| 8           | `int8`     |
| 9           | `float16`  |
| 256         | `bfloat16` |
