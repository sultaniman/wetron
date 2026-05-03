# @wetron/keras

Keras model parser for wetron. Reads `.keras` ZIP archive files and returns a `ModelGraph` IR. Supports `Sequential` and `Functional` model classes. Graph structure only — no weight tensors are deserialized.

## Install

```bash
bun add @wetron/keras
```

Included automatically when you install `@wetron/core` or `@wetron/react`.

## API

```ts
import { parseKeras } from "@wetron/keras";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseKeras(bytes); // synchronous
```

Throws `ParseError` from `@wetron/core/ir` on malformed input, missing `config.json`, or unsupported model class.

## What gets parsed

- `config.json` inside the `.keras` ZIP archive
- `Sequential` and `Functional` model classes
- Layer `class_name` → `opType`, layer `config` → node `attributes`
- Edges resolved from `inbound_nodes` for Functional models; chained sequentially for Sequential models
- Input shapes from `InputLayer` batch shapes

## Notes

- Weight data lives in separate `.weights.h5` files — not parsed.
- `ModelGraph.initializers` is always empty.
