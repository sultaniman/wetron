# @wetron/onnx

ONNX model parser for wetron. Reads `.onnx` files and returns a `ModelGraph` IR. Initializer bytes are surfaced lazily through `ModelGraph.weights`; initializers with `data_location = EXTERNAL` are not inlined and must be fetched separately (see below).

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

### External data loading

For models where initializers use `data_location = EXTERNAL`, fetch the external files and build a `WeightSource`:

```ts
import { loadOnnxExternalWeightsFromUrl } from "@wetron/onnx";

const weights = await loadOnnxExternalWeightsFromUrl(modelBytes, "https://.../model-dir");
// weights.get("init_name") -> Uint8Array | undefined
```

Each unique `location` filename is fetched once from `${baseUrl}/${location}` and shared across initializers that slice it. Returns an empty `WeightSource` when the model has no `EXTERNAL` initializers. Throws `ParseError` on non-`ok` responses.

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
